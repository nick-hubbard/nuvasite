import { redirect } from "next/navigation";

import { getCurrentUser } from "../../lib/session/user-session";

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/");
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl place-items-center px-5">
      <h1 className="text-3xl font-semibold text-slate-950">
        You are logged in
      </h1>
    </main>
  );
}
