import { NextRequest, NextResponse } from "next/server";
import { actorFor, getSessionUser } from "@/lib/auth";
import { NotFoundError, readDocument } from "@/lib/phi";
import { log } from "@/lib/logger";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { bytes, mime } = await readDocument(await actorFor(user), id);
    return new NextResponse(new Uint8Array(bytes), {
      headers: { "Content-Type": mime, "Content-Disposition": "inline", "Cache-Control": "private, no-store" },
    });
  } catch (err) {
    if (err instanceof NotFoundError) return NextResponse.json({ error: "not found" }, { status: 404 });
    log.error("document.read_failed", err, { route: "/api/documents", docId: id });
    return NextResponse.json({ error: "error" }, { status: 500 });
  }
}
