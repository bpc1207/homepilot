import type { Prisma, PrismaClient } from "@prisma/client";
import { keyedHash } from "./crypto";

export type Actor = { userId: string | null; role: string | null; ip?: string | null };

export type AuditAction =
  | "AUTH_LOGIN" | "AUTH_LOGOUT"
  | "CASE_CREATE" | "CASE_READ" | "CASE_UPDATE" | "CASE_DELETE"
  | "DOCUMENT_UPLOAD" | "DOCUMENT_READ" | "DOCUMENT_DELETE"
  | "LEAD_CREATE" | "LEAD_READ" | "LEAD_CONVERT"
  | "AUDIT_READ";

type Db = PrismaClient | Prisma.TransactionClient;

/** Record a PHI access. IDs only. Call inside the same transaction as the access when possible. */
export async function audit(
  db: Db,
  actor: Actor,
  action: AuditAction,
  resourceType: string,
  resourceId?: string | null,
) {
  await db.auditLog.create({
    data: {
      actorId: actor.userId,
      actorRole: actor.role,
      action,
      resourceType,
      resourceId: resourceId ?? null,
      ipHash: actor.ip ? keyedHash(actor.ip) : null,
    },
  });
}
