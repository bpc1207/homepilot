import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import AutoRefresh from "@/app/AutoRefresh";
import { captureEmail, getLeadView } from "@/lib/leads";
import { requestLoginLink } from "@/lib/auth";
import { track } from "@/lib/analytics";

const SIGNAL: Record<string, string> = {
  LIKELY_APPEALABLE: "Looks worth appealing",
  WORTH_REVIEWING: "Worth a closer look",
  HARD: "Harder to appeal, but check the details",
  UNSUPPORTED: "Not supported yet",
  UNCLEAR: "Unclear",
};

async function unlock(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  if ((await cookies()).get("df_lead")?.value !== id) redirect("/");
  const consent = formData.get("consent") === "on";
  const email = await captureEmail(id, String(formData.get("email") ?? ""), consent);
  if (email) {
    await track("email_captured", { anonId: id.slice(0, 8) });
    await requestLoginLink(email, true, `/dashboard/from-check/${id}`);
  }
  redirect(`/check/${id}${email ? "?sent=1" : "?bad=1"}`);
}

export default async function CheckPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ sent?: string; bad?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  if ((await cookies()).get("df_lead")?.value !== id) {
    return <p className="rounded border bg-white p-4 text-sm">This result can only be opened in the browser you uploaded from. <Link className="underline" href="/">Start a new check</Link>.</p>;
  }
  const view = await getLeadView(id);
  if (!view) return <p className="rounded border bg-white p-4 text-sm">This check has expired. <Link className="underline" href="/">Start a new one</Link>.</p>;

  if (view.status === "PROCESSING") {
    return (
      <section className="space-y-3">
        <AutoRefresh />
        <h1 className="text-2xl font-bold">Reading your letter&hellip;</h1>
        <p className="text-sm text-slate-600">This usually takes under a minute.</p>
      </section>
    );
  }
  if (view.status === "FAILED" || !view.result) {
    return (
      <section className="space-y-3">
        <h1 className="text-2xl font-bold">We couldn&apos;t read that file</h1>
        <p className="text-sm">Try a flatter, brighter photo or the original PDF. <Link className="underline" href="/">Try again</Link></p>
      </section>
    );
  }
  const r = view.result;
  return (
    <section className="space-y-5">
      <h1 className="text-2xl font-bold">{r.headline}</h1>
      <p className="inline-block rounded bg-blue-50 px-3 py-1 text-sm font-medium text-blue-900">{SIGNAL[r.signal]}</p>
      {view.emailCaptured ? (
        <div className="space-y-3 rounded border bg-white p-4 text-sm">
          {sp.sent && <p className="rounded bg-green-50 p-2">We emailed you a sign-in link. Open it to save this as a case and build your appeal.</p>}
          {r.insurer && <p><strong>Insurer:</strong> {r.insurer}</p>}
          {r.reasonSummary && <p><strong>Reason given:</strong> {r.reasonSummary}</p>}
          <p><strong>Appeal deadline on the letter:</strong> {r.appealDeadline ?? "Not stated. Check the letter or call your plan; don't assume."}</p>
          <p><strong>What this usually means:</strong> {r.nextStep}</p>
        </div>
      ) : (
        <form action={unlock} className="space-y-3 rounded border bg-white p-4">
          <p className="text-sm">Enter your email to see the reason given, the deadline on your letter and next steps. We&apos;ll also send a sign-in link so you can save the case.</p>
          {sp.bad && <p className="text-sm text-red-700">Please enter a valid email and accept the terms.</p>}
          <input type="hidden" name="id" value={id} />
          <input name="email" type="email" required placeholder="you@example.com" className="w-full rounded border px-3 py-2" />
          <label className="flex items-start gap-2 text-sm">
            <input name="consent" type="checkbox" required className="mt-1" />
            <span>I agree to the Terms and Privacy Policy (draft) and understand this is not legal or medical advice.</span>
          </label>
          <button className="rounded bg-blue-700 px-4 py-2 font-medium text-white">Show full result</button>
        </form>
      )}
      <p className="text-xs text-slate-500">This is an automated reading of your letter and may contain mistakes. It is not legal or medical advice and does not predict the outcome of an appeal.</p>
    </section>
  );
}
