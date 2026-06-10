import { NextResponse } from "next/server";

import { authenticateWithPassword } from "../../../../lib/auth/password-auth";
import { prisma } from "../../../../lib/prisma";
import { createUserSession } from "../../../../lib/session/user-session";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      password?: string;
    };

    if (!body.email || !body.password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 },
      );
    }

    const session = await authenticateWithPassword(prisma, {
      email: body.email,
      password: body.password,
    });

    await createUserSession(session.account.id);

    return NextResponse.json({ user: session.account });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to log in.";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
