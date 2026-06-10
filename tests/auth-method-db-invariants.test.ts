import { beforeEach, describe, expect, it } from "vitest";

import { prisma, resetDatabase } from "./helpers/db";

/**
 * These tests target Postgres-level constraints and triggers added in raw
 * migration SQL, so they insert through $executeRaw to prove the database
 * itself rejects invalid rows even if application code misbehaves.
 */
describe("Auth Method and Password Credential database invariants", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function createAccount(email: string) {
    return prisma.userAccount.create({ data: { email } });
  }

  it("requires provider_account_id for GOOGLE Auth Methods", async () => {
    const account = await createAccount("google-null@example.com");

    await expect(
      prisma.$executeRaw`
        INSERT INTO user_auth_method (user_account_id, method_type, provider_account_id)
        VALUES (${account.id}::uuid, 'GOOGLE', NULL)
      `,
    ).rejects.toThrow(/check|constraint/i);
  });

  it("requires provider_account_id to be null for EMAIL_PASSWORD Auth Methods", async () => {
    const account = await createAccount("ep-with-provider@example.com");

    await expect(
      prisma.$executeRaw`
        INSERT INTO user_auth_method (user_account_id, method_type, provider_account_id)
        VALUES (${account.id}::uuid, 'EMAIL_PASSWORD', 'unexpected-sub')
      `,
    ).rejects.toThrow(/check|constraint/i);
  });

  it("rejects Password Credentials that reference a GOOGLE Auth Method", async () => {
    const account = await createAccount("google-cred@example.com");
    const method = await prisma.userAuthMethod.create({
      data: {
        userAccountId: account.id,
        methodType: "GOOGLE",
        providerAccountId: "google-sub-cred",
      },
    });

    await expect(
      prisma.$executeRaw`
        INSERT INTO user_password_credential (user_auth_method_id, password_hash)
        VALUES (${method.id}::uuid, 'argon2id$fake')
      `,
    ).rejects.toThrow(/EMAIL_PASSWORD/i);
  });

  it("accepts Password Credentials on EMAIL_PASSWORD Auth Methods", async () => {
    const account = await createAccount("ep-cred@example.com");
    const method = await prisma.userAuthMethod.create({
      data: { userAccountId: account.id, methodType: "EMAIL_PASSWORD" },
    });

    await prisma.$executeRaw`
      INSERT INTO user_password_credential (user_auth_method_id, password_hash)
      VALUES (${method.id}::uuid, 'argon2id$fake')
    `;

    const credential = await prisma.userPasswordCredential.findUnique({
      where: { userAuthMethodId: method.id },
    });
    expect(credential?.passwordHash).toBe("argon2id$fake");
  });

  it("rejects retyping an EMAIL_PASSWORD Auth Method while it still owns a Password Credential", async () => {
    const account = await createAccount("retype@example.com");
    const method = await prisma.userAuthMethod.create({
      data: { userAccountId: account.id, methodType: "EMAIL_PASSWORD" },
    });
    await prisma.userPasswordCredential.create({
      data: { userAuthMethodId: method.id, passwordHash: "argon2id$fake" },
    });

    await expect(
      prisma.$executeRaw`
        UPDATE user_auth_method
        SET method_type = 'GOOGLE', provider_account_id = 'google-sub-retype'
        WHERE user_auth_method_id = ${method.id}::uuid
      `,
    ).rejects.toThrow(/password credential/i);
  });

  it("cascades Auth Methods and Password Credentials when the owning account is deleted", async () => {
    const account = await createAccount("cascade@example.com");
    const method = await prisma.userAuthMethod.create({
      data: { userAccountId: account.id, methodType: "EMAIL_PASSWORD" },
    });
    await prisma.userPasswordCredential.create({
      data: { userAuthMethodId: method.id, passwordHash: "argon2id$fake" },
    });

    await prisma.userAccount.delete({ where: { id: account.id } });

    expect(
      await prisma.userAuthMethod.findUnique({ where: { id: method.id } }),
    ).toBeNull();
    expect(
      await prisma.userPasswordCredential.findUnique({
        where: { userAuthMethodId: method.id },
      }),
    ).toBeNull();
  });
});
