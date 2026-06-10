import type { PrismaClient } from "../../app/generated/prisma/client";
import { assertAccountCanAuthenticate } from "./account-status";
import { recordSessionCreatingLogin } from "./last-login";
import { normalizeEmail } from "./normalize";
import { verifyPassword } from "./password";

export class InvalidCredentialsError extends Error {
  constructor() {
    super("Invalid email or password");
    this.name = "InvalidCredentialsError";
  }
}

export interface PasswordAuthenticationInput {
  email: string;
  password: string;
}

/**
 * Email/password Authentication. Verifies the Password Credential, then
 * requires an Active account before the Authentication counts as
 * session-creating. Returns the authenticated account as the session
 * payload; session persistence itself is out of scope for v1.
 */
export async function authenticateWithPassword(
  prisma: PrismaClient,
  input: PasswordAuthenticationInput,
) {
  const email = normalizeEmail(input.email);

  const account = await prisma.userAccount.findUnique({
    where: { email },
    include: {
      authMethods: {
        where: { methodType: "EMAIL_PASSWORD" },
        include: { passwordCredential: true },
      },
    },
  });

  const credential = account?.authMethods[0]?.passwordCredential;
  if (!account || !credential) {
    throw new InvalidCredentialsError();
  }
  if (!verifyPassword(input.password, credential.passwordHash)) {
    throw new InvalidCredentialsError();
  }

  assertAccountCanAuthenticate(account);

  return { account: await recordSessionCreatingLogin(prisma, account.id) };
}
