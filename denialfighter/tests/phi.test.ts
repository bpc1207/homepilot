import { beforeAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import { prisma } from "@/lib/db";
import { addDocument, createCase, deleteCase, getCase, NotFoundError, readDocument, UploadError } from "@/lib/phi";
import type { Actor } from "@/lib/audit";

const PDF = Buffer.from("%PDF-1.4\nSYNTHETIC DENIAL LETTER for Jane Synthetic, claim SYN-0001\n%%EOF");
let alice: Actor, bob: Actor;

beforeAll(async () => {
  const a = await prisma.user.upsert({ where: { email: "alice@example.test" }, update: {}, create: { email: "alice@example.test" } });
  const b = await prisma.user.upsert({ where: { email: "bob@example.test" }, update: {}, create: { email: "bob@example.test" } });
  alice = { userId: a.id, role: "USER", ip: "198.51.100.1" };
  bob = { userId: b.id, role: "USER", ip: "198.51.100.2" };
});

describe("PHI data-access layer", () => {
  it("stores uploads encrypted, round-trips them, and audits each access", async () => {
    const c = await createCase(alice);
    const { id, mime } = await addDocument(alice, c.id, "DENIAL_LETTER", PDF);
    expect(mime).toBe("application/pdf");

    const doc = await prisma.document.findUniqueOrThrow({ where: { id } });
    const raw = await fs.readFile(`.data/test-storage/${doc.storageKey}`);
    expect(raw.toString("latin1")).not.toContain("Jane Synthetic");
    expect((await readDocument(alice, id)).bytes.equals(PDF)).toBe(true);

    const actions = (await prisma.auditLog.findMany({ where: { actorId: alice.userId! }, orderBy: { at: "asc" } })).map((r) => r.action);
    expect(actions).toEqual(expect.arrayContaining(["CASE_CREATE", "DOCUMENT_UPLOAD", "DOCUMENT_READ"]));
    const row = await prisma.auditLog.findFirstOrThrow({ where: { action: "DOCUMENT_READ", resourceId: id } });
    expect(row.ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect(row.ipHash).not.toContain("198.51");
  });

  it("blocks other users from reading cases and documents", async () => {
    const c = await createCase(alice);
    const { id } = await addDocument(alice, c.id, "EOB", PDF);
    await expect(getCase(bob, c.id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(readDocument(bob, id)).rejects.toBeInstanceOf(NotFoundError);
    await expect(addDocument(bob, c.id, "OTHER", PDF)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("validates uploads by content, not declared type", async () => {
    const c = await createCase(alice);
    await expect(addDocument(alice, c.id, "OTHER", Buffer.from("MZ not a document"))).rejects.toMatchObject({ code: "BAD_TYPE" });
    await expect(addDocument(alice, c.id, "OTHER", Buffer.alloc(0))).rejects.toBeInstanceOf(UploadError);
    await expect(addDocument(alice, c.id, "OTHER", Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(16 * 1024 * 1024)]))).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("delete removes rows and objects and leaves ciphertext unrecoverable", async () => {
    const c = await createCase(alice);
    const { id } = await addDocument(alice, c.id, "DENIAL_LETTER", PDF);
    const doc = await prisma.document.findUniqueOrThrow({ where: { id } });
    await deleteCase(alice, c.id);

    expect(await prisma.case.findUnique({ where: { id: c.id } })).toBeNull();
    expect(await prisma.document.count({ where: { caseId: c.id } })).toBe(0);
    await expect(fs.access(`.data/test-storage/${doc.storageKey}`)).rejects.toThrow();
    expect(await prisma.auditLog.count({ where: { action: "CASE_DELETE", resourceId: c.id } })).toBe(1);
  });
});

describe("audit log immutability", () => {
  it("rejects UPDATE and DELETE at the database", async () => {
    const row = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { action: "X" } })).rejects.toThrow();
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
  });
});
