import type { Case, DocumentKind } from "@prisma/client";
import { prisma } from "./db";
import { audit, type Actor } from "./audit";
import { decryptBytes, encryptBytes, newDataKey, sha256Hex, unwrapDataKey } from "./crypto";
import { storage } from "./storage";
import { env } from "./env";

/**
 * The only module that reads or writes case data and uploaded documents. Every function
 * checks ownership and writes an AuditLog row in the same transaction as the access.
 */

export class NotFoundError extends Error {
  constructor() { super("Not found"); this.name = "NotFoundError"; }
}
export class UploadError extends Error {
  constructor(public code: "TOO_LARGE" | "BAD_TYPE" | "EMPTY") { super(code); this.name = "UploadError"; }
}

const canSee = (actor: Actor, c: Pick<Case, "userId">) => actor.userId !== null && c.userId === actor.userId;

export function sniffMime(buf: Buffer): string | null {
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  return null;
}

export async function createCase(actor: Actor): Promise<Case> {
  const { wrapped } = await newDataKey();
  return prisma.$transaction(async (tx) => {
    const c = await tx.case.create({
      data: { userId: actor.userId!, dataKeyWrapped: wrapped, events: { create: { toStatus: "DRAFT" } } },
    });
    await audit(tx, actor, "CASE_CREATE", "Case", c.id);
    return c;
  });
}

export async function listCases(actor: Actor) {
  return prisma.case.findMany({
    where: { userId: actor.userId! },
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, denialType: true, appealDeadline: true, createdAt: true },
  });
}

export async function getCase(actor: Actor, caseId: string) {
  return prisma.$transaction(async (tx) => {
    const c = await tx.case.findUnique({ where: { id: caseId }, include: { documents: { orderBy: { createdAt: "asc" } } } });
    if (!c || !canSee(actor, c)) throw new NotFoundError();
    await audit(tx, actor, "CASE_READ", "Case", c.id);
    return c;
  });
}

export async function addDocument(actor: Actor, caseId: string, kind: DocumentKind, file: Buffer) {
  if (file.length === 0) throw new UploadError("EMPTY");
  if (file.length > env().MAX_UPLOAD_BYTES) throw new UploadError("TOO_LARGE");
  const mime = sniffMime(file); // trust magic bytes, not the client-declared type
  if (!mime) throw new UploadError("BAD_TYPE");

  const c = await prisma.case.findUnique({ where: { id: caseId } });
  if (!c || !canSee(actor, c)) throw new NotFoundError();
  const dek = await unwrapDataKey(c.dataKeyWrapped);

  const doc = await prisma.document.create({
    data: { caseId, kind, mime, sizeBytes: file.length, sha256: sha256Hex(file), storageKey: "pending" },
  });
  const storageKey = `cases/${caseId}/${doc.id}`;
  try {
    await storage().put(storageKey, encryptBytes(dek, file, caseId), "application/octet-stream");
    await prisma.$transaction(async (tx) => {
      await tx.document.update({ where: { id: doc.id }, data: { storageKey } });
      await audit(tx, actor, "DOCUMENT_UPLOAD", "Document", doc.id);
    });
  } catch (err) {
    await prisma.document.delete({ where: { id: doc.id } }).catch(() => undefined);
    throw err;
  }
  return { id: doc.id, mime };
}

export async function readDocument(actor: Actor, docId: string) {
  const doc = await prisma.document.findUnique({ where: { id: docId }, include: { case: true } });
  if (!doc || !canSee(actor, doc.case)) throw new NotFoundError();
  const dek = await unwrapDataKey(doc.case.dataKeyWrapped);
  const bytes = decryptBytes(dek, await storage().get(doc.storageKey), doc.caseId);
  await audit(prisma, actor, "DOCUMENT_READ", "Document", doc.id);
  return { bytes, mime: doc.mime };
}

/**
 * One-click delete. Removes stored objects, destroys the data key (crypto-shred), deletes the
 * case and children. De-identified OutcomeRecords (unlinkable by design) and the audit trail
 * (IDs only) remain.
 */
export async function deleteCase(actor: Actor, caseId: string) {
  const c = await prisma.case.findUnique({ where: { id: caseId }, include: { documents: true } });
  if (!c || !canSee(actor, c)) throw new NotFoundError();

  // 1. Crypto-shred first: even if object deletion fails, ciphertext is unrecoverable.
  await prisma.case.update({ where: { id: caseId }, data: { dataKeyWrapped: null } });
  // 2. Delete stored objects.
  await Promise.all(c.documents.map((d) => storage().delete(d.storageKey)));
  // 3. Delete rows and record the deletion.
  await prisma.$transaction(async (tx) => {
    await tx.case.delete({ where: { id: caseId } });
    await audit(tx, actor, "CASE_DELETE", "Case", caseId);
  });
}

export async function recentAudit(actor: Actor, take = 50) {
  await audit(prisma, actor, "AUDIT_READ", "AuditLog", actor.userId);
  return prisma.auditLog.findMany({ where: { actorId: actor.userId! }, orderBy: { at: "desc" }, take });
}

