import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { prisma?: PrismaClient };

// No query logging: it would put PHI-adjacent values in logs.
export const prisma = g.prisma ?? new PrismaClient({ log: [] });
if (process.env.NODE_ENV !== "production") g.prisma = prisma;
