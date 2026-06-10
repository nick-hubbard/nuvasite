import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { authenticateWithGoogle } from "../../../../../lib/auth/google-auth";
import { prisma } from "../../../../../lib/prisma";
import { createUserSession } from "../../../../../lib/session/user-session";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const STATE_COOKIE_NAME = "nuvasite_google_oauth_state";

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GoogleUserInfo {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  given_name?: string;
  family_name?: string;
}

function getBaseUrl(request: Request) {
  return process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
}

function redirectWithError(request: Request, message: string) {
  const url = new URL("/", request.url);
  url.searchParams.set("authError", message);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return redirectWithError(
      request,
      "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE_NAME)?.value;
  cookieStore.delete(STATE_COOKIE_NAME);

  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectWithError(request, "Google sign-in could not be verified.");
  }

  const redirectUri = `${getBaseUrl(request)}/api/auth/google/callback`;
  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const tokenData = (await tokenResponse.json()) as GoogleTokenResponse;

  if (!tokenResponse.ok || !tokenData.access_token) {
    return redirectWithError(
      request,
      tokenData.error_description ??
        tokenData.error ??
        "Google token exchange failed.",
    );
  }

  const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userInfo = (await userInfoResponse.json()) as GoogleUserInfo;

  if (
    !userInfoResponse.ok ||
    !userInfo.sub ||
    !userInfo.email ||
    !userInfo.email_verified
  ) {
    return redirectWithError(
      request,
      "Google did not return a verified email address.",
    );
  }

  const session = await authenticateWithGoogle(prisma, {
    sub: userInfo.sub,
    email: userInfo.email,
    emailVerified: userInfo.email_verified,
    firstName: userInfo.given_name,
    lastName: userInfo.family_name,
  });

  await createUserSession(session.account.id);

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
