import Link from "next/link";
import { actorFor, requireUser } from "@/lib/auth";
import { recentAudit } from "@/lib/phi";

export default async function AuditPage() {
  const user = await requireUser();
  const rows = await recentAudit(await actorFor(user));
  return (
    <section className="space-y-4">
      <Link href="/dashboard" className="text-sm underline">&larr; My cases</Link>
      <h1 className="text-2xl font-bold">Access log</h1>
      <p className="text-sm text-slate-600">Every read or write of your case data is recorded here (IDs only, never content).</p>
      <table className="w-full rounded border bg-white text-sm">
        <thead><tr className="text-left"><th className="p-2">When</th><th className="p-2">Action</th><th className="p-2">Resource</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.at.toISOString().replace("T", " ").slice(0, 19)}</td>
              <td className="p-2">{r.action}</td>
              <td className="p-2">{r.resourceType} {r.resourceId?.slice(-6)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
