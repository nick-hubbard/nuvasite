"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AuthMode = "login" | "signup";

interface CurrentUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

interface AuthResponse {
  user?: CurrentUser;
  error?: string;
}

export function TemporaryAuthHeader() {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");

  useEffect(() => {
    void refreshUser();
  }, []);

  async function refreshUser() {
    const response = await fetch("/api/auth/me");
    const data = (await response.json()) as AuthResponse;
    setUser(data.user ?? null);
  }

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setMenuOpen(false);
    window.location.href = "/";
  }

  const label = useMemo(() => {
    if (!user) {
      return "Profile";
    }
    return user.firstName || user.email;
  }, [user]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
          <Link className="text-lg font-semibold text-slate-950" href="/">
            Nuvasite
          </Link>
          <div className="relative">
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-500"
              onClick={() => setMenuOpen((open) => !open)}
              type="button"
            >
              <span className="grid size-6 place-items-center rounded-full bg-sky-100 text-xs font-bold text-sky-800">
                {label.slice(0, 1).toUpperCase()}
              </span>
              {label}
            </button>
            {menuOpen ? (
              <div className="absolute right-0 mt-2 w-56 rounded-md border border-slate-200 bg-white p-2 shadow-lg">
                {user ? (
                  <>
                    <div className="border-b border-slate-100 px-3 py-2 text-sm text-slate-600">
                      {user.email}
                    </div>
                    <Link
                      className="block rounded px-3 py-2 text-sm text-slate-800 hover:bg-slate-100"
                      href="/dashboard"
                    >
                      Dashboard
                    </Link>
                    <button
                      className="block w-full rounded px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
                      onClick={handleLogout}
                      type="button"
                    >
                      Log out
                    </button>
                  </>
                ) : (
                  <button
                    className="block w-full rounded px-3 py-2 text-left text-sm text-slate-800 hover:bg-slate-100"
                    onClick={() => {
                      setMode("login");
                      setModalOpen(true);
                      setMenuOpen(false);
                    }}
                    type="button"
                  >
                    Log in
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </header>
      {modalOpen ? (
        <AuthModal
          mode={mode}
          onClose={() => setModalOpen(false)}
          onModeChange={setMode}
          onSignedIn={(nextUser) => {
            setUser(nextUser);
            setModalOpen(false);
            window.location.href = "/dashboard";
          }}
        />
      ) : null}
    </>
  );
}

function AuthModal({
  mode,
  onClose,
  onModeChange,
  onSignedIn,
}: {
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
  onSignedIn: (user: CurrentUser) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(endpoint: string) {
    setBusy(true);
    setError(null);

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, firstName, lastName }),
    });
    const data = (await response.json()) as AuthResponse;

    setBusy(false);
    if (!response.ok || !data.user) {
      setError(data.error ?? "Authentication failed.");
      return;
    }

    onSignedIn(data.user);
  }

  function continueWithGoogle() {
    window.location.href = "/api/auth/google/start";
  }

  const isSignup = mode === "signup";

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 px-4"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">
              {isSignup ? "Create account" : "Log in"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Use email/password or the temporary Google test path.
            </p>
          </div>
          <button
            aria-label="Close"
            className="grid size-8 place-items-center rounded-md text-xl text-slate-500 hover:bg-slate-100"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>

        <div className="grid gap-3">
          {isSignup ? (
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                First name
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 font-normal"
                  onChange={(event) => setFirstName(event.target.value)}
                  value={firstName}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium text-slate-700">
                Last name
                <input
                  className="h-10 rounded-md border border-slate-300 px-3 font-normal"
                  onChange={(event) => setLastName(event.target.value)}
                  value={lastName}
                />
              </label>
            </div>
          ) : null}
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Email
            <input
              className="h-10 rounded-md border border-slate-300 px-3 font-normal"
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              value={email}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium text-slate-700">
            Password
            <input
              className="h-10 rounded-md border border-slate-300 px-3 font-normal"
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              value={password}
            />
          </label>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 grid gap-3">
          <button
            className="h-11 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={() => submit(isSignup ? "/api/auth/signup" : "/api/auth/login")}
            type="button"
          >
            {isSignup ? "Create account" : "Log in"}
          </button>
          <button
            className="h-11 rounded-md border border-slate-300 px-4 text-sm font-semibold text-slate-800 transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={busy}
            onClick={continueWithGoogle}
            type="button"
          >
            Continue with Google
          </button>
        </div>

        <button
          className="mt-4 text-sm font-medium text-sky-700 hover:text-sky-900"
          onClick={() => {
            setError(null);
            onModeChange(isSignup ? "login" : "signup");
          }}
          type="button"
        >
          {isSignup
            ? "Already have an account? Log in"
            : "Need an account? Create one"}
        </button>
      </div>
    </div>
  );
}
