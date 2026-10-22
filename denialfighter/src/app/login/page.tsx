import { requestLoginLink } from "@/lib/auth";

async function send(formData: FormData) {
  "use server";
  await requestLoginLink(String(formData.get("email") ?? ""), formData.get("consent") === "on");
  const { redirect } = await import("next/navigation");
  redirect("/login?sent=1");
}

export default async function Login({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <section className="max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Sign in</h1>
      {sp.sent && (
        <p className="rounded border border-green-300 bg-green-50 p-3 text-sm">
          If that address is valid, a sign-in link is on its way. It works once and expires in 15 minutes.
        </p>
      )}
      {sp.error && <p className="rounded border border-red-300 bg-red-50 p-3 text-sm">That link is invalid or expired.</p>}
      <form action={send} className="space-y-3">
        <input name="email" type="email" required placeholder="you@example.com" className="w-full rounded border px-3 py-2" />
        <label className="flex items-start gap-2 text-sm">
          <input name="consent" type="checkbox" required className="mt-1" />
          <span>
            I agree to the Terms and Privacy Policy (draft), and understand this is not legal or medical advice and
            that I am the one filing the appeal.
          </span>
        </label>
        <button className="rounded bg-blue-700 px-4 py-2 font-medium text-white">Email me a link</button>
      </form>
    </section>
  );
}
