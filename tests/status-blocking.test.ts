import { beforeEach, describe, expect, it } from "vitest";

import { changeUserAccountStatus } from "../lib/auth/account-status";
import { signUpWithEmailPassword } from "../lib/auth/email-password-signup";
import { authenticateWithGoogle } from "../lib/auth/google-auth";
import { signUpWithGoogle } from "../lib/auth/google-signup";
import { authenticateWithPassword } from "../lib/auth/password-auth";
import { prisma, resetDatabase } from "./helpers/db";

const VALID_PASSWORD = "Sup3rSecret!";
const BLOCKED_STATUSES = ["DISABLED", "BANNED", "REMOVED"] as const;

describe("Authentication blocking by User Account Status", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("authenticates an Active account with the correct password", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "active@example.com",
      password: VALID_PASSWORD,
    });

    const session = await authenticateWithPassword(prisma, {
      email: "Active@Example.com",
      password: VALID_PASSWORD,
    });

    expect(session.account.id).toBe(account.id);
  });

  it("rejects authentication with a wrong password", async () => {
    await signUpWithEmailPassword(prisma, {
      email: "active@example.com",
      password: VALID_PASSWORD,
    });

    await expect(
      authenticateWithPassword(prisma, {
        email: "active@example.com",
        password: "Wr0ngPassword!",
      }),
    ).rejects.toThrow(/invalid/i);
  });

  it("changes status atomically and records the audit row", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "subject@example.com",
      password: VALID_PASSWORD,
    });
    const admin = await signUpWithEmailPassword(prisma, {
      email: "admin@example.com",
      password: VALID_PASSWORD,
    });

    await changeUserAccountStatus(prisma, {
      userAccountId: account.id,
      newStatus: "DISABLED",
      changedById: admin.id,
      reason: "Payment dispute under review",
    });

    const updated = await prisma.userAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(updated.status).toBe("DISABLED");

    const changes = await prisma.userAccountStatusChange.findMany({
      where: { userAccountId: account.id },
      orderBy: { changedAt: "asc" },
    });
    expect(changes).toHaveLength(2);
    expect(changes[1]?.previousStatus).toBe("ACTIVE");
    expect(changes[1]?.newStatus).toBe("DISABLED");
    expect(changes[1]?.changedById).toBe(admin.id);
    expect(changes[1]?.reason).toBe("Payment dispute under review");
  });

  it.each(BLOCKED_STATUSES)(
    "refuses password Authentication for a %s account",
    async (status) => {
      const account = await signUpWithEmailPassword(prisma, {
        email: "blocked@example.com",
        password: VALID_PASSWORD,
      });
      await changeUserAccountStatus(prisma, {
        userAccountId: account.id,
        newStatus: status,
      });

      await expect(
        authenticateWithPassword(prisma, {
          email: "blocked@example.com",
          password: VALID_PASSWORD,
        }),
      ).rejects.toThrow(new RegExp(status, "i"));
    },
  );

  it.each(BLOCKED_STATUSES)(
    "refuses Google Authentication for a %s account",
    async (status) => {
      const identity = {
        sub: "google-sub-blocked",
        email: "blocked@example.com",
        emailVerified: true,
      };
      const created = await signUpWithGoogle(prisma, identity);
      await changeUserAccountStatus(prisma, {
        userAccountId: created.id,
        newStatus: status,
      });

      await expect(
        authenticateWithGoogle(prisma, identity),
      ).rejects.toThrow(new RegExp(status, "i"));
    },
  );

  it("authenticates an Active account through Google", async () => {
    const identity = {
      sub: "google-sub-ok",
      email: "ok@example.com",
      emailVerified: true,
    };
    const created = await signUpWithGoogle(prisma, identity);

    const { account } = await authenticateWithGoogle(prisma, identity);

    expect(account.id).toBe(created.id);
  });

  it("records automated status changes with a null actor and no reason", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "system@example.com",
      password: VALID_PASSWORD,
    });

    await changeUserAccountStatus(prisma, {
      userAccountId: account.id,
      newStatus: "REMOVED",
    });

    const change = await prisma.userAccountStatusChange.findFirst({
      where: { userAccountId: account.id, newStatus: "REMOVED" },
    });
    expect(change?.changedById).toBeNull();
    expect(change?.reason).toBeNull();
  });

  it("preserves the full audit history across repeated status changes", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "history@example.com",
      password: VALID_PASSWORD,
    });

    await changeUserAccountStatus(prisma, {
      userAccountId: account.id,
      newStatus: "DISABLED",
    });
    await changeUserAccountStatus(prisma, {
      userAccountId: account.id,
      newStatus: "ACTIVE",
    });

    const changes = await prisma.userAccountStatusChange.findMany({
      where: { userAccountId: account.id },
      orderBy: { changedAt: "asc" },
    });
    expect(
      changes.map((c) => [c.previousStatus, c.newStatus]),
    ).toEqual([
      [null, "ACTIVE"],
      ["ACTIVE", "DISABLED"],
      ["DISABLED", "ACTIVE"],
    ]);
  });
});
