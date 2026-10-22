import { NextRequest, NextResponse } from "next/server";
import { destroySession, SESSION_COOKIE } from "@/lib/auth";
import { env } from "@/lib/env";

export async function POST(req: NextRequest) {
  await destroySession(req.cookies.get(SESSION_COOKIE)?.value);
  const res = NextResponse.redirect(new URL("/", env().APP_URL), 303);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
