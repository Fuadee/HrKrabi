"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
};

export default function HomePage() {
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadRole = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single<Profile>();

      if (isMounted) {
        setRole(profile?.role ?? null);
      }
    };

    loadRole();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-4xl font-semibold tracking-tight text-white">
        Workforce Replacement Tracker
      </h1>
      <p className="text-lg text-slate-300">Step-by-step rebuild</p>
      <nav className="flex flex-wrap items-center justify-center gap-3 text-sm text-slate-200">
        <Link
          href="/dev/health"
          className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-slate-500"
        >
          Dev health
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-slate-500"
        >
          Login
        </Link>
        <Link
          href="/me"
          className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-slate-500"
        >
          My profile
        </Link>
        {role === "team_lead" ? (
          <>
            <Link
              href="/team/report"
              className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-slate-500"
            >
              Report absence
            </Link>
            <Link
              href="/team/cases"
              className="rounded-full border border-slate-700 px-4 py-2 transition hover:border-slate-500"
            >
              Team cases
            </Link>
          </>
        ) : null}
      </nav>
    </main>
  );
}
