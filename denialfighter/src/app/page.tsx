import Link from "next/link";

export default function Home() {
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">Got a denied claim? Build your appeal in minutes.</h1>
      <p className="max-w-2xl text-slate-700">
        Upload your denial letter, confirm a few details, and get a ready-to-send appeal letter, a checklist of
        supporting documents, and deadline reminders. You send the appeal yourself.
      </p>
      <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
        Phase 1 preview: sign-in, secure case storage and uploads are live. The free Denial Checker and AI letter
        generation arrive in the next phases.
      </p>
      <Link href="/login" className="inline-block rounded bg-blue-700 px-4 py-2 font-medium text-white">
        Sign in with email
      </Link>
    </section>
  );
}
