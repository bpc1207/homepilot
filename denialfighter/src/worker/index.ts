import PgBoss from "pg-boss";
import { prisma } from "../lib/db";
import { log, errorFields } from "../lib/logger";
import { env } from "../lib/env";
import { storage } from "../lib/storage";
import { handlers } from "../lib/intake";
import { QUEUES, type JobData } from "../lib/jobs";

const PURGE = QUEUES.PURGE;

/** Delete anonymous Denial Checker uploads past their TTL, including stored objects. */
export async function purgeExpiredLeads(now = new Date()): Promise<number> {
  const expired = await prisma.lead.findMany({ where: { expiresAt: { lt: now }, convertedCaseId: null } });
  for (const l of expired) {
    if (l.storageKey) await storage().delete(l.storageKey).catch(() => undefined);
  }
  const res = await prisma.lead.deleteMany({ where: { id: { in: expired.map((l) => l.id) } } });
  return res.count;
}

async function main() {
  env(); // fail fast on bad config
  const boss = new PgBoss(process.env.DATABASE_URL!);
  boss.on("error", (err) => log.error("worker.boss_error", err));
  await boss.start();

  await boss.createQueue(PURGE);
  await boss.schedule(PURGE, "*/15 * * * *");
  await boss.work(PURGE, async () => {
    try {
      const count = await purgeExpiredLeads();
      log.info("worker.purge_leads", { queue: PURGE, count });
    } catch (err) {
      log.error("worker.purge_failed", err, { queue: PURGE });
      throw new Error(errorFields(err).code); // no message passthrough
    }
  });
  for (const queue of [QUEUES.INTAKE, QUEUES.CHECKER]) {
    await boss.createQueue(queue);
    await boss.work<JobData>(queue, { batchSize: 2 }, async (jobs) => {
      for (const job of jobs) {
        try {
          await handlers[queue](job.data);
        } catch (err) {
          log.error("worker.job_failed", err, { queue, jobId: job.id });
          throw new Error(errorFields(err).code);
        }
      }
    });
  }
  // Phase 3: strategy_letter, packet_pdf. Phase 4: reminders.
  log.info("worker.started");

  const stop = async () => { await boss.stop(); await prisma.$disconnect(); process.exit(0); };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

if (process.argv[1]?.endsWith("worker/index.ts") || process.argv[1]?.endsWith("worker/index.js")) {
  main().catch((err) => { log.error("worker.fatal", err); process.exit(1); });
}
