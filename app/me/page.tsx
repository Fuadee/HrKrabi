"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
};

export default function MePage() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data.user) {
        router.replace("/login");
        return;
      }

      if (isMounted) {
        setEmail(data.user.email ?? null);
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single<Profile>();

      if (isMounted) {
        if (profileError) {
          setError(profileError.message);
        } else {
          setRole(profile?.role ?? null);
        }
        setLoading(false);
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleLogout = async () => {
    setLoggingOut(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      setLoggingOut(false);
      return;
    }
    router.replace("/login");
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Your profile</h1>
          <p className="text-sm text-slate-400">
            Email and role loaded from Supabase.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">Loading profile...</p>
        ) : (
          <div className="space-y-2 text-left text-sm text-slate-200">
            <p>
              <span className="text-slate-400">Email:</span> {email ?? "-"}
            </p>
            <p>
              <span className="text-slate-400">Role:</span> {role ?? "-"}
            </p>
          </div>
        )}
        {error ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error}
          </p>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full rounded-md border border-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-70"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
