import { cookies } from "next/headers";

import { prisma } from "../prisma";

const SESSION_COOKIE_NAME = "nuvasite_user_account_id";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export async function createUserSession(userAccountId: string) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, userAccountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearUserSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const cookieStore = await cookies();
  const userAccountId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!userAccountId) {
    return null;
  }

  return prisma.userAccount.findFirst({
    where: {
      id: userAccountId,
      status: "ACTIVE",
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
    },
  });
}
