"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSession, login } from "@/lib/auth";
import { getDefaultRouteForRole, getProfileRole } from "@/lib/roleRedirect";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      const session = await getSession();
      if (session.isAuthenticated) {
        const role = await getProfileRole();
        const target = getDefaultRouteForRole(role);
        router.replace(target);
        return;
      }

      if (isMounted) {
        setCheckingSession(false);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setLoading(true);
    setError(null);
    setStatus(null);
    const { error: signInError } = await login({ email, password });
    if (signInError) {
      setError(signInError);
      setLoading(false);
      return;
    }

    const role = await getProfileRole();
    const target = getDefaultRouteForRole(role);
    router.replace(target);
  };

  const handleSignUp = async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
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
      const role = await getProfileRole(data.user?.id ?? null);
      const target = getDefaultRouteForRole(role);
      router.replace(target);
      return;
    }

    setStatus("Check your email to confirm your account.");
    setLoading(false);
  };

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg text-sm text-text-muted">
        Checking your session...
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center text-text">
      <div className="card-surface w-full max-w-md space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Sign in</h1>
          <p className="text-sm text-text-muted">
            Use your email and password to access your profile.
          </p>
        </div>
        <div className="space-y-3 text-left">
          <label className="block text-sm font-medium text-text">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent-purple focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="you@example.com"
            />
          </label>
          <label className="block text-sm font-medium text-text">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-text placeholder:text-text-muted focus:border-accent-purple focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="••••••••"
            />
          </label>
        </div>
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {status}
          </p>
        ) : null}
        <div className="flex flex-col gap-3">
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading}
            className="btn-base btn-primary w-full px-4 py-2 text-sm"
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={handleSignUp}
            disabled={loading}
            className="btn-base btn-secondary w-full px-4 py-2 text-sm"
          >
            Sign up
          </button>
        </div>
      </div>
    </main>
  );
}
