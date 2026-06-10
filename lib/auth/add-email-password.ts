import type { PrismaClient } from "../../app/generated/prisma/client";
import { hashPassword } from "./password";
import { assertPasswordMeetsPolicy } from "./password-policy";
import { createEmailPasswordMethod } from "./signup-records";

export interface AddEmailPasswordInput {
  userAccountId: string;
  password: string;
}

/**
 * Adds email/password Authentication to an existing User Account (typically
 * one created Google-first). Creates the EMAIL_PASSWORD Auth Method and its
 * Password Credential atomically; a failure leaves neither behind.
 */
export async function addEmailPasswordAuthMethod(
  prisma: PrismaClient,
  input: AddEmailPasswordInput,
) {
  assertPasswordMeetsPolicy(input.password);
  const passwordHash = hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    await createEmailPasswordMethod(tx, input.userAccountId, passwordHash);

    return tx.userAccount.findUniqueOrThrow({
      where: { id: input.userAccountId },
    });
  });
}
