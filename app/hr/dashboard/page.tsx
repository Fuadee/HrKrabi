"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
};

type CaseRow = {
  id: string;
  reason: string;
  reported_at: string;
  hr_status: string;
  sla_deadline_at: string | null;
  teams: { name: string } | null;
  workers: { full_name: string } | null;
};

type ReceiveResponse = {
  data?: CaseRow;
  error?: string;
};

type SlaBadge = {
  label: string;
  className: string;
};

function getSlaBadge(caseItem: CaseRow): SlaBadge {
  const statusLabel = caseItem.hr_status.replace(/_/g, " ");

  if (!caseItem.sla_deadline_at) {
    return {
      label: statusLabel,
      className: "bg-slate-800 text-slate-200",
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(`${caseItem.sla_deadline_at}T00:00:00`);
  const diffDays = Math.round(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays < 0 || caseItem.hr_status === "sla_expired") {
    return {
      label: statusLabel,
      className: "bg-rose-500/20 text-rose-200 border border-rose-500/40",
    };
  }

  if (diffDays <= 1) {
    return {
      label: statusLabel,
      className: "bg-amber-500/20 text-amber-100 border border-amber-500/40",
    };
  }

  return {
    label: statusLabel,
    className: "bg-emerald-500/20 text-emerald-100 border border-emerald-500/40",
  };
}

export default function HrDashboardPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [actionCaseId, setActionCaseId] = useState<string | null>(null);

  const sortedCases = useMemo(
    () =>
      [...cases].sort(
        (a, b) =>
          new Date(b.reported_at).getTime() -
          new Date(a.reported_at).getTime(),
      ),
    [cases],
  );

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
        .select("role")
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

      if (profile.role !== "hr_prov") {
        setError("Only HR province can access this dashboard.");
        setLoading(false);
        return;
      }

      const { data: casesData, error: casesError } = await supabase
        .from("absence_cases")
        .select(
          "id, reason, reported_at, hr_status, sla_deadline_at, teams(name), workers(full_name)",
        )
        .order("reported_at", { ascending: false })
        .limit(50);

      if (!isMounted) {
        return;
      }

      if (casesError) {
        setError(casesError.message);
        setLoading(false);
        return;
      }

      setCases((casesData ?? []) as CaseRow[]);
      setLoading(false);
    };

    loadCases();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleReceive = async (caseId: string) => {
    setActionCaseId(caseId);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/hr/receive", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ case_id: caseId }),
      });

      const payload = (await response.json()) as ReceiveResponse;

      if (!response.ok) {
        setError(payload.error ?? "Failed to receive case.");
        setActionCaseId(null);
        return;
      }

      if (payload.data) {
        setCases((prev) =>
          prev.map((caseItem) =>
            caseItem.id === payload.data?.id ? payload.data : caseItem,
          ),
        );
      }

      setActionCaseId(null);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unexpected error.",
      );
      setActionCaseId(null);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <div className="w-full max-w-5xl space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-left">
        <div>
          <h1 className="text-2xl font-semibold">HR Province dashboard</h1>
          <p className="text-sm text-slate-400">
            Receive reported cases and trigger the 3-business-day SLA.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">Loading cases...</p>
        ) : null}
        {!loading && role !== "hr_prov" ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error ?? "Access restricted."}
          </p>
        ) : null}
        {!loading && role === "hr_prov" ? (
          <div className="space-y-3">
            {error ? (
              <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-900/60 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left">Team</th>
                    <th className="px-4 py-3 text-left">Worker</th>
                    <th className="px-4 py-3 text-left">Reason</th>
                    <th className="px-4 py-3 text-left">Reported</th>
                    <th className="px-4 py-3 text-left">HR status</th>
                    <th className="px-4 py-3 text-left">SLA deadline</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCases.length === 0 ? (
                    <tr>
                      <td
                        className="px-4 py-4 text-slate-400"
                        colSpan={7}
                      >
                        No absence cases yet.
                      </td>
                    </tr>
                  ) : (
                    sortedCases.map((caseItem) => {
                      const badge = getSlaBadge(caseItem);
                      const isPending = caseItem.hr_status === "pending";

                      return (
                        <tr
                          key={caseItem.id}
                          className="border-t border-slate-800 text-slate-200"
                        >
                          <td className="px-4 py-3">
                            {caseItem.teams?.name ?? "-"}
                          </td>
                          <td className="px-4 py-3">
                            {caseItem.workers?.full_name ?? "-"}
                          </td>
                          <td className="px-4 py-3 capitalize">
                            {caseItem.reason}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(caseItem.reported_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {caseItem.sla_deadline_at
                              ? new Date(
                                  `${caseItem.sla_deadline_at}T00:00:00`,
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {isPending ? (
                              <button
                                type="button"
                                onClick={() => handleReceive(caseItem.id)}
                                disabled={actionCaseId === caseItem.id}
                                className="rounded-md bg-white px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                {actionCaseId === caseItem.id
                                  ? "Sending..."
                                  : "Receive & Send Document"}
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">
                                Received
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
