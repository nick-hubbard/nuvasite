import type {
  PrismaClient,
  UserAccountStatus,
} from "../../app/generated/prisma/client";

export class AccountNotActiveError extends Error {
  constructor(status: UserAccountStatus) {
    super(`User Account is ${status} and cannot authenticate`);
    this.name = "AccountNotActiveError";
  }
}

/**
 * Only an Active account may authenticate and create a Nuvasite session.
 * Disabled, Banned, and Removed accounts remain durable records but are
 * refused here.
 */
export function assertAccountCanAuthenticate(account: {
  status: UserAccountStatus;
}): void {
  if (account.status !== "ACTIVE") {
    throw new AccountNotActiveError(account.status);
  }
}

export interface StatusChangeInput {
  userAccountId: string;
  newStatus: UserAccountStatus;
  /** Null/omitted for automated or system-initiated changes. */
  changedById?: string | null;
  /** Optional at the data layer; UX flows may require one. */
  reason?: string | null;
}

/**
 * Applies a User Account Status change and records the audit Status Change
 * (previous status, new status, optional actor, optional reason, timestamp)
 * in one transaction.
 */
export async function changeUserAccountStatus(
  prisma: PrismaClient,
  input: StatusChangeInput,
) {
  return prisma.$transaction(async (tx) => {
    const account = await tx.userAccount.findUniqueOrThrow({
      where: { id: input.userAccountId },
    });

    const updated = await tx.userAccount.update({
      where: { id: account.id },
      data: { status: input.newStatus },
    });

    await tx.userAccountStatusChange.create({
      data: {
        userAccountId: account.id,
        previousStatus: account.status,
        newStatus: input.newStatus,
        changedById: input.changedById ?? null,
        reason: input.reason ?? null,
      },
    });

    return updated;
  });
}
