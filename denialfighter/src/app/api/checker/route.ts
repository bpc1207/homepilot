import { NextRequest, NextResponse } from "next/server";
import { createLead, RateLimitedError } from "@/lib/leads";
import { UploadError } from "@/lib/phi";
import { enqueue, QUEUES } from "@/lib/jobs";
import { track } from "@/lib/analytics";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const to = (p: string) => NextResponse.redirect(new URL(p, env().APP_URL), 303);
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || file.size > env().MAX_UPLOAD_BYTES) return to("/?error=upload");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const id = await createLead(Buffer.from(await file.arrayBuffer()), ip);
    await enqueue(QUEUES.CHECKER, { leadId: id });
    await track("checker_uploaded", { anonId: id.slice(0, 8) }).catch(() => undefined);
    const res = to(`/check/${id}`);
    res.cookies.set("df_lead", id, { httpOnly: true, secure: env().NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 24 * 3600 });
    return res;
  } catch (err) {
    if (err instanceof UploadError) return to("/?error=upload");
    if (err instanceof RateLimitedError) return to("/?error=rate");
    log.error("checker.failed", err, { route: "/api/checker" });
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
