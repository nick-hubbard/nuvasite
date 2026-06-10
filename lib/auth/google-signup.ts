import type { PrismaClient } from "../../app/generated/prisma/client";
import { normalizeEmail, normalizeProfileName } from "./normalize";

/**
 * The identity claims Nuvasite consumes from a completed Google OAuth flow.
 * Deliberately excludes access and refresh tokens: Nuvasite sessions are
 * independent of Google tokens, and tokens are never persisted.
 */
export interface GoogleIdentity {
  /** Google's stable OAuth Provider Identity (the `sub` claim). */
  sub: string;
  email?: string | null;
  emailVerified: boolean;
  firstName?: string | null;
  lastName?: string | null;
}

export class GoogleEmailNotVerifiedError extends Error {
  constructor() {
    super(
      "Google signup requires a verified email address from the provider",
    );
    this.name = "GoogleEmailNotVerifiedError";
  }
}

export function assertVerifiedGoogleEmail(identity: GoogleIdentity): string {
  if (!identity.email || !identity.emailVerified) {
    throw new GoogleEmailNotVerifiedError();
  }
  return normalizeEmail(identity.email);
}

/**
 * Google-first signup: creates one Active User Account and its GOOGLE Auth
 * Method keyed by Google's stable `sub`, plus the initial null-to-Active
 * Status Change, atomically. Google profile names fill the User Profile,
 * trimmed but preserving provider casing.
 */
export async function signUpWithGoogle(
  prisma: PrismaClient,
  identity: GoogleIdentity,
) {
  const email = assertVerifiedGoogleEmail(identity);

  return prisma.$transaction(async (tx) => {
    const account = await tx.userAccount.create({
      data: {
        email,
        firstName: normalizeProfileName(identity.firstName),
        lastName: normalizeProfileName(identity.lastName),
        status: "ACTIVE",
      },
    });

    await tx.userAuthMethod.create({
      data: {
        userAccountId: account.id,
        methodType: "GOOGLE",
        providerAccountId: identity.sub,
      },
    });

    await tx.userAccountStatusChange.create({
      data: {
        userAccountId: account.id,
        previousStatus: null,
        newStatus: "ACTIVE",
        changedById: null,
      },
    });

    return account;
  });
}
