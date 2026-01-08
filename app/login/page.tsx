"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import AuthProvider, { useAuth } from "@/components/auth/AuthProvider";
import { login } from "@/lib/auth";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { getRoleDefaultRoute, isUserRole } from "@/lib/roleAccess";

const roleNoticeKey = "role_notice";

function LoginContent() {
  const router = useRouter();
  const { status: authStatus, role } = useAuth();
  const redirectRef = useRef<{ target: string | null }>({ target: null });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (authStatus === "loading") {
      return;
    }
    if (authStatus === "authed") {
      if (isUserRole(role)) {
        const target = getRoleDefaultRoute(role);
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("LOGIN_REDIRECT", target);
        }
        if (redirectRef.current.target !== target) {
          redirectRef.current.target = target;
          router.replace(target);
        }
        return;
      }
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(roleNoticeKey, "Role not assigned.");
      }
      if (redirectRef.current.target !== "/my-profile") {
        if (process.env.NODE_ENV !== "production") {
          // eslint-disable-next-line no-console
          console.debug("LOGIN_REDIRECT", "/my-profile");
        }
        redirectRef.current.target = "/my-profile";
        router.replace("/my-profile");
      }
    }
  }, [authStatus, role, router]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    const { ok, error: signInError, userId } = await login({ email, password });
    if (!ok) {
      setError(signInError ?? "Unable to sign in.");
      setLoading(false);
      return;
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("SIGNIN_OK", userId ?? "unknown");
    }
    const target = isUserRole(role)
      ? getRoleDefaultRoute(role)
      : "/my-profile";
    if (!isUserRole(role) && typeof window !== "undefined") {
      window.sessionStorage.setItem(roleNoticeKey, "Role not assigned.");
    }
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.debug("LOGIN_REDIRECT", target);
    }
    if (redirectRef.current.target !== target) {
      redirectRef.current.target = target;
      router.replace(target);
    }
    setLoading(false);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    setStatusMessage(null);
    const supabase = getSupabaseBrowserClient();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      setLoading(false);
      return;
    }

    setStatusMessage("Check your email to confirm your account.");
    setLoading(false);
  };

  if (authStatus === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Loading...
      </main>
    );
  }

  if (authStatus === "authed") {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Redirecting...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-slate-400">
            Use your email and password to access your profile.
          </p>
        </div>
        <div className="space-y-3 text-left">
          <label className="block text-sm font-medium text-slate-200">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
              placeholder="••••••••"
            />
          </label>
        </div>
        {error ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        {statusMessage ? (
          <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
            {statusMessage}
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="w-full rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            Sign up
          </button>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginContent />
    </AuthProvider>
  );
}
