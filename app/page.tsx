import { redirect } from "next/navigation";

import { getCurrentUser } from "../lib/session/user-session";

export default async function PortalHome() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl place-items-center px-5">
      <div className="max-w-xl text-center">
        <h1 className="text-3xl font-semibold text-slate-950">
          Nuvasite account testing
        </h1>
        <p className="mt-3 text-slate-600">
          Use the profile menu to log in or create a temporary test account.
        </p>
      </div>
    </main>
  );
}
