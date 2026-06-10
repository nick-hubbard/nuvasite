import type { PrismaClient } from "../../app/generated/prisma/client";
import { EmailAlreadyInUseError } from "./errors";
import { linkEmailPasswordAuthMethodToUserAccount } from "./auth-method-linking";
import { normalizeEmail, normalizeProfileName } from "./normalize";
import { hashPassword } from "./password";
import { assertPasswordMeetsPolicy } from "./password-policy";
import { isUniqueConstraintError } from "./prisma-errors";
import { recordInitialActiveStatus } from "./signup-records";

export interface EmailPasswordSignupInput {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
}

/**
 * Creates one Active User Account with its EMAIL_PASSWORD Auth Method,
 * Password Credential, and initial null-to-Active Status Change in a single
 * transaction. In v1 this counts as completed Authentication without a
 * separate email verification step.
 */
export async function signUpWithEmailPassword(
  prisma: PrismaClient,
  input: EmailPasswordSignupInput,
) {
  const email = normalizeEmail(input.email);
  assertPasswordMeetsPolicy(input.password);
  const passwordHash = await hashPassword(input.password);

  const existing = await prisma.userAccount.findUnique({ where: { email } });
  if (existing) {
    throw new EmailAlreadyInUseError(email);
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.userAccount.create({
        data: {
          email,
          firstName: normalizeProfileName(input.firstName),
          lastName: normalizeProfileName(input.lastName),
          status: "ACTIVE",
        },
      });

      await linkEmailPasswordAuthMethodToUserAccount(
        tx,
        account.id,
        passwordHash,
      );
      await recordInitialActiveStatus(tx, account.id);

      return account;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new EmailAlreadyInUseError(email);
    }
    throw error;
  }
}
