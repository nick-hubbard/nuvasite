import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../../app/generated/prisma/client";
import { TEST_DATABASE_URL } from "./test-database-url";

const globalForTestPrisma = globalThis as unknown as {
  testPrisma?: PrismaClient;
};

export const prisma =
  globalForTestPrisma.testPrisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: TEST_DATABASE_URL }),
  });

globalForTestPrisma.testPrisma = prisma;

/**
 * Empties every domain table between tests so each test starts from a clean
 * database without re-running migrations.
 */
export async function resetDatabase() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "user_account" RESTART IDENTITY CASCADE`,
  );
}
