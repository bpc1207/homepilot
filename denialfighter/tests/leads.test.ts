import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { captureEmail, convertLead, createLead, getLeadView, RateLimitedError } from "@/lib/leads";
import { runLeadCheck } from "@/lib/intake";
import { getAnalysis, NotFoundError, UploadError } from "@/lib/phi";
import { purgeExpiredLeads } from "@/worker/index";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
const pdf = readFileSync("fixtures/letters/03-out-of-network.pdf");

beforeEach(async () => {
  await prisma.lead.deleteMany();
});

describe("anonymous Denial Checker", () => {
  it("runs the pipeline, hides details until email is captured, then converts to a case", async () => {
    const id = await createLead(pdf, "198.51.100.7");
    expect((await getLeadView(id))!.status).toBe("PROCESSING");
    await runLeadCheck({ leadId: id });

    const before = (await getLeadView(id))!;
    expect(before.status).toBe("READY");
    expect(before.emailCaptured).toBe(false);
    expect(before.result!.denialType).toBe("OUT_OF_NETWORK");
    expect(before.result!.signal).toBe("WORTH_REVIEWING");

    expect(await captureEmail(id, "not-an-email", true)).toBeNull();
    expect(await captureEmail(id, "lead@example.test", false)).toBeNull(); // consent required
    expect(await captureEmail(id, "Lead@Example.test", true)).toBe("lead@example.test");
    expect((await getLeadView(id))!.emailCaptured).toBe(true);

    const user = await prisma.user.upsert({ where: { email: "lead@example.test" }, update: {}, create: { email: "lead@example.test" } });
    const other = await prisma.user.upsert({ where: { email: "other@example.test" }, update: {}, create: { email: "other@example.test" } });
    await expect(convertLead({ userId: other.id, role: "USER" }, other.email, id)).rejects.toBeInstanceOf(NotFoundError); // email must match

    const caseId = await convertLead({ userId: user.id, role: "USER" }, user.email, id);
    const a = (await getAnalysis({ userId: user.id, role: "USER" }, caseId))!;
    expect(a.analysis.classification.primary).toBe("OUT_OF_NETWORK");
    expect((await prisma.case.findUniqueOrThrow({ where: { id: caseId }, include: { documents: true } })).documents).toHaveLength(1);
    expect(await prisma.lead.count({ where: { id } })).toBe(0); // lead (and its email) removed after conversion
  });

  it("stores the lead result and file encrypted", async () => {
    const id = await createLead(pdf, null);
    await runLeadCheck({ leadId: id });
    const row = await prisma.lead.findUniqueOrThrow({ where: { id } });
    expect(Buffer.from(row.checkerResultEnc!, "base64").toString("latin1")).not.toContain("Summit");
    const raw = readFileSync(`.data/test-storage/${row.storageKey}`);
    expect(raw.toString("latin1")).not.toContain("%PDF");
  });

  it("validates uploads and rate limits per IP", async () => {
    await expect(createLead(Buffer.from("MZ nope"), null)).rejects.toBeInstanceOf(UploadError);
    for (let i = 0; i < 5; i++) await createLead(pdf, "203.0.113.50");
    await expect(createLead(pdf, "203.0.113.50")).rejects.toBeInstanceOf(RateLimitedError);
    await createLead(pdf, "203.0.113.51"); // different IP is fine
  });

  it("purges expired, unconverted leads and their files", async () => {
    const id = await createLead(pdf, null);
    const row = await prisma.lead.findUniqueOrThrow({ where: { id } });
    await prisma.lead.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getLeadView(id)).toBeNull(); // expired leads are not viewable even before purge
    expect(await purgeExpiredLeads()).toBeGreaterThanOrEqual(1);
    expect(await prisma.lead.count({ where: { id } })).toBe(0);
    expect(() => readFileSync(`.data/test-storage/${row.storageKey}`)).toThrow();
  });
});
