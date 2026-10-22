import Link from "next/link";
import { redirect } from "next/navigation";
import { actorFor, requireUser } from "@/lib/auth";
import { createCase, listCases } from "@/lib/phi";
import { track } from "@/lib/analytics";

async function newCase() {
  "use server";
  const user = await requireUser();
  const c = await createCase(await actorFor(user));
  await track("case_created", { userId: user.id });
  redirect(`/dashboard/cases/${c.id}`);
}

export default async function Dashboard() {
  const user = await requireUser();
  const cases = await listCases(await actorFor(user));
  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My cases</h1>
        <form action="/api/auth/logout" method="post">
          <span className="mr-3 text-sm text-slate-600">{user.email}</span>
          <button className="text-sm underline">Sign out</button>
        </form>
      </div>
      <form action={newCase}>
        <button className="rounded bg-blue-700 px-4 py-2 font-medium text-white">Start a new case</button>
      </form>
      <ul className="divide-y rounded border bg-white">
        {cases.length === 0 && <li className="p-4 text-sm text-slate-600">No cases yet.</li>}
        {cases.map((c) => (
          <li key={c.id} className="flex items-center justify-between p-4">
            <Link className="font-medium text-blue-700 hover:underline" href={`/dashboard/cases/${c.id}`}>
              Case {c.id.slice(-6)}
            </Link>
            <span className="text-sm text-slate-600">{c.status.replace("_", " ").toLowerCase()}</span>
          </li>
        ))}
      </ul>
      <Link href="/dashboard/audit" className="text-sm underline">View my access log</Link>
    </section>
  );
}
