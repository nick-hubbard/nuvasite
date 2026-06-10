import { NextResponse } from "next/server";

import { getCurrentUser } from "../../../../lib/session/user-session";

export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json({ user });
}
