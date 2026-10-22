import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { prisma } from "@/lib/db";
import { addDocument, confirmExtraction, createCase, getAnalysis } from "@/lib/phi";
import { runCaseIntake } from "@/lib/intake";
import type { Actor } from "@/lib/audit";
import { emptyFields } from "@/lib/schemas";

let alice: Actor, bob: Actor;
beforeAll(async () => {
  const a = await prisma.user.upsert({ where: { email: "alice@example.test" }, update: {}, create: { email: "alice@example.test" } });
  const b = await prisma.user.upsert({ where: { email: "bob@example.test" }, update: {}, create: { email: "bob@example.test" } });
  alice = { userId: a.id, role: "USER" };
  bob = { userId: b.id, role: "USER" };
});
afterEach(() => vi.restoreAllMocks());

const letter = (n: string) => readFileSync(`fixtures/letters/${n}.pdf`);

describe("case intake pipeline", () => {
  it("extracts, classifies and stores encrypted; leaks nothing to logs", async () => {
    const out: string[] = [];
    vi.spyOn(console, "log").mockImplementation((s) => void out.push(String(s)));
    vi.spyOn(console, "warn").mockImplementation((s) => void out.push(String(s)));

    const c = await createCase(alice);
    const doc = await addDocument(alice, c.id, "DENIAL_LETTER", letter("02-prior-auth"));
    await runCaseIntake({ caseId: c.id, docId: doc.id });

    const a = (await getAnalysis(alice, c.id))!;
    expect(a.analysis.classification.primary).toBe("PRIOR_AUTH_MISSING");
    expect(a.analysis.fields.claimRef).toBe("CV7788210");
    expect(a.confirmedAt).toBeNull();

    const row = await prisma.case.findUniqueOrThrow({ where: { id: c.id }, include: { extraction: true, documents: true } });
    expect(row.processingState).toBe("READY");
    expect(row.denialType).toBe("PRIOR_AUTH_MISSING");
    expect(row.appealDeadline?.toISOString().slice(0, 10)).toBe("2026-10-11");
    expect(Buffer.from(row.extraction!.fieldsEnc, "base64").toString("latin1")).not.toContain("Cedar Valley");
    expect(Buffer.from(row.documents[0].ocrTextEnc!, "base64").toString("latin1")).not.toContain("Testperson");

    const logged = out.join("\n");
    for (const s of ["Cedar Valley", "Testperson", "CV7788210", "29881", "arthroscopic"]) expect(logged.toLowerCase()).not.toContain(s.toLowerCase());
  });

  it("flags Medicare Advantage as unsupported", async () => {
    const c = await createCase(alice);
    const doc = await addDocument(alice, c.id, "DENIAL_LETTER", letter("10-medicare-advantage"));
    await runCaseIntake({ caseId: c.id, docId: doc.id });
    const row = await prisma.case.findUniqueOrThrow({ where: { id: c.id } });
    expect(row.processingState).toBe("UNSUPPORTED");
    expect(row.unsupportedReason).toMatch(/Medicare/);
  });

  it("marks FAILED when the document cannot be read, without throwing", async () => {
    const c = await createCase(alice);
    const doc = await addDocument(alice, c.id, "DENIAL_LETTER", Buffer.from("%PDF-1.4\nnot a real pdf\n%%EOF"));
    await runCaseIntake({ caseId: c.id, docId: doc.id });
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).processingState).toBe("FAILED");
  });

  it("lets the user confirm/edit facts; edits win and are access-controlled", async () => {
    const c = await createCase(alice);
    const doc = await addDocument(alice, c.id, "DENIAL_LETTER", letter("09-no-deadline"));
    await runCaseIntake({ caseId: c.id, docId: doc.id });
    const a = (await getAnalysis(alice, c.id))!;
    expect(a.analysis.fields.appealDeadline).toBeNull();

    await confirmExtraction(alice, c.id, { ...a.analysis.fields, appealDeadline: "2026-12-01", claimRef: "MG-EDITED" }, "OTHER");
    const after = (await getAnalysis(alice, c.id))!;
    expect(after.confirmedAt).not.toBeNull();
    expect(after.analysis.fields.claimRef).toBe("MG-EDITED");
    expect(after.analysis.classification.primary).toBe("OTHER");
    expect((await prisma.case.findUniqueOrThrow({ where: { id: c.id } })).appealDeadline?.toISOString().slice(0, 10)).toBe("2026-12-01");

    await expect(getAnalysis(bob, c.id)).rejects.toThrow();
    await expect(confirmExtraction(bob, c.id, emptyFields(), "OTHER")).rejects.toThrow();
    const actions = (await prisma.auditLog.findMany({ where: { resourceId: c.id, resourceType: "Extraction" } })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["CASE_UPDATE", "CASE_READ"]));
  });
});
