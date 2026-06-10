import type { PrismaClient } from "../../app/generated/prisma/client";
import {
  assertVerifiedGoogleEmail,
  signUpWithGoogle,
  type GoogleIdentity,
} from "./google-signup";
import { normalizeProfileName } from "./normalize";

/**
 * Resolves a completed Google OAuth flow to exactly one User Account:
 *
 *   1. A known Google provider identity returns its linked account.
 *   2. A verified Google email matching an existing account links a GOOGLE
 *      Auth Method to that account instead of creating a duplicate.
 *   3. Otherwise this is Google-first signup.
 *
 * Linking fills missing User Profile names from Google but never overwrites
 * existing profile data, and is transactional: a failed link leaves no
 * partial Auth Method or profile changes behind.
 */
export async function authenticateWithGoogle(
  prisma: PrismaClient,
  identity: GoogleIdentity,
) {
  const linkedMethod = await prisma.userAuthMethod.findUnique({
    where: {
      methodType_providerAccountId: {
        methodType: "GOOGLE",
        providerAccountId: identity.sub,
      },
    },
    include: { userAccount: true },
  });
  if (linkedMethod) {
    return linkedMethod.userAccount;
  }

  const email = assertVerifiedGoogleEmail(identity);
  const existing = await prisma.userAccount.findUnique({ where: { email } });
  if (!existing) {
    return signUpWithGoogle(prisma, identity);
  }

  return prisma.$transaction(async (tx) => {
    await tx.userAuthMethod.create({
      data: {
        userAccountId: existing.id,
        methodType: "GOOGLE",
        providerAccountId: identity.sub,
      },
    });

    return tx.userAccount.update({
      where: { id: existing.id },
      data: {
        firstName:
          existing.firstName ?? normalizeProfileName(identity.firstName),
        lastName: existing.lastName ?? normalizeProfileName(identity.lastName),
      },
    });
  });
}
