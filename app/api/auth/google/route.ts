import { NextResponse } from "next/server";

import { authenticateWithGoogle } from "../../../../lib/auth/google-auth";
import { prisma } from "../../../../lib/prisma";
import { createUserSession } from "../../../../lib/session/user-session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      firstName?: string;
      lastName?: string;
    };

    if (!body.email) {
      return NextResponse.json(
        { error: "Email is required for temporary Google login." },
        { status: 400 },
      );
    }

    const session = await authenticateWithGoogle(prisma, {
      sub: `temporary-google:${body.email.trim().toLowerCase()}`,
      email: body.email,
      emailVerified: true,
      firstName: body.firstName,
      lastName: body.lastName,
    });

    await createUserSession(session.account.id);

    return NextResponse.json({ user: session.account });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to continue with Google.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
