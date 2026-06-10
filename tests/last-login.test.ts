import { beforeEach, describe, expect, it } from "vitest";

import { changeUserAccountStatus } from "../lib/auth/account-status";
import { signUpWithEmailPassword } from "../lib/auth/email-password-signup";
import { authenticateWithGoogle } from "../lib/auth/google-auth";
import { signUpWithGoogle } from "../lib/auth/google-signup";
import { authenticateWithPassword } from "../lib/auth/password-auth";
import { prisma, resetDatabase } from "./helpers/db";

const VALID_PASSWORD = "Sup3rSecret!";

async function lastLoginOf(accountId: string) {
  const account = await prisma.userAccount.findUniqueOrThrow({
    where: { id: accountId },
  });
  return account.lastLoginAt;
}

describe("Last Login semantics", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("updates Last Login after successful password Authentication", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "pw@example.com",
      password: VALID_PASSWORD,
    });
    expect(await lastLoginOf(account.id)).toBeNull();

    const before = new Date();
    await authenticateWithPassword(prisma, {
      email: "pw@example.com",
      password: VALID_PASSWORD,
    });

    const lastLogin = await lastLoginOf(account.id);
    expect(lastLogin).not.toBeNull();
    expect(lastLogin!.getTime()).toBeGreaterThanOrEqual(before.getTime() - 1000);
  });

  it("updates Last Login after successful Google Authentication", async () => {
    const identity = {
      sub: "google-sub-login",
      email: "g@example.com",
      emailVerified: true,
    };
    const account = await signUpWithGoogle(prisma, identity);
    expect(await lastLoginOf(account.id)).toBeNull();

    await authenticateWithGoogle(prisma, identity);

    expect(await lastLoginOf(account.id)).not.toBeNull();
  });

  it("does not update Last Login after failed password validation", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "pw@example.com",
      password: VALID_PASSWORD,
    });

    await expect(
      authenticateWithPassword(prisma, {
        email: "pw@example.com",
        password: "Wr0ngPassword!",
      }),
    ).rejects.toThrow(/invalid/i);

    expect(await lastLoginOf(account.id)).toBeNull();
  });

  it("preserves the previous Last Login when Authentication is blocked by status", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "pw@example.com",
      password: VALID_PASSWORD,
    });
    await authenticateWithPassword(prisma, {
      email: "pw@example.com",
      password: VALID_PASSWORD,
    });
    const firstLogin = await lastLoginOf(account.id);
    expect(firstLogin).not.toBeNull();

    await changeUserAccountStatus(prisma, {
      userAccountId: account.id,
      newStatus: "DISABLED",
    });
    await expect(
      authenticateWithPassword(prisma, {
        email: "pw@example.com",
        password: VALID_PASSWORD,
      }),
    ).rejects.toThrow(/disabled/i);

    expect((await lastLoginOf(account.id))?.getTime()).toBe(
      firstLogin!.getTime(),
    );
  });

  it("does not update Last Login when blocked Google Authentication is attempted", async () => {
    const identity = {
      sub: "google-sub-blocked-login",
      email: "gb@example.com",
      emailVerified: true,
    };
    const account = await signUpWithGoogle(prisma, identity);
    await changeUserAccountStatus(prisma, {
      userAccountId: account.id,
      newStatus: "BANNED",
    });

    await expect(authenticateWithGoogle(prisma, identity)).rejects.toThrow(
      /banned/i,
    );

    expect(await lastLoginOf(account.id)).toBeNull();
  });

  it("stores Last Login as a timezone-aware UTC timestamp", async () => {
    await signUpWithEmailPassword(prisma, {
      email: "tz@example.com",
      password: VALID_PASSWORD,
    });
    await authenticateWithPassword(prisma, {
      email: "tz@example.com",
      password: VALID_PASSWORD,
    });

    const columns = await prisma.$queryRaw<{ data_type: string }[]>`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'user_account' AND column_name = 'last_login_at'
    `;
    expect(columns[0]?.data_type).toBe("timestamp with time zone");
  });
});
