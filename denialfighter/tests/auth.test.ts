import { beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db";
import { consumeLoginToken, requestLoginLink } from "@/lib/auth";

vi.mock("next/headers", () => ({ cookies: vi.fn(), headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

let lastLink = "";
vi.mock("@/lib/mailer", () => ({
  sendMail: async (m: { text: string }) => { lastLink = m.text.match(/token=([\w-]+)/)?.[1] ?? ""; },
}));

beforeEach(async () => {
  lastLink = "";
  await prisma.loginToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany({ where: { email: { endsWith: "@example.test" } } });
});

describe("magic link auth", () => {
  it("issues a single-use token, stores only its hash, creates user + consent + audit", async () => {
    await requestLoginLink("New.User@Example.test", true);
    expect(lastLink.length).toBeGreaterThan(30);
    const stored = await prisma.loginToken.findFirstOrThrow();
    expect(stored.tokenHash).not.toBe(lastLink);

    const session = await consumeLoginToken(lastLink, "203.0.113.9");
    expect(session).toBeTruthy();
    const user = await prisma.user.findUniqueOrThrow({ where: { email: "new.user@example.test" } });
    expect(await prisma.consentRecord.count({ where: { userId: user.id } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { actorId: user.id, action: "AUTH_LOGIN" } })).toBe(1);

    expect(await consumeLoginToken(lastLink)).toBeNull(); // replay rejected
  });

  it("rejects expired tokens, unknown tokens and missing consent", async () => {
    await requestLoginLink("a@example.test", true);
    await prisma.loginToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await consumeLoginToken(lastLink)).toBeNull();
    expect(await consumeLoginToken("nope")).toBeNull();
    const before = await prisma.loginToken.count();
    await requestLoginLink("b@example.test", false);
    expect(await prisma.loginToken.count()).toBe(before);
  });

  it("rate limits link requests per email", async () => {
    for (let i = 0; i < 8; i++) await requestLoginLink("spam@example.test", true);
    expect(await prisma.loginToken.count({ where: { email: "spam@example.test" } })).toBe(5);
  });
});
