import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import AutoRefresh from "@/app/AutoRefresh";
import { actorFor, requireUser } from "@/lib/auth";
import { confirmExtraction, deleteCase, getAnalysis, getCase, NotFoundError } from "@/lib/phi";
import { DENIAL_TYPES, ExtractionSchema, PLAN_TYPES, emptyFields } from "@/lib/schemas";

async function remove(formData: FormData) {
  "use server";
  const user = await requireUser();
  await deleteCase(await actorFor(user), String(formData.get("caseId")));
  redirect("/dashboard");
}

const text = (f: FormData, k: string) => {
  const v = String(f.get(k) ?? "").trim();
  return v === "" ? null : v;
};
const list = (f: FormData, k: string) =>
  String(f.get(k) ?? "").split(/[,\s]+/).map((x) => x.trim().toUpperCase()).filter(Boolean);

async function confirm(formData: FormData) {
  "use server";
  const user = await requireUser();
  const caseId = String(formData.get("caseId"));
  const dollars = text(formData, "amountDenied");
  const parsed = ExtractionSchema.safeParse({
    insurer: text(formData, "insurer"),
    planType: text(formData, "planType") ?? "UNKNOWN",
    claimRef: text(formData, "claimRef"),
    service: text(formData, "service"),
    cptCodes: list(formData, "cptCodes"),
    icdCodes: list(formData, "icdCodes"),
    denialReason: text(formData, "denialReason"),
    denialDate: text(formData, "denialDate"),
    appealDeadline: text(formData, "appealDeadline"),
    amountDeniedCents: dollars ? Math.round(parseFloat(dollars.replace(/[$,]/g, "")) * 100) : null,
  });
  const type = DENIAL_TYPES.find((t) => t === formData.get("denialType"));
  if (!parsed.success || !type || (parsed.data.amountDeniedCents !== null && Number.isNaN(parsed.data.amountDeniedCents))) {
    redirect(`/dashboard/cases/${caseId}?error=fields`);
  }
  await confirmExtraction(await actorFor(user), caseId, parsed.data, type);
  redirect(`/dashboard/cases/${caseId}?saved=1`);
}

const label = (s: string) => s.replace(/_/g, " ").toLowerCase();
const inputCls = "w-full rounded border px-2 py-1 text-sm";

