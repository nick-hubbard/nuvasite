import { execSync } from "node:child_process";

import { Client } from "pg";
import { beforeEach, describe, expect, it } from "vitest";

import { changeUserAccountStatus } from "../lib/auth/account-status";
import { addEmailPasswordAuthMethod } from "../lib/auth/add-email-password";
import { signUpWithEmailPassword } from "../lib/auth/email-password-signup";
import { authenticateWithGoogle } from "../lib/auth/google-auth";
import { signUpWithGoogle } from "../lib/auth/google-signup";
import { authenticateWithPassword } from "../lib/auth/password-auth";
import { prisma, resetDatabase } from "./helpers/db";
import { TEST_DATABASE_URL } from "./helpers/test-database-url";

const VALID_PASSWORD = "Sup3rSecret!";

describe("User Account foundation end-to-end on Postgres", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("applies the full migration set to a completely fresh database", async () => {
    const scratchUrl = new URL(TEST_DATABASE_URL);
    const scratchDbName = "nuvasite_migration_check";
    scratchUrl.pathname = `/${scratchDbName}`;

    const adminUrl = new URL(TEST_DATABASE_URL);
    adminUrl.pathname = "/postgres";
    const admin = new Client({ connectionString: adminUrl.toString() });
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${scratchDbName}"`);
      await admin.query(`CREATE DATABASE "${scratchDbName}"`);

      execSync("pnpm exec prisma migrate deploy", {
        stdio: "pipe",
        env: { ...process.env, DATABASE_URL: scratchUrl.toString() },
      });

      const scratch = new Client({ connectionString: scratchUrl.toString() });
      await scratch.connect();
      try {
        const tables = await scratch.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' ORDER BY table_name`,
        );
        const names = tables.rows.map((r) => r.table_name);
        expect(names).toContain("user_account");
        expect(names).toContain("user_auth_method");
        expect(names).toContain("user_password_credential");
        expect(names).toContain("user_account_status_change");
      } finally {
        await scratch.end();
      }

      await admin.query(`DROP DATABASE "${scratchDbName}"`);
    } finally {
      await admin.end();
    }
  });

  it("supports the full account lifecycle across signup, linking, blocking, audit, and Last Login", async () => {
    // Email/password-first signup.
    const account = await signUpWithEmailPassword(prisma, {
      email: "Journey@Example.com",
      password: VALID_PASSWORD,
      firstName: "Jo",
    });
    expect(account.email).toBe("journey@example.com");

    // Google Authentication with the same verified email links, fills only
    // the missing name, and counts as a session-creating login.
    const googleIdentity = {
      sub: "google-sub-journey",
      email: "JOURNEY@example.com",
      emailVerified: true,
      firstName: "Josephine",
      lastName: "Urney",
    };
    const { account: linked } = await authenticateWithGoogle(
      prisma,
      googleIdentity,
    );
    expect(linked.id).toBe(account.id);
    expect(linked.firstName).toBe("Jo");
    expect(linked.lastName).toBe("Urney");
    expect(linked.lastLoginAt).not.toBeNull();
    expect(await prisma.userAccount.count()).toBe(1);

    // Both Auth Methods now authenticate the same account.
    const { account: viaPassword } = await authenticateWithPassword(prisma, {
      email: "journey@example.com",
      password: VALID_PASSWORD,
    });
    expect(viaPassword.id).toBe(account.id);

    // An admin disables the account; both methods are refused and the prior
    // Last Login survives.
    const admin = await signUpWithEmailPassword(prisma, {
      email: "admin@example.com",
      password: VALID_PASSWORD,
    });
    await changeUserAccountStatus(prisma, {
      userAccountId: account.id,
      newStatus: "DISABLED",
      changedById: admin.id,
      reason: "Routine compliance hold",
    });
    await expect(
      authenticateWithPassword(prisma, {
        email: "journey@example.com",
        password: VALID_PASSWORD,
      }),
    ).rejects.toThrow(/disabled/i);
    await expect(
      authenticateWithGoogle(prisma, googleIdentity),
    ).rejects.toThrow(/disabled/i);

    // Reactivation by the system (null actor) restores access.
    await changeUserAccountStatus(prisma, {
      userAccountId: account.id,
      newStatus: "ACTIVE",
    });
    const { account: restored } = await authenticateWithPassword(prisma, {
      email: "journey@example.com",
      password: VALID_PASSWORD,
    });
    expect(restored.status).toBe("ACTIVE");

    // The audit trail is complete from creation, and hard-deleting the
    // actor keeps every row meaningful.
    await prisma.userAccount.delete({ where: { id: admin.id } });
    const history = await prisma.userAccountStatusChange.findMany({
      where: { userAccountId: account.id },
      orderBy: { changedAt: "asc" },
    });
    expect(history.map((c) => [c.previousStatus, c.newStatus])).toEqual([
      [null, "ACTIVE"],
      ["ACTIVE", "DISABLED"],
      ["DISABLED", "ACTIVE"],
    ]);
    expect(history[1]?.changedById).toBeNull();
    expect(history[1]?.reason).toBe("Routine compliance hold");
  });

  it("keeps one account when signing up Google-first and adding email/password later", async () => {
    const identity = {
      sub: "google-sub-first",
      email: "googlefirst@example.com",
      emailVerified: true,
    };
    const account = await signUpWithGoogle(prisma, identity);

    await addEmailPasswordAuthMethod(prisma, {
      userAccountId: account.id,
      password: VALID_PASSWORD,
    });

    const { account: viaPassword } = await authenticateWithPassword(prisma, {
      email: "googlefirst@example.com",
      password: VALID_PASSWORD,
    });
    expect(viaPassword.id).toBe(account.id);
    expect(await prisma.userAccount.count()).toBe(1);
  });

  it("reserves the email of Removed, Disabled, and Banned accounts against new signup", async () => {
    for (const status of ["REMOVED", "DISABLED", "BANNED"] as const) {
      const email = `${status.toLowerCase()}-reserved@example.com`;
      const account = await signUpWithEmailPassword(prisma, {
        email,
        password: VALID_PASSWORD,
      });
      await changeUserAccountStatus(prisma, {
        userAccountId: account.id,
        newStatus: status,
      });

      await expect(
        signUpWithEmailPassword(prisma, { email, password: VALID_PASSWORD }),
      ).rejects.toThrow(/already exists/i);
    }
  });

  it("stores every domain timestamp as timestamptz per the UTC convention", async () => {
    const columns = await prisma.$queryRaw<
      { table_name: string; column_name: string; data_type: string }[]
    >`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (
          'user_account', 'user_auth_method',
          'user_password_credential', 'user_account_status_change'
        )
        AND (column_name LIKE '%_at')
    `;

    expect(columns.length).toBeGreaterThan(0);
    for (const column of columns) {
      expect(
        column.data_type,
        `${column.table_name}.${column.column_name}`,
      ).toBe("timestamp with time zone");
    }
  });

  it("compares stored timestamps consistently in UTC", async () => {
    const before = Date.now();
    const account = await signUpWithEmailPassword(prisma, {
      email: "utc@example.com",
      password: VALID_PASSWORD,
    });
    const after = Date.now();

    // Prisma returns timestamptz as JS Dates anchored to UTC epoch millis,
    // so round-tripping must land between the two wall-clock readings
    // regardless of the local timezone the test runs in.
    expect(account.createdAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(account.createdAt.getTime()).toBeLessThanOrEqual(after + 1000);
  });
});
