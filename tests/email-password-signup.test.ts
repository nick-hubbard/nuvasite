import { beforeEach, describe, expect, it } from "vitest";

import { EmailAlreadyInUseError } from "../lib/auth/errors";
import { signUpWithEmailPassword } from "../lib/auth/email-password-signup";
import { prisma, resetDatabase } from "./helpers/db";

const VALID_PASSWORD = "Sup3rSecret!";

describe("Email/password signup", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates an Active account with auth method, credential, and initial Status Change", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "ada@example.com",
      password: VALID_PASSWORD,
    });

    expect(account.email).toBe("ada@example.com");
    expect(account.status).toBe("ACTIVE");

    const methods = await prisma.userAuthMethod.findMany({
      where: { userAccountId: account.id },
      include: { passwordCredential: true },
    });
    expect(methods).toHaveLength(1);
    expect(methods[0]?.methodType).toBe("EMAIL_PASSWORD");
    expect(methods[0]?.providerAccountId).toBeNull();
    expect(methods[0]?.passwordCredential).not.toBeNull();

    const statusChanges = await prisma.userAccountStatusChange.findMany({
      where: { userAccountId: account.id },
    });
    expect(statusChanges).toHaveLength(1);
    expect(statusChanges[0]?.previousStatus).toBeNull();
    expect(statusChanges[0]?.newStatus).toBe("ACTIVE");
    expect(statusChanges[0]?.changedById).toBeNull();
  });

  it("lowercases the email before storage", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "  Ada.Lovelace@Example.COM ",
      password: VALID_PASSWORD,
    });

    expect(account.email).toBe("ada.lovelace@example.com");
  });

  it.each([
    ["short", "Ab1!"],
    ["no special character", "Abcdefgh1"],
    ["no uppercase", "abcdefgh1!"],
    ["no lowercase", "ABCDEFGH1!"],
  ])("rejects a password that is %s without creating an account", async (_label, password) => {
    await expect(
      signUpWithEmailPassword(prisma, { email: "weak@example.com", password }),
    ).rejects.toThrow(/password/i);

    expect(
      await prisma.userAccount.findUnique({
        where: { email: "weak@example.com" },
      }),
    ).toBeNull();
  });

  it("persists only a password hash, never the plaintext", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "hash@example.com",
      password: VALID_PASSWORD,
    });

    const credential = await prisma.userPasswordCredential.findFirst({
      where: { authMethod: { userAccountId: account.id } },
    });

    expect(credential).not.toBeNull();
    expect(credential?.passwordHash).not.toContain(VALID_PASSWORD);
    expect(credential?.passwordHash.length).toBeGreaterThan(32);
  });

  it("trims optional profile names while preserving user-provided casing", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "names@example.com",
      password: VALID_PASSWORD,
      firstName: "  deAndre ",
      lastName: " VAN der Berg  ",
    });

    expect(account.firstName).toBe("deAndre");
    expect(account.lastName).toBe("VAN der Berg");
  });

  it("treats whitespace-only profile names as absent", async () => {
    const account = await signUpWithEmailPassword(prisma, {
      email: "blank-names@example.com",
      password: VALID_PASSWORD,
      firstName: "   ",
    });

    expect(account.firstName).toBeNull();
  });

  it("rejects duplicate signup with the same email in any casing, leaving no partial records", async () => {
    await signUpWithEmailPassword(prisma, {
      email: "dupe@example.com",
      password: VALID_PASSWORD,
    });

    await expect(
      signUpWithEmailPassword(prisma, {
        email: "DUPE@Example.com",
        password: VALID_PASSWORD,
      }),
    ).rejects.toThrow(/already exists/i);

    expect(await prisma.userAccount.count()).toBe(1);
    expect(await prisma.userAuthMethod.count()).toBe(1);
    expect(await prisma.userPasswordCredential.count()).toBe(1);
    expect(await prisma.userAccountStatusChange.count()).toBe(1);
  });

  it("maps database duplicate races to the email-in-use domain error", async () => {
    const results = await Promise.allSettled([
      signUpWithEmailPassword(prisma, {
        email: "race@example.com",
        password: VALID_PASSWORD,
      }),
      signUpWithEmailPassword(prisma, {
        email: "RACE@example.com",
        password: VALID_PASSWORD,
      }),
    ]);

    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status).toBe("rejected");
    if (rejected?.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(EmailAlreadyInUseError);
    }
    expect(await prisma.userAccount.count()).toBe(1);
  });
});
