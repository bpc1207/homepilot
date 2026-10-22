import { NextRequest, NextResponse } from "next/server";
import { consumeLoginToken, SESSION_COOKIE } from "@/lib/auth";
import { env } from "@/lib/env";
import { track } from "@/lib/analytics";
import { log } from "@/lib/logger";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const base = env().APP_URL;
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const login = token ? await consumeLoginToken(token, ip) : null;
    if (!login) return NextResponse.redirect(new URL("/login?error=1", base));
    if (login.isNewUser) await track("account_created").catch(() => undefined);
    const res = NextResponse.redirect(new URL(login.redirectTo, base));
    res.cookies.set(SESSION_COOKIE, login.sessionToken, {
      httpOnly: true,
      secure: env().NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 3600,
    });
    return res;
  } catch (err) {
    log.error("auth.verify_failed", err, { route: "/api/auth/verify" });
    return NextResponse.redirect(new URL("/login?error=1", base));
  }
}
