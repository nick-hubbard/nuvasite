import type { Prisma } from "../../app/generated/prisma/client";

type TransactionClient = Prisma.TransactionClient;

/**
 * Records the initial null-to-Active Status Change so audit history is
 * complete from account creation, regardless of signup path.
 */
export async function recordInitialActiveStatus(
  tx: TransactionClient,
  userAccountId: string,
) {
  await tx.userAccountStatusChange.create({
    data: {
      userAccountId,
      previousStatus: null,
      newStatus: "ACTIVE",
      changedById: null,
    },
  });
}
