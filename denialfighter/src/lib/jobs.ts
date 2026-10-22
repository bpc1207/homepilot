import PgBoss from "pg-boss";
import { env } from "./env";
import { log } from "./logger";

export const QUEUES = { INTAKE: "intake", CHECKER: "checker", PURGE: "purge-expired-leads" } as const;
export type JobData = { caseId?: string; docId?: string; leadId?: string };

let boss: Promise<PgBoss> | undefined;
function getBoss() {
  boss ??= (async () => {
    const b = new PgBoss(process.env.DATABASE_URL!);
    b.on("error", (err) => log.error("jobs.boss_error", err));
    await b.start();
    for (const q of Object.values(QUEUES)) await b.createQueue(q);
    return b;
  })();
  return boss;
}

/** Job payloads carry IDs only, never document content. */
export async function enqueue(queue: (typeof QUEUES)[keyof typeof QUEUES], data: JobData) {
  if (env().JOBS_DRIVER === "inline") {
    const { handlers } = await import("./intake");
    void handlers[queue]?.(data).catch((err) => log.error("jobs.inline_failed", err, { queue }));
    return;
  }
  await (await getBoss()).send(queue, data, { retryLimit: 2, retryDelay: 30, expireInSeconds: 600 });
}
