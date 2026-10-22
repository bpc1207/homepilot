import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "./db";
import { newToken, sha256Hex } from "./crypto";
import { env } from "./env";
import { sendMail } from "./mailer";
import { audit, type Actor } from "./audit";

export const SESSION_COOKIE = "df_session";
export const CONSENT_VERSION = "2026-10-draft";
const LOGIN_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;
const MAX_LINKS_PER_HOUR = 5;

export type SessionUser = { id: string; email: string; role: "USER" | "ADMIN" | "SUPPORT" };

/** Create and email a single-use magic link. Always resolves the same way to avoid account enumeration. */
export async function requestLoginLink(emailRaw: string, consent: boolean): Promise<void> {
  const email = emailRaw.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !consent) return;

  const recent = await prisma.loginToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 3600 * 1000) } },
  });
  if (recent >= MAX_LINKS_PER_HOUR) return;

  const { token, hash } = newToken();
  await prisma.loginToken.create({
    data: { email, tokenHash: hash, consentVersion: CONSENT_VERSION, expiresAt: new Date(Date.now() + LOGIN_TTL_MS) },
  });
  const link = `${env().APP_URL}/api/auth/verify?token=${token}`;
  await sendMail({
    to: email,
    subject: "Your DenialFighter sign-in link",
    text: `Use this link to sign in (valid 15 minutes, single use):\n\n${link}\n\nIf you didn't request it, ignore this email.`,
  });
}

/** Consume a magic-link token; returns a session token to set as cookie, or null. */
export async function consumeLoginToken(token: string, ip?: string | null): Promise<string | null> {
  const hash = sha256Hex(token);
  return prisma.$transaction(async (tx) => {
    // Atomic single use: only one request can flip usedAt from null.
    const claimed = await tx.loginToken.updateMany({
      where: { tokenHash: hash, usedAt: null, expiresAt: { gt: new Date() } },
      data: { usedAt: new Date() },
    });
    if (claimed.count !== 1) return null;
    const lt = await tx.loginToken.findUniqueOrThrow({ where: { tokenHash: hash } });

    let user = await tx.user.findUnique({ where: { email: lt.email } });
    if (!user) user = await tx.user.create({ data: { email: lt.email } });
    if (user.deletedAt) return null;
    if (lt.consentVersion) {
      await tx.consentRecord.createMany({
        data: [
          { userId: user.id, kind: "TERMS", version: lt.consentVersion },
          { userId: user.id, kind: "PRIVACY", version: lt.consentVersion },
        ],
      });
    }
    const s = newToken();
    await tx.session.create({
      data: { userId: user.id, tokenHash: s.hash, expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
    });
    await audit(tx, { userId: user.id, role: user.role, ip }, "AUTH_LOGIN", "User", user.id);
    return s.token;
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const raw = jar.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256Hex(raw) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || session.user.deletedAt) return null;
  return { id: session.user.id, email: session.user.email, role: session.user.role };
}

export async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireRole(...roles: SessionUser["role"][]): Promise<SessionUser> {
  const u = await requireUser();
  if (!roles.includes(u.role)) redirect("/dashboard");
  return u;
}

export async function actorFor(user: SessionUser): Promise<Actor> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  return { userId: user.id, role: user.role, ip };
}

export async function destroySession(raw: string | undefined) {
  if (raw) await prisma.session.deleteMany({ where: { tokenHash: sha256Hex(raw) } });
}
