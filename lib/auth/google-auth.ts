import type { PrismaClient } from "../../app/generated/prisma/client";
import { assertAccountCanAuthenticate } from "./account-status";
import {
  findGoogleAuthMethodByProviderIdentity,
  linkGoogleAuthMethodToUserAccount,
} from "./auth-method-linking";
import { completeAuthentication } from "./completed-authentication";
import {
  assertVerifiedGoogleEmail,
  signUpWithGoogle,
  type GoogleIdentity,
} from "./google-signup";
import { isUniqueConstraintError } from "./prisma-errors";

/**
 * Google Authentication. Resolves a completed Google OAuth flow to exactly
 * one User Account:
 *
 *   1. A known Google provider identity returns its linked account.
 *   2. A verified Google email matching an existing account links a GOOGLE
 *      Auth Method to that account instead of creating a duplicate.
 *   3. Otherwise this is Google-first signup.
 *
 * Only an Active account may complete Authentication; blocked accounts are
 * refused before any linking side effects. Linking fills missing User
 * Profile names from Google but never overwrites existing profile data, and
 * is transactional: a failed link leaves no partial Auth Method or profile
 * changes behind. Returns the authenticated account as the session payload;
 * session persistence itself is out of scope for v1.
 */
export async function authenticateWithGoogle(
  prisma: PrismaClient,
  identity: GoogleIdentity,
) {
  async function authenticateLinkedProviderIdentity() {
    const method = await findGoogleAuthMethodByProviderIdentity(
      prisma,
      identity.sub,
    );
    if (!method) {
      return null;
    }
    return completeAuthentication(prisma, method.userAccount);
  }

  const linkedAuthentication = await authenticateLinkedProviderIdentity();
  if (linkedAuthentication) {
    return linkedAuthentication;
  }

  const email = assertVerifiedGoogleEmail(identity);
  const existing = await prisma.userAccount.findUnique({ where: { email } });
  if (!existing) {
    try {
      const created = await signUpWithGoogle(prisma, identity);
      return completeAuthentication(prisma, created);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const racedAuthentication = await authenticateLinkedProviderIdentity();
        if (racedAuthentication) {
          return racedAuthentication;
        }
      }
      throw error;
    }
  }

  assertAccountCanAuthenticate(existing);

  try {
    const linked = await linkGoogleAuthMethodToUserAccount(
      prisma,
      existing,
      identity,
    );

    return completeAuthentication(prisma, linked);
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedAuthentication = await authenticateLinkedProviderIdentity();
      if (racedAuthentication) {
        return racedAuthentication;
      }
    }
    throw error;
  }
}
