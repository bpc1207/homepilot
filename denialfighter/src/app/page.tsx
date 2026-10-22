import Link from "next/link";

const ERRORS: Record<string, string> = {
  upload: "Please upload a PDF, PNG or JPEG under 15 MB.",
  rate: "Too many uploads from this connection. Please try again in an hour.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Got a denied claim? Find out why, and whether it&apos;s worth appealing.</h1>
      <p className="max-w-2xl text-slate-700">
        Upload your denial letter (PDF or a phone photo) for a free instant summary. Then build a ready-to-send appeal
        letter, a checklist of supporting documents, and deadline reminders. You send the appeal yourself.
      </p>
      {error && ERRORS[error] && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm">{ERRORS[error]}</p>}
      <form action="/api/checker" method="post" encType="multipart/form-data" className="space-y-3 rounded border bg-white p-4">
        <h2 className="font-semibold">Free Denial Checker</h2>
        <input name="file" type="file" accept="application/pdf,image/png,image/jpeg" capture="environment" required className="text-sm" />
        <p className="text-xs text-slate-500">
          Your upload is encrypted and deleted after 24 hours unless you save it to an account. Use your own letter only.
        </p>
        <button className="rounded bg-blue-700 px-4 py-2 font-medium text-white">Check my letter</button>
      </form>
      <p className="text-sm text-slate-600">
        Already have an account? <Link href="/login" className="underline">Sign in</Link>
      </p>
    </section>
  );
}
