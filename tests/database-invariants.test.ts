import { beforeEach, describe, expect, it } from "vitest";

import { prisma, resetDatabase } from "./helpers/db";

describe("User Account database invariants", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  async function createAccount(email: string) {
    return prisma.userAccount.create({ data: { email } });
  }

  describe("User Account identity", () => {
    it("persists a User Account and reads it back by email", async () => {
      const created = await createAccount("ada@example.com");

      const found = await prisma.userAccount.findUnique({
        where: { email: "ada@example.com" },
      });

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.email).toBe("ada@example.com");
    });

    it("reserves an email address even while the account is Removed, Disabled, or Banned", async () => {
      for (const status of ["REMOVED", "DISABLED", "BANNED"] as const) {
        const email = `${status.toLowerCase()}@example.com`;
        await prisma.userAccount.create({ data: { email, status } });

        await expect(
          prisma.userAccount.create({ data: { email } }),
        ).rejects.toThrow(/unique/i);
      }
    });

    it("rejects uppercase email writes at the database layer", async () => {
      await expect(
        prisma.userAccount.create({
          data: { email: "Ada@Example.com" },
        }),
      ).rejects.toThrow(/lowercase|check/i);
    });

    it("defaults a new account to Active with optional profile names and UUID identity", async () => {
      const account = await createAccount("grace@example.com");

      expect(account.status).toBe("ACTIVE");
      expect(account.firstName).toBeNull();
      expect(account.lastName).toBeNull();
      expect(account.lastLoginAt).toBeNull();
      expect(account.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(account.createdAt).toBeInstanceOf(Date);
      expect(account.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe("Status Change audit history", () => {
    it("records an initial null-to-Active Status Change with optional actor and reason", async () => {
      const account = await createAccount("lin@example.com");

      const initial = await prisma.userAccountStatusChange.create({
        data: { userAccountId: account.id, newStatus: "ACTIVE" },
      });

      expect(initial.previousStatus).toBeNull();
      expect(initial.newStatus).toBe("ACTIVE");
      expect(initial.changedById).toBeNull();
      expect(initial.reason).toBeNull();
      expect(initial.changedAt).toBeInstanceOf(Date);
    });

    it("records later Status Changes with previous status, actor, and reason", async () => {
      const account = await createAccount("subject@example.com");
      const admin = await createAccount("admin@example.com");

      const change = await prisma.userAccountStatusChange.create({
        data: {
          userAccountId: account.id,
          previousStatus: "ACTIVE",
          newStatus: "BANNED",
          changedById: admin.id,
          reason: "Terms of service violation",
        },
      });

      expect(change.previousStatus).toBe("ACTIVE");
      expect(change.newStatus).toBe("BANNED");
      expect(change.changedById).toBe(admin.id);
      expect(change.reason).toBe("Terms of service violation");
    });

    it("preserves Status Change history when the actor account is hard-deleted", async () => {
      const account = await createAccount("subject@example.com");
      const admin = await createAccount("admin@example.com");
      const change = await prisma.userAccountStatusChange.create({
        data: {
          userAccountId: account.id,
          previousStatus: "ACTIVE",
          newStatus: "DISABLED",
          changedById: admin.id,
        },
      });

      await prisma.userAccount.delete({ where: { id: admin.id } });

      const survivor = await prisma.userAccountStatusChange.findUnique({
        where: { id: change.id },
      });
      expect(survivor).not.toBeNull();
      expect(survivor?.changedById).toBeNull();
      expect(survivor?.newStatus).toBe("DISABLED");
    });
  });

  describe("Auth Method identity", () => {
    it("allows at most one Auth Method of each type per User Account", async () => {
      const account = await createAccount("multi@example.com");

      await prisma.userAuthMethod.create({
        data: { userAccountId: account.id, methodType: "EMAIL_PASSWORD" },
      });
      await prisma.userAuthMethod.create({
        data: {
          userAccountId: account.id,
          methodType: "GOOGLE",
          providerAccountId: "google-sub-1",
        },
      });

      await expect(
        prisma.userAuthMethod.create({
          data: { userAccountId: account.id, methodType: "EMAIL_PASSWORD" },
        }),
      ).rejects.toThrow(/unique/i);
    });

    it("prevents one OAuth Provider Identity from linking to multiple User Accounts", async () => {
      const first = await createAccount("first@example.com");
      const second = await createAccount("second@example.com");

      await prisma.userAuthMethod.create({
        data: {
          userAccountId: first.id,
          methodType: "GOOGLE",
          providerAccountId: "google-sub-shared",
        },
      });

      await expect(
        prisma.userAuthMethod.create({
          data: {
            userAccountId: second.id,
            methodType: "GOOGLE",
            providerAccountId: "google-sub-shared",
          },
        }),
      ).rejects.toThrow(/unique/i);
    });

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
  });

  describe("Password Credential consistency", () => {
    it("links exactly one Password Credential to an email/password Auth Method", async () => {
      const account = await createAccount("pw@example.com");
      const method = await prisma.userAuthMethod.create({
        data: { userAccountId: account.id, methodType: "EMAIL_PASSWORD" },
      });

      await prisma.userPasswordCredential.create({
        data: { userAuthMethodId: method.id, passwordHash: "argon2id$fake" },
      });

      await expect(
        prisma.userPasswordCredential.create({
          data: { userAuthMethodId: method.id, passwordHash: "argon2id$other" },
        }),
      ).rejects.toThrow(/unique/i);
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
});
