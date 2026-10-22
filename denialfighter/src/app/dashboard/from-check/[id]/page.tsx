import { redirect } from "next/navigation";
import { actorFor, requireUser } from "@/lib/auth";
import { convertLead } from "@/lib/leads";
import { NotFoundError } from "@/lib/phi";

export default async function FromCheck({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  let caseId: string;
  try {
    caseId = await convertLead(await actorFor(user), user.email, id);
  } catch (e) {
    if (e instanceof NotFoundError) redirect("/dashboard");
    throw e;
  }
  redirect(`/dashboard/cases/${caseId}`);
}
