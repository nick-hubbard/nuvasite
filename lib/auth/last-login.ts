import type { PrismaClient } from "../../app/generated/prisma/client";

/**
 * Marks the moment a successful Authentication created an active Nuvasite
 * session. Failed attempts, blocked status checks, and signup preparation
 * must never reach this. Returns the account with the fresh Last Login.
 */
export async function recordSessionCreatingLogin(
  prisma: PrismaClient,
  userAccountId: string,
) {
  return prisma.userAccount.update({
    where: { id: userAccountId },
    data: { lastLoginAt: new Date() },
  });
}
