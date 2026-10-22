import { PrismaClient } from "@prisma/client";
import { newDataKey } from "../src/lib/crypto";

// Synthetic data only. Never seed real names, claims or letters.
const prisma = new PrismaClient();

async function main() {
  await prisma.user.upsert({ where: { email: "admin@example.test" }, update: {}, create: { email: "admin@example.test", role: "ADMIN" } });
  const demo = await prisma.user.upsert({ where: { email: "demo@example.test" }, update: {}, create: { email: "demo@example.test" } });
  if ((await prisma.case.count({ where: { userId: demo.id } })) === 0) {
    const { wrapped } = await newDataKey();
    await prisma.case.create({
      data: { userId: demo.id, dataKeyWrapped: wrapped, events: { create: { toStatus: "DRAFT" } } },
    });
  }
  console.log("Seeded synthetic users: demo@example.test, admin@example.test");
}

main().finally(() => prisma.$disconnect());
