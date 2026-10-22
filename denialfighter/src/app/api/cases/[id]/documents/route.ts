import { NextRequest, NextResponse } from "next/server";
import { DocumentKind } from "@prisma/client";
import { actorFor, getSessionUser } from "@/lib/auth";
import { addDocument, NotFoundError, UploadError } from "@/lib/phi";
import { env } from "@/lib/env";
import { log } from "@/lib/logger";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const back = (q = "") => NextResponse.redirect(new URL(`/dashboard/cases/${id}${q}`, env().APP_URL), 303);

  try {
    const form = await req.formData();
    const file = form.get("file");
    const kindRaw = String(form.get("kind") ?? "OTHER");
    const kind = (Object.values(DocumentKind) as string[]).includes(kindRaw) ? (kindRaw as DocumentKind) : "OTHER";
    if (!(file instanceof File)) return back("?upload=bad");
    if (file.size > env().MAX_UPLOAD_BYTES) return back("?upload=bad");
    await addDocument(await actorFor(user), id, kind, Buffer.from(await file.arrayBuffer()));
    return back();
  } catch (err) {
    if (err instanceof UploadError) return back("?upload=bad");
    if (err instanceof NotFoundError) return NextResponse.json({ error: "not found" }, { status: 404 });
    log.error("upload.failed", err, { route: "/api/cases/documents", caseId: id });
    return NextResponse.json({ error: "upload failed" }, { status: 500 });
  }
}
