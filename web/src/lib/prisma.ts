import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

/**
 * In development, do not reuse a global `PrismaClient`. After `npx prisma generate`, the old
 * instance would still be used (unknown relations / fields) until a full process restart.
 * Production keeps one client on `globalThis` to avoid connection exhaustion under serverless.
 */
export const prisma =
  process.env.NODE_ENV === "production"
    ? (globalForPrisma.prisma ??= createPrismaClient())
    : createPrismaClient();
