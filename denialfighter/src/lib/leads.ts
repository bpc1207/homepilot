import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { audit, type Actor } from "./audit";
import { decryptBytes, decryptText, encryptBytes, encryptText, keyedHash, newDataKey, unwrapDataKey } from "./crypto";
import { storage } from "./storage";
import { addDocument, createCase, NotFoundError, saveAnalysis, sniffMime, UploadError } from "./phi";
import { env } from "./env";
import { StoredAnalysisSchema, type StoredAnalysis } from "./schemas";
import type { CheckerResult } from "./analyze";
import { z } from "zod";

const LEAD_TTL_MS = 24 * 3600 * 1000;
const MAX_PER_IP_PER_HOUR = 5;
const ANON: Actor = { userId: null, role: "ANONYMOUS" };

export class RateLimitedError extends Error {
  constructor() { super("RATE_LIMITED"); this.name = "RateLimitedError"; }
}

/** Anonymous Denial Checker upload. The returned id is a 192-bit capability; it is also bound to a cookie. */
export async function createLead(file: Buffer, ip: string | null): Promise<string> {
  if (file.length === 0) throw new UploadError("EMPTY");
  if (file.length > env().MAX_UPLOAD_BYTES) throw new UploadError("TOO_LARGE");
  if (!sniffMime(file)) throw new UploadError("BAD_TYPE");

  const ipHash = ip ? keyedHash(ip) : null;
  if (ipHash) {
    const recent = await prisma.lead.count({ where: { ipHash, createdAt: { gt: new Date(Date.now() - 3600 * 1000) } } });
    if (recent >= MAX_PER_IP_PER_HOUR) throw new RateLimitedError();
  }
  const id = randomBytes(24).toString("base64url");
  const { dek, wrapped } = await newDataKey();
  const storageKey = `leads/${id}`;
  await storage().put(storageKey, encryptBytes(dek, file, id), "application/octet-stream");
  await prisma.$transaction(async (tx) => {
    await tx.lead.create({ data: { id, storageKey, wrappedKey: wrapped, ipHash, expiresAt: new Date(Date.now() + LEAD_TTL_MS) } });
    await audit(tx, ANON, "LEAD_CREATE", "Lead", id);
  });
  return id;
}

const StoredLeadSchema = z.object({ checker: z.custom<CheckerResult>(), analysis: StoredAnalysisSchema, unsupportedReason: z.string().nullable() });

export async function readLeadFile(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead?.storageKey) throw new NotFoundError();
  const dek = await unwrapDataKey(lead.wrappedKey);
  const bytes = decryptBytes(dek, await storage().get(lead.storageKey), leadId);
  await audit(prisma, { userId: null, role: "WORKER" }, "DOCUMENT_READ", "Lead", leadId);
  return { bytes, mime: sniffMime(bytes)! };
}

export async function saveLeadResult(leadId: string, data: { checker: CheckerResult; analysis: StoredAnalysis; unsupportedReason: string | null } | null) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new NotFoundError();
  if (!data) {
    await prisma.lead.update({ where: { id: leadId }, data: { status: "FAILED" } });
    return;
  }
  const dek = await unwrapDataKey(lead.wrappedKey);
  await prisma.lead.update({
    where: { id: leadId },
    data: { checkerResultEnc: encryptText(dek, JSON.stringify(data), leadId), status: data.unsupportedReason ? "UNSUPPORTED" : "READY" },
  });
}

export type LeadView = { status: string; emailCaptured: boolean; email: string | null; result: CheckerResult | null; expiresAt: Date };

/** Read a lead. Callers must have verified the cookie capability first. */
export async function getLeadView(leadId: string): Promise<LeadView | null> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.expiresAt < new Date()) return null;
  let result: CheckerResult | null = null;
  if (lead.checkerResultEnc) {
    const dek = await unwrapDataKey(lead.wrappedKey);
    result = StoredLeadSchema.parse(JSON.parse(decryptText(dek, lead.checkerResultEnc, leadId))).checker;
    await audit(prisma, ANON, "LEAD_READ", "Lead", leadId);
  }
  return { status: lead.status, emailCaptured: !!lead.email, email: lead.email, result, expiresAt: lead.expiresAt };
}

export async function captureEmail(leadId: string, emailRaw: string, consent: boolean): Promise<string | null> {
  const email = emailRaw.trim().toLowerCase();
  if (!consent || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return null;
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.expiresAt < new Date()) return null;
  await prisma.lead.update({ where: { id: leadId }, data: { email, consentVersion: "2026-10-draft" } });
  return email;
}

/** Turn an anonymous check into a Case for a signed-in user whose email matches the one captured on the lead. */
export async function convertLead(actor: Actor, userEmail: string, leadId: string): Promise<string> {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.expiresAt < new Date() || !lead.email || lead.email !== userEmail.toLowerCase()) throw new NotFoundError();
  const { bytes } = await readLeadFile(leadId);
  const c = await createCase(actor);
  const doc = await addDocument(actor, c.id, "DENIAL_LETTER", bytes);
  if (lead.checkerResultEnc) {
    const dek = await unwrapDataKey(lead.wrappedKey);
    const stored = StoredLeadSchema.parse(JSON.parse(decryptText(dek, lead.checkerResultEnc, leadId)));
    await saveAnalysis(actor, c.id, doc.id, { ...stored.analysis, unsupportedReason: stored.unsupportedReason });
  }
  await prisma.$transaction(async (tx) => {
    await audit(tx, actor, "LEAD_CONVERT", "Lead", leadId);
  });
  if (lead.storageKey) await storage().delete(lead.storageKey);
  await prisma.lead.delete({ where: { id: leadId } });
  return c.id;
}
