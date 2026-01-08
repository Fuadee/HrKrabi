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

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center text-text">
      <div className="card-surface w-full max-w-md space-y-4 p-6">
        <div>
          <h1 className="text-2xl font-semibold">Your profile</h1>
          <p className="text-sm text-text-muted">
            Email and role loaded from Supabase.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-text-muted">Loading profile...</p>
        ) : (
          <div className="space-y-2 text-left text-sm text-text">
            <p>
              <span className="text-text-muted">Email:</span> {email ?? "-"}
            </p>
            <p>
              <span className="text-text-muted">Role:</span> {role ?? "-"}
            </p>
          </div>
        )}
        {error ? (
          <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
