import type {
  Prisma,
  PrismaClient,
  UserAccount,
} from "../../app/generated/prisma/client";
import type { GoogleIdentity } from "./google-signup";
import { normalizeProfileName } from "./normalize";

type TransactionClient = Prisma.TransactionClient;

export async function findGoogleAuthMethodByProviderIdentity(
  prisma: PrismaClient,
  providerAccountId: string,
) {
  return prisma.userAuthMethod.findUnique({
    where: {
      methodType_providerAccountId: {
        methodType: "GOOGLE",
        providerAccountId,
      },
    },
    include: { userAccount: true },
  });
}

/**
 * Links a Google Auth Method to an existing User Account and fills only
 * missing User Profile names from the provider identity.
 */
export async function linkGoogleAuthMethodToUserAccount(
  prisma: PrismaClient,
  account: UserAccount,
  identity: GoogleIdentity,
) {
  return prisma.$transaction(async (tx) => {
    await tx.userAuthMethod.create({
      data: {
        userAccountId: account.id,
        methodType: "GOOGLE",
        providerAccountId: identity.sub,
      },
    });

    return tx.userAccount.update({
      where: { id: account.id },
      data: {
        firstName: account.firstName ?? normalizeProfileName(identity.firstName),
        lastName: account.lastName ?? normalizeProfileName(identity.lastName),
      },
    });
  });
}

export async function linkEmailPasswordAuthMethodToUserAccount(
  tx: TransactionClient,
  userAccountId: string,
  passwordHash: string,
) {
  await tx.userAuthMethod.create({
    data: {
      userAccountId,
      methodType: "EMAIL_PASSWORD",
      passwordCredential: { create: { passwordHash } },
    },
  });
}
