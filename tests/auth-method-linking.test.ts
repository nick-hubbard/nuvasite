import { beforeEach, describe, expect, it } from "vitest";

import { addEmailPasswordAuthMethod } from "../lib/auth/add-email-password";
import { signUpWithEmailPassword } from "../lib/auth/email-password-signup";
import { authenticateWithGoogle } from "../lib/auth/google-auth";
import { signUpWithGoogle } from "../lib/auth/google-signup";
import { prisma, resetDatabase } from "./helpers/db";

const VALID_PASSWORD = "Sup3rSecret!";

const GOOGLE_IDENTITY = {
  sub: "google-sub-7741",
  email: "Shared@Example.com",
  emailVerified: true,
  firstName: "Grace",
  lastName: "Hopper",
};

describe("Auth Method linking", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("links a GOOGLE Auth Method to an existing email/password account with the same verified email", async () => {
    const existing = await signUpWithEmailPassword(prisma, {
      email: "shared@example.com",
      password: VALID_PASSWORD,
    });

    const account = await authenticateWithGoogle(prisma, GOOGLE_IDENTITY);

    expect(account.id).toBe(existing.id);
    expect(await prisma.userAccount.count()).toBe(1);

    const methods = await prisma.userAuthMethod.findMany({
      where: { userAccountId: existing.id },
      orderBy: { methodType: "asc" },
    });
    expect(methods.map((m) => m.methodType)).toEqual([
      "EMAIL_PASSWORD",
      "GOOGLE",
    ]);
    expect(
      methods.find((m) => m.methodType === "GOOGLE")?.providerAccountId,
    ).toBe(GOOGLE_IDENTITY.sub);
  });

  it("adds an EMAIL_PASSWORD Auth Method and Password Credential to a Google-created account", async () => {
    const existing = await signUpWithGoogle(prisma, GOOGLE_IDENTITY);

    const account = await addEmailPasswordAuthMethod(prisma, {
      userAccountId: existing.id,
      password: VALID_PASSWORD,
    });

    expect(account.id).toBe(existing.id);
    expect(await prisma.userAccount.count()).toBe(1);

    const method = await prisma.userAuthMethod.findUnique({
      where: {
        userAccountId_methodType: {
          userAccountId: existing.id,
          methodType: "EMAIL_PASSWORD",
        },
      },
      include: { passwordCredential: true },
    });
    expect(method).not.toBeNull();
    expect(method?.providerAccountId).toBeNull();
    expect(method?.passwordCredential?.passwordHash).not.toContain(
      VALID_PASSWORD,
    );
  });

  it("links by normalized email so casing differences never create duplicate accounts", async () => {
    const existing = await signUpWithEmailPassword(prisma, {
      email: "Shared@EXAMPLE.com",
      password: VALID_PASSWORD,
    });

    const account = await authenticateWithGoogle(prisma, {
      ...GOOGLE_IDENTITY,
      email: "SHARED@example.COM",
    });

    expect(account.id).toBe(existing.id);
    expect(await prisma.userAccount.count()).toBe(1);
  });

  it("returns the linked account on repeat Google authentication without duplicating methods", async () => {
    await signUpWithEmailPassword(prisma, {
      email: "shared@example.com",
      password: VALID_PASSWORD,
    });
    const first = await authenticateWithGoogle(prisma, GOOGLE_IDENTITY);
    const second = await authenticateWithGoogle(prisma, GOOGLE_IDENTITY);

    expect(second.id).toBe(first.id);
    expect(await prisma.userAuthMethod.count()).toBe(2);
  });

  it("fills only missing profile names when linking, never overwriting existing ones", async () => {
    const existing = await signUpWithEmailPassword(prisma, {
      email: "shared@example.com",
      password: VALID_PASSWORD,
      firstName: "Gracie",
    });

    const account = await authenticateWithGoogle(prisma, GOOGLE_IDENTITY);

    expect(account.id).toBe(existing.id);
    expect(account.firstName).toBe("Gracie");
    expect(account.lastName).toBe("Hopper");
  });

  it("rejects adding a second EMAIL_PASSWORD Auth Method to the same account", async () => {
    const existing = await signUpWithEmailPassword(prisma, {
      email: "shared@example.com",
      password: VALID_PASSWORD,
    });

    await expect(
      addEmailPasswordAuthMethod(prisma, {
        userAccountId: existing.id,
        password: VALID_PASSWORD,
      }),
    ).rejects.toThrow(/unique/i);

    expect(await prisma.userAuthMethod.count()).toBe(1);
    expect(await prisma.userPasswordCredential.count()).toBe(1);
  });

  it("resolves an already-linked Google identity to its account even if the Google email changed", async () => {
    const original = await signUpWithGoogle(prisma, GOOGLE_IDENTITY);

    const account = await authenticateWithGoogle(prisma, {
      ...GOOGLE_IDENTITY,
      email: "renamed@example.com",
    });

    expect(account.id).toBe(original.id);
    expect(await prisma.userAccount.count()).toBe(1);
  });

  it("rolls back a failed link, leaving no partial Auth Method or profile changes", async () => {
    const existing = await signUpWithGoogle(prisma, {
      ...GOOGLE_IDENTITY,
      firstName: null,
      lastName: null,
    });

    await expect(
      authenticateWithGoogle(prisma, {
        ...GOOGLE_IDENTITY,
        sub: "google-sub-different-person",
        firstName: "Intruder",
      }),
    ).rejects.toThrow(/unique/i);

    const untouched = await prisma.userAccount.findUniqueOrThrow({
      where: { id: existing.id },
    });
    expect(untouched.firstName).toBeNull();
    expect(
      await prisma.userAuthMethod.count({
        where: { userAccountId: existing.id },
      }),
    ).toBe(1);
  });
});
