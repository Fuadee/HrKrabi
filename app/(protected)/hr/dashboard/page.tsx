"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
};

type CaseRow = {
  id: string;
  team_id: string;
  worker_id: string;
  membership_id: string | null;
  reason: string;
  reported_at: string;
  hr_status: string;
  sla_deadline_at: string | null;
  recruitment_status: string;
  replacement_worker_name: string | null;
  replacement_start_date: string | null;
  final_status: string;
  teams: { name: string } | null;
  workers: { full_name: string } | null;
  team_memberships: { active: boolean } | null;
  removedFromTeam?: boolean;
};

type CaseResponse = {
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

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "-";
  }

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString();
}

export default function HrDashboardPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [actionCaseId, setActionCaseId] = useState<string | null>(null);
  const [foundCaseId, setFoundCaseId] = useState<string | null>(null);
  const [replacementName, setReplacementName] = useState("");
  const [replacementStartDate, setReplacementStartDate] = useState("");

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
          "id, team_id, worker_id, membership_id, reason, reported_at, hr_status, sla_deadline_at, recruitment_status, replacement_worker_name, replacement_start_date, final_status, teams(name), workers(full_name), team_memberships(active)",
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

      const caseRows = (casesData ?? []) as CaseRow[];
      const missingMembershipCases = caseRows.filter(
        (caseItem) => !caseItem.membership_id,
      );
      const workerIds = Array.from(
        new Set(missingMembershipCases.map((caseItem) => caseItem.worker_id)),
      );
      const teamIds = Array.from(
        new Set(missingMembershipCases.map((caseItem) => caseItem.team_id)),
      );
      const activeMembershipLookup = new Set<string>();

      if (workerIds.length > 0 && teamIds.length > 0) {
        const { data: membershipData, error: membershipError } = await supabase
          .from("team_memberships")
          .select("team_id, worker_id")
          .eq("active", true)
          .in("worker_id", workerIds)
          .in("team_id", teamIds);

        if (membershipError) {
          setError(membershipError.message);
          setLoading(false);
          return;
        }

        membershipData?.forEach((membership) => {
          activeMembershipLookup.add(
            `${membership.team_id}-${membership.worker_id}`,
          );
        });
      }

      const normalizedCases = caseRows.map((caseItem) => {
        const key = `${caseItem.team_id}-${caseItem.worker_id}`;
        const hasActiveMembership = caseItem.membership_id
          ? caseItem.team_memberships?.active ?? false
          : activeMembershipLookup.has(key);

        return {
          ...caseItem,
          removedFromTeam: !hasActiveMembership,
        };
      });

      setCases(normalizedCases);
      setLoading(false);
    };

    loadCases();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const updateCaseRow = (updatedCase: CaseRow) => {
    setCases((prev) =>
      prev.map((caseItem) =>
        caseItem.id === updatedCase.id ? updatedCase : caseItem,
      ),
    );
  };

  const getAccessToken = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const handleReceive = async (caseId: string) => {
    setActionCaseId(caseId);
    setError(null);

    try {
      const accessToken = await getAccessToken();

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

      const payload = (await response.json()) as CaseResponse;

      if (!response.ok) {
        setError(payload.error ?? "Failed to receive case.");
        setActionCaseId(null);
        return;
      }

      if (payload.data) {
        updateCaseRow(payload.data);
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

  const handleRecordOutcome = async (
    caseId: string,
    outcome: "found" | "not_found",
  ) => {
    setActionCaseId(caseId);
    setError(null);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/hr/record-outcome", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          caseId,
          outcome,
          replacement_worker_name:
            outcome === "found" ? replacementName.trim() : undefined,
          replacement_start_date:
            outcome === "found" ? replacementStartDate : undefined,
        }),
      });

      const payload = (await response.json()) as CaseResponse;

      if (!response.ok) {
        setError(payload.error ?? "Failed to record outcome.");
        setActionCaseId(null);
        return;
      }

      if (payload.data) {
        updateCaseRow(payload.data);
      }

      setFoundCaseId(null);
      setReplacementName("");
      setReplacementStartDate("");
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

  const handleApproveSwap = async (caseId: string) => {
    setActionCaseId(caseId);
    setError(null);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/hr/approve-swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ caseId }),
      });

      const payload = (await response.json()) as CaseResponse;

      if (!response.ok) {
        setError(payload.error ?? "Failed to approve swap.");
        setActionCaseId(null);
        return;
      }

      if (payload.data) {
        updateCaseRow(payload.data);
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

  const handleMarkVacant = async (caseId: string) => {
    setActionCaseId(caseId);
    setError(null);

    try {
      const accessToken = await getAccessToken();

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/hr/mark-vacant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ caseId }),
      });

      const payload = (await response.json()) as CaseResponse;

      if (!response.ok) {
        setError(payload.error ?? "Failed to mark vacant.");
        setActionCaseId(null);
        return;
      }

      if (payload.data) {
        updateCaseRow(payload.data);
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
      <div className="w-full max-w-6xl space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-left">
        <div>
          <h1 className="text-2xl font-semibold">HR Province dashboard</h1>
          <p className="text-sm text-slate-400">
            Receive cases, record recruitment outcomes, and finalize swaps or
            vacancies.
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
                    <th className="px-4 py-3 text-left">Recruitment</th>
                    <th className="px-4 py-3 text-left">Replacement</th>
                    <th className="px-4 py-3 text-left">Start date</th>
                    <th className="px-4 py-3 text-left">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCases.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-400" colSpan={10}>
                        No absence cases yet.
                      </td>
                    </tr>
                  ) : (
                    sortedCases.map((caseItem) => {
                      const badge = getSlaBadge(caseItem);
                      const isPending = caseItem.hr_status === "pending";
                      const isAwaiting =
                        caseItem.recruitment_status === "awaiting";
                      const isFound = caseItem.recruitment_status === "found";
                      const isNotFound =
                        caseItem.recruitment_status === "not_found";
                      const isOpen = caseItem.final_status === "open";
                      const deadline = caseItem.sla_deadline_at
                        ? new Date(`${caseItem.sla_deadline_at}T00:00:00`)
                        : null;
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const isAfterSla =
                        deadline && today.getTime() > deadline.getTime();
                      const isWithinSla =
                        deadline && today.getTime() <= deadline.getTime();

                      return (
                        <tr
                          key={caseItem.id}
                          className="border-t border-slate-800 text-slate-200"
                        >
                          <td className="px-4 py-3">
                            {caseItem.teams?.name ?? "-"}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span>{caseItem.workers?.full_name ?? "-"}</span>
                              {caseItem.removedFromTeam ? (
                                <span className="inline-flex w-fit items-center rounded-full border border-rose-400/50 bg-rose-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-200">
                                  Removed from team
                                </span>
                              ) : null}
                            </div>
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
                            {formatDate(caseItem.sla_deadline_at)}
                          </td>
                          <td className="px-4 py-3 capitalize">
                            {caseItem.recruitment_status.replace(/_/g, " ")}
                          </td>
                          <td className="px-4 py-3">
                            {caseItem.replacement_worker_name ?? "-"}
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(caseItem.replacement_start_date)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-2">
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
                              ) : null}
                              {isAwaiting && isOpen ? (
                                <>
                                  {foundCaseId === caseItem.id ? (
                                    <div className="space-y-2 rounded-md border border-slate-800 bg-slate-900/40 p-2">
                                      <div>
                                        <label className="text-xs text-slate-300">
                                          Replacement name
                                        </label>
                                        <input
                                          type="text"
                                          value={replacementName}
                                          onChange={(event) =>
                                            setReplacementName(event.target.value)
                                          }
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-xs text-slate-300">
                                          Start date
                                        </label>
                                        <input
                                          type="date"
                                          value={replacementStartDate}
                                          onChange={(event) =>
                                            setReplacementStartDate(event.target.value)
                                          }
                                          className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                                        />
                                      </div>
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (!replacementName.trim()) {
                                              setError(
                                                "Replacement worker name is required.",
                                              );
                                              return;
                                            }
                                            if (!replacementStartDate) {
                                              setError(
                                                "Replacement start date is required.",
                                              );
                                              return;
                                            }
                                            handleRecordOutcome(caseItem.id, "found");
                                          }}
                                          disabled={actionCaseId === caseItem.id}
                                          className="rounded-md bg-emerald-400 px-2 py-1 text-xs font-semibold text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                                        >
                                          {actionCaseId === caseItem.id
                                            ? "Saving..."
                                            : "Save"}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setFoundCaseId(null);
                                            setReplacementName("");
                                            setReplacementStartDate("");
                                            setError(null);
                                          }}
                                          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-200"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFoundCaseId(caseItem.id);
                                        setReplacementName(
                                          caseItem.replacement_worker_name ?? "",
                                        );
                                        setReplacementStartDate(
                                          caseItem.replacement_start_date ?? "",
                                        );
                                        setError(null);
                                      }}
                                      className="rounded-md border border-emerald-400/60 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/10"
                                    >
                                      Record Found
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleRecordOutcome(caseItem.id, "not_found")}
                                    disabled={actionCaseId === caseItem.id}
                                    className="rounded-md border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-800/60 disabled:cursor-not-allowed disabled:opacity-70"
                                  >
                                    {actionCaseId === caseItem.id
                                      ? "Saving..."
                                      : "Record Not Found"}
                                  </button>
                                </>
                              ) : null}
                              {isFound && isOpen ? (
                                <button
                                  type="button"
                                  onClick={() => handleApproveSwap(caseItem.id)}
                                  disabled={actionCaseId === caseItem.id || !isWithinSla}
                                  className="rounded-md bg-emerald-400 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  Approve Swap
                                </button>
                              ) : null}
                              {isNotFound && isOpen && isAfterSla ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkVacant(caseItem.id)}
                                  disabled={actionCaseId === caseItem.id}
                                  className="rounded-md bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-900 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-70"
                                >
                                  Mark Vacant
                                </button>
                              ) : null}
                              {!isPending && !isOpen ? (
                                <span className="text-xs text-slate-400">
                                  Finalized
                                </span>
                              ) : null}
                            </div>
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
