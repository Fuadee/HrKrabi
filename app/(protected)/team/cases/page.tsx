"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { getDefaultRouteForRole } from "@/lib/roleRedirect";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
  team_id: string | null;
};

type CaseRow = {
  id: string;
  reason: string;
  status: string;
  reported_at: string;
  workers: { full_name: string } | null;
};

export default function TeamCasesPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCases = async () => {
      const supabase = getSupabaseBrowserClient();
      const { data: userData, error: userError } =
        await supabase.auth.getUser();

      if (userError || !userData.user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role, team_id")
        .eq("id", userData.user.id)
        .single<Profile>();

      if (!isMounted) {
        return;
      }

      if (profileError || !profile) {
        setError(profileError?.message ?? "Unable to load profile.");
        setLoading(false);
        return;
      }

      setRole(profile.role);

      if (profile.role !== "team_lead") {
        const redirectTarget = getDefaultRouteForRole(profile.role);
        setError("Only team leads can view cases.");
        setLoading(false);
        router.replace(redirectTarget);
        return;
      }

      const { data: casesData, error: casesError } = await supabase
        .from("absence_cases")
        .select("id, reason, status, reported_at, workers(full_name)")
        .order("reported_at", { ascending: false })
        .limit(20);

      if (!isMounted) {
        return;
      }

      if (casesError) {
        setError(casesError.message);
        setLoading(false);
        return;
      }

      setCases(casesData ?? []);
      setLoading(false);
    };

    loadCases();

    return () => {
      isMounted = false;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <div className="w-full max-w-3xl space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-left">
        <div>
          <h1 className="text-2xl font-semibold">Recent absence cases</h1>
          <p className="text-sm text-slate-400">
            Last 20 cases reported for your team.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">Loading cases...</p>
        ) : null}
        {!loading && role !== "team_lead" ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error ?? "Access restricted."}
          </p>
        ) : null}
        {!loading && role === "team_lead" ? (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-slate-900/60 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-left">Worker</th>
                  <th className="px-4 py-3 text-left">Reason</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Reported</th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-4 text-slate-400"
                      colSpan={4}
                    >
                      No cases reported yet.
                    </td>
                  </tr>
                ) : (
                  cases.map((caseItem) => (
                    <tr
                      key={caseItem.id}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-4 py-3">
                        {caseItem.workers?.full_name ?? "Unknown"}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {caseItem.reason}
                      </td>
                      <td className="px-4 py-3 capitalize">
                        {caseItem.status}
                      </td>
                      <td className="px-4 py-3">
                        {new Date(caseItem.reported_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </main>
  );
}
