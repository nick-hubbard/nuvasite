import type {
  PrismaClient,
  UserAccountStatus,
} from "../../app/generated/prisma/client";
import { assertAccountCanAuthenticate } from "./account-status";
import { recordSessionCreatingLogin } from "./last-login";

export interface AuthenticatableAccount {
  id: string;
  status: UserAccountStatus;
}

/**
 * Completes Authentication after an Auth Method has proven account control.
 * This is the only path that turns a verified account into a session payload:
 * it applies the Active status gate and records Last Login together.
 */
export async function completeAuthentication(
  prisma: PrismaClient,
  account: AuthenticatableAccount,
) {
  assertAccountCanAuthenticate(account);

  return {
    account: await recordSessionCreatingLogin(prisma, account.id),
  };
}
