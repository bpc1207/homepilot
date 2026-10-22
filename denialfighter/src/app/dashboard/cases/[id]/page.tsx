import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { actorFor, requireUser } from "@/lib/auth";
import { deleteCase, getCase, NotFoundError } from "@/lib/phi";

async function remove(formData: FormData) {
  "use server";
  const user = await requireUser();
  await deleteCase(await actorFor(user), String(formData.get("caseId")));
  redirect("/dashboard");
}

export default async function CasePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  let c;
  try {
    c = await getCase(await actorFor(user), id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  return (
    <section className="space-y-6">
      <Link href="/dashboard" className="text-sm underline">&larr; My cases</Link>
      <h1 className="text-2xl font-bold">Case {c.id.slice(-6)}</h1>
      <p className="text-sm text-slate-600">Status: {c.status.replace("_", " ").toLowerCase()}</p>

      <div className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">Documents</h2>
        {sp.upload === "bad" && <p className="text-sm text-red-700">Please upload a PDF, PNG or JPEG under 15 MB.</p>}
        <ul className="text-sm">
          {c.documents.length === 0 && <li className="text-slate-600">Nothing uploaded yet.</li>}
          {c.documents.map((d) => (
            <li key={d.id}>
              <a className="text-blue-700 underline" href={`/api/documents/${d.id}`}>
                {d.kind.replace("_", " ").toLowerCase()} ({d.mime}, {Math.round(d.sizeBytes / 1024)} KB)
              </a>
            </li>
          ))}
        </ul>
        <form action={`/api/cases/${c.id}/documents`} method="post" encType="multipart/form-data" className="flex flex-wrap items-center gap-3">
          <select name="kind" className="rounded border px-2 py-1 text-sm" defaultValue="DENIAL_LETTER">
            <option value="DENIAL_LETTER">Denial letter</option>
            <option value="PLAN_DOC">Plan document</option>
            <option value="EOB">EOB</option>
            <option value="MEDICAL_RECORD">Medical record</option>
            <option value="OTHER">Other</option>
          </select>
          <input name="file" type="file" accept="application/pdf,image/png,image/jpeg" capture="environment" required className="text-sm" />
          <button className="rounded bg-blue-700 px-3 py-1 text-sm text-white">Upload</button>
        </form>
        <p className="text-xs text-slate-500">Files are encrypted before storage. Use the delete button below to erase this case and its files.</p>
      </div>

      <form action={remove}>
        <input type="hidden" name="caseId" value={c.id} />
        <button className="rounded border border-red-600 px-3 py-1 text-sm text-red-700">Delete this case and all its data</button>
      </form>
    </section>
  );
}