export default async function CasePage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string; error?: string; saved?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const actor = await actorFor(user);
  let c, a;
  try {
    c = await getCase(actor, id);
    a = await getAnalysis(actor, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const f = a?.analysis.fields ?? emptyFields();
  const cls = a?.analysis.classification;
  const hasLetter = c.documents.some((d) => d.kind === "DENIAL_LETTER");
  const showForm = a || c.processingState === "FAILED";

  return (
    <section className="space-y-6">
      <Link href="/dashboard" className="text-sm underline">&larr; My cases</Link>
      <h1 className="text-2xl font-bold">Case {c.id.slice(-6)}</h1>
      <p className="text-sm text-slate-600">Status: {label(c.status)}</p>

      <div className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">Documents</h2>
        {sp.upload === "bad" && <p className="text-sm text-red-700">Please upload a PDF, PNG or JPEG under 15 MB.</p>}
        <ul className="text-sm">
          {c.documents.length === 0 && <li className="text-slate-600">Nothing uploaded yet. Start with your denial letter.</li>}
          {c.documents.map((d) => (
            <li key={d.id}>
              <a className="text-blue-700 underline" href={`/api/documents/${d.id}`}>
                {label(d.kind)} ({d.mime}, {Math.round(d.sizeBytes / 1024)} KB)
              </a>
            </li>
          ))}
        </ul>
        <form action={`/api/cases/${c.id}/documents`} method="post" encType="multipart/form-data" className="flex flex-wrap items-center gap-3">
          <select name="kind" className="rounded border px-2 py-1 text-sm" defaultValue={hasLetter ? "PLAN_DOC" : "DENIAL_LETTER"}>
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

      {c.processingState === "PROCESSING" && (
        <div className="rounded border bg-white p-4 text-sm">
          <AutoRefresh />
          Reading your denial letter&hellip; this usually takes under a minute.
        </div>
      )}
      {c.processingState === "FAILED" && (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          We couldn&apos;t read that letter automatically. You can enter the details yourself below, or upload a clearer copy.
        </p>
      )}
      {c.unsupportedReason && <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">{c.unsupportedReason}</p>}

      {showForm && (
        <form action={confirm} className="space-y-4 rounded border bg-white p-4">
          <input type="hidden" name="caseId" value={c.id} />
          <h2 className="font-semibold">Check what we read from your letter</h2>
          <p className="text-sm text-slate-600">Automatic reading can be wrong. Fix anything that doesn&apos;t match your letter, then confirm. Leave a field blank if the letter doesn&apos;t say.</p>
          {sp.error && <p className="text-sm text-red-700">Some fields look invalid (check dates and amounts).</p>}
          {sp.saved && <p className="rounded bg-green-50 p-2 text-sm">Saved. Strategy and letter generation arrive in the next release.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Insurer<input name="insurer" defaultValue={f.insurer ?? ""} className={inputCls} /></label>
            <label className="text-sm">Plan type
              <select name="planType" defaultValue={f.planType} className={inputCls}>{PLAN_TYPES.map((p) => <option key={p} value={p}>{label(p)}</option>)}</select>
            </label>
            <label className="text-sm">Claim / reference number<input name="claimRef" defaultValue={f.claimRef ?? ""} className={inputCls} /></label>
            <label className="text-sm">Service<input name="service" defaultValue={f.service ?? ""} className={inputCls} /></label>
            <label className="text-sm">CPT / HCPCS codes (comma separated)<input name="cptCodes" defaultValue={f.cptCodes.join(", ")} className={inputCls} /></label>
            <label className="text-sm">ICD-10 codes (comma separated)<input name="icdCodes" defaultValue={f.icdCodes.join(", ")} className={inputCls} /></label>
            <label className="text-sm">Denial date<input name="denialDate" type="date" defaultValue={f.denialDate ?? ""} className={inputCls} /></label>
            <label className="text-sm">Appeal deadline
              <input name="appealDeadline" type="date" defaultValue={f.appealDeadline ?? ""} className={inputCls} />
              {!f.appealDeadline && <span className="text-xs text-amber-700">Not found on the letter. Check the letter or ask your plan; don&apos;t assume a date.</span>}
            </label>
            <label className="text-sm">Amount denied ($)<input name="amountDenied" defaultValue={f.amountDeniedCents != null ? (f.amountDeniedCents / 100).toFixed(2) : ""} className={inputCls} /></label>
            <label className="text-sm">Denial type
              <select name="denialType" defaultValue={cls?.primary ?? c.denialType ?? "OTHER"} className={inputCls}>{DENIAL_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select>
            </label>
          </div>
          <label className="block text-sm">Reason the insurer gave<textarea name="denialReason" defaultValue={f.denialReason ?? ""} rows={3} className={inputCls} /></label>
          {cls?.evidence && <p className="text-xs text-slate-500">Classified from: &ldquo;{cls.evidence}&rdquo; (confidence {Math.round(cls.confidence * 100)}%)</p>}
          {cls && cls.secondary.length > 0 && <p className="text-xs text-slate-500">Other reasons mentioned: {cls.secondary.map(label).join(", ")}</p>}
          <button className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white">{a?.confirmedAt ? "Save changes" : "Confirm details"}</button>
        </form>
      )}

      <form action={remove}>
        <input type="hidden" name="caseId" value={c.id} />
        <button className="rounded border border-red-600 px-3 py-1 text-sm text-red-700">Delete this case and all its data</button>
      </form>
    </section>
  );
}
