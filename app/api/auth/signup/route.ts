import { NextResponse } from "next/server";

import { signUpWithEmailPassword } from "../../../../lib/auth/email-password-signup";
import { prisma } from "../../../../lib/prisma";
import { createUserSession } from "../../../../lib/session/user-session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
      firstName?: string;
      lastName?: string;
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const account = await signUpWithEmailPassword(prisma, {
      email: body.email,
      password: body.password,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    await createUserSession(account.id);

    return NextResponse.json({ user: account }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
