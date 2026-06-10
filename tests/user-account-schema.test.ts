import { beforeEach, describe, expect, it } from "vitest";

import { prisma, resetDatabase } from "./helpers/db";

describe("User Account schema foundation", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("persists a User Account and reads it back by email", async () => {
    const created = await prisma.userAccount.create({
      data: { email: "ada@example.com" },
    });

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

  it("defaults a new account to Active with optional profile names and UUID identity", async () => {
    const account = await prisma.userAccount.create({
      data: { email: "grace@example.com" },
    });

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

  it("records an initial null-to-Active Status Change with optional actor and reason", async () => {
    const account = await prisma.userAccount.create({
      data: { email: "lin@example.com" },
    });

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
    const account = await prisma.userAccount.create({
      data: { email: "subject@example.com" },
    });
    const admin = await prisma.userAccount.create({
      data: { email: "admin@example.com" },
    });

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
    const account = await prisma.userAccount.create({
      data: { email: "subject@example.com" },
    });
    const admin = await prisma.userAccount.create({
      data: { email: "admin@example.com" },
    });
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

  it("allows at most one Auth Method of each type per User Account", async () => {
    const account = await prisma.userAccount.create({
      data: { email: "multi@example.com" },
    });

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
    const first = await prisma.userAccount.create({
      data: { email: "first@example.com" },
    });
    const second = await prisma.userAccount.create({
      data: { email: "second@example.com" },
    });

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

  it("links exactly one Password Credential to an email/password Auth Method", async () => {
    const account = await prisma.userAccount.create({
      data: { email: "pw@example.com" },
    });
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
});
