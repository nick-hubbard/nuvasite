import { beforeEach, describe, expect, it } from "vitest";

import { signUpWithGoogle } from "../lib/auth/google-signup";
import { prisma, resetDatabase } from "./helpers/db";

const GOOGLE_IDENTITY = {
  sub: "google-sub-108177235",
  email: "Marie.Curie@Example.com",
  emailVerified: true,
  firstName: "Marie",
  lastName: "Curie",
};

describe("Google-first signup", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates an Active account with a GOOGLE Auth Method storing the provider identity", async () => {
    const account = await signUpWithGoogle(prisma, GOOGLE_IDENTITY);

    expect(account.status).toBe("ACTIVE");
    expect(account.email).toBe("marie.curie@example.com");

    const methods = await prisma.userAuthMethod.findMany({
      where: { userAccountId: account.id },
    });
    expect(methods).toHaveLength(1);
    expect(methods[0]?.methodType).toBe("GOOGLE");
    expect(methods[0]?.providerAccountId).toBe("google-sub-108177235");

    const statusChanges = await prisma.userAccountStatusChange.findMany({
      where: { userAccountId: account.id },
    });
    expect(statusChanges).toHaveLength(1);
    expect(statusChanges[0]?.previousStatus).toBeNull();
    expect(statusChanges[0]?.newStatus).toBe("ACTIVE");
  });

  it("rejects signup when Google does not provide a verified email", async () => {
    await expect(
      signUpWithGoogle(prisma, { ...GOOGLE_IDENTITY, emailVerified: false }),
    ).rejects.toThrow(/verified email/i);

    await expect(
      signUpWithGoogle(prisma, { ...GOOGLE_IDENTITY, email: null }),
    ).rejects.toThrow(/verified email/i);

    expect(await prisma.userAccount.count()).toBe(0);
  });

  it("stores Google sub as the provider identity, never the Google email", async () => {
    const account = await signUpWithGoogle(prisma, GOOGLE_IDENTITY);

    const method = await prisma.userAuthMethod.findFirst({
      where: { userAccountId: account.id },
    });
    expect(method?.providerAccountId).toBe(GOOGLE_IDENTITY.sub);
    expect(method?.providerAccountId).not.toContain("@");
  });

  it("persists no OAuth token columns anywhere in the schema", async () => {
    const tokenColumns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name ILIKE '%token%'
    `;
    expect(tokenColumns).toHaveLength(0);
  });

  it("fills missing profile names from Google, trimming while preserving casing", async () => {
    const account = await signUpWithGoogle(prisma, {
      ...GOOGLE_IDENTITY,
      firstName: "  marie  ",
      lastName: " CURIE ",
    });

    expect(account.firstName).toBe("marie");
    expect(account.lastName).toBe("CURIE");
  });

  it("leaves profile names empty when Google provides none", async () => {
    const account = await signUpWithGoogle(prisma, {
      ...GOOGLE_IDENTITY,
      firstName: null,
      lastName: undefined,
    });

    expect(account.firstName).toBeNull();
    expect(account.lastName).toBeNull();
  });

  it("rejects a second account for the same Google provider identity", async () => {
    await signUpWithGoogle(prisma, GOOGLE_IDENTITY);

    await expect(
      signUpWithGoogle(prisma, {
        ...GOOGLE_IDENTITY,
        email: "other-address@example.com",
      }),
    ).rejects.toThrow(/unique/i);
  });
});
