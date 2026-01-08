"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
  team_id: string | null;
};

type TeamRow = {
  id: string;
  name: string;
  capacity: number;
};

type MembershipRow = {
  id: string;
  worker_id: string;
  start_date: string;
  end_date?: string | null;
  ended_reason?: string | null;
  workers: { full_name: string } | null;
};

type CaseRow = {
  id: string;
  worker_id: string;
  reason: string;
  reported_at: string;
  hr_status: string;
  final_status: string;
  hr_received_at: string | null;
  sla_deadline_at: string | null;
  recruitment_status: string;
  recruitment_updated_at: string | null;
  hr_swap_approved_at: string | null;
};

type LatestCaseRow = CaseRow & {
  last_update_at: string;
};

type AddMemberResponse = {
  data?: {
    worker: { id: string; full_name: string };
    membership: { id: string; start_date: string };
  };
  error?: string;
};

type TeamCasesResponse = {
  data?: CaseRow[];
  error?: string;
};

type RemoveMemberResponse = {
  data?: { id: string };
  error?: string;
};

const removalReasons = [
  { value: "quit", label: "Quit" },
  { value: "absent_3days", label: "Absent 3 days" },
  { value: "replaced", label: "Replaced" },
  { value: "other", label: "Other" },
];

export default function TeamDashboardPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [activeMembers, setActiveMembers] = useState<MembershipRow[]>([]);
  const [inactiveMembers, setInactiveMembers] = useState<MembershipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedRemoval, setSelectedRemoval] = useState<MembershipRow | null>(
    null,
  );
  const [endedReason, setEndedReason] = useState("quit");
  const [endedNote, setEndedNote] = useState("");
  const [removing, setRemoving] = useState(false);
  const [latestCasesByWorker, setLatestCasesByWorker] = useState<
    Record<string, LatestCaseRow>
  >({});
  const [casesLoading, setCasesLoading] = useState(false);
  const [casesError, setCasesError] = useState<string | null>(null);

  const headcount = activeMembers.length;
  const missingCount = useMemo(() => {
    const capacity = team?.capacity ?? 0;
    return Math.max(0, capacity - headcount);
  }, [team?.capacity, headcount]);

  const getAccessToken = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const computeLastUpdateAt = (caseRow: CaseRow) => {
    const reportedTimestamp = new Date(caseRow.reported_at).getTime();
    const timestamps = [
      reportedTimestamp,
      caseRow.hr_received_at
        ? new Date(caseRow.hr_received_at).getTime()
        : reportedTimestamp,
      caseRow.recruitment_updated_at
        ? new Date(caseRow.recruitment_updated_at).getTime()
        : reportedTimestamp,
      caseRow.hr_swap_approved_at
        ? new Date(caseRow.hr_swap_approved_at).getTime()
        : reportedTimestamp,
    ].filter((value) => !Number.isNaN(value));

    return new Date(Math.max(...timestamps)).toISOString();
  };

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    setCasesLoading(true);
    setCasesError(null);

    const supabase = getSupabaseBrowserClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      router.replace("/login");
      return;
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, team_id")
      .eq("id", userData.user.id)
      .single<Profile>();

    if (profileError || !profile) {
      setError(profileError?.message ?? "Unable to load profile.");
      setLoading(false);
      return;
    }

    setRole(profile.role);

    if (profile.role !== "team_lead") {
      setError("Only team leads can access the roster dashboard.");
      setLoading(false);
      setCasesLoading(false);
      return;
    }

    if (!profile.team_id) {
      setError("No team assigned to your profile.");
      setLoading(false);
      setCasesLoading(false);
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, name, capacity")
      .eq("id", profile.team_id)
      .single<TeamRow>();

    if (teamError || !teamData) {
      setError(teamError?.message ?? "Unable to load team.");
      setLoading(false);
      setCasesLoading(false);
      return;
    }

    const { data: activeData, error: activeError } = await supabase
      .from("team_memberships")
      .select("id, worker_id, start_date, workers(full_name)")
      .eq("team_id", profile.team_id)
      .eq("active", true)
      .order("start_date", { ascending: true });

    if (activeError) {
      setError(activeError.message);
      setLoading(false);
      setCasesLoading(false);
      return;
    }

    const { data: inactiveData, error: inactiveError } = await supabase
      .from("team_memberships")
      .select("id, worker_id, end_date, ended_reason, workers(full_name)")
      .eq("team_id", profile.team_id)
      .eq("active", false)
      .order("end_date", { ascending: false })
      .limit(20);

    if (inactiveError) {
      setError(inactiveError.message);
      setLoading(false);
      setCasesLoading(false);
      return;
    }

    const accessToken = await getAccessToken();
    if (!accessToken) {
      router.replace("/login");
      return;
    }

    const workerIds = (activeData ?? []).map((member) => member.worker_id);
    if (workerIds.length === 0) {
      setLatestCasesByWorker({});
      setCasesLoading(false);
    } else {
      const casesResponse = await fetch(
        `/api/team/cases?worker_ids=${workerIds.join(",")}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      );
      const casesPayload = (await casesResponse.json()) as TeamCasesResponse;

      if (!casesResponse.ok) {
        setCasesError(
          casesPayload.error ??
            "Case statuses are unavailable. The member list is still available.",
        );
        setLatestCasesByWorker({});
      } else {
        const mapped = (casesPayload.data ?? []).reduce<
          Record<string, LatestCaseRow>
        >((accumulator, row) => {
          if (!accumulator[row.worker_id]) {
            accumulator[row.worker_id] = {
              ...row,
              last_update_at: computeLastUpdateAt(row),
            };
          }
          return accumulator;
        }, {});
        setLatestCasesByWorker(mapped);
      }

      setCasesLoading(false);
    }
    setTeam(teamData);
    setActiveMembers((activeData ?? []) as MembershipRow[]);
    setInactiveMembers((inactiveData ?? []) as MembershipRow[]);
    setLoading(false);
  };

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (isMounted) {
        await loadDashboard();
      }
    };

    load();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const formatDate = (value?: string | null) =>
    value ? new Date(value).toLocaleDateString() : "-";
  const formatDateTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString() : "-";

  const statusStyles: Record<string, string> = {
    reported: "bg-slate-700/50 text-slate-200 border-slate-600/60",
    in_sla: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
    sla_expired: "bg-amber-500/20 text-amber-200 border-amber-500/40",
    not_found: "bg-rose-500/20 text-rose-200 border-rose-500/40",
    found: "bg-sky-500/20 text-sky-200 border-sky-500/40",
    swapped: "bg-violet-500/20 text-violet-200 border-violet-500/40",
    vacant: "bg-orange-500/20 text-orange-200 border-orange-500/40",
    closed: "bg-slate-500/30 text-slate-100 border-slate-500/40",
    default: "bg-slate-700/50 text-slate-200 border-slate-600/60",
  };

  const getCaseStatus = (caseRow?: CaseRow | null) => {
    if (!caseRow) {
      return { label: "—", style: statusStyles.default };
    }

    const finalStatus = caseRow.final_status;
    if (["swapped", "vacant", "closed"].includes(finalStatus)) {
      return {
        label: finalStatus.replace(/_/g, " "),
        style: statusStyles[finalStatus] ?? statusStyles.default,
      };
    }

    if (caseRow.hr_status === "pending" && !caseRow.hr_received_at) {
      return { label: "Reported", style: statusStyles.reported };
    }
    if (caseRow.hr_status === "in_sla") {
      return { label: "In SLA", style: statusStyles.in_sla };
    }
    if (caseRow.hr_status === "sla_expired") {
      return { label: "SLA Expired", style: statusStyles.sla_expired };
    }
    if (caseRow.recruitment_status === "not_found") {
      return { label: "Not Found", style: statusStyles.not_found };
    }
    if (caseRow.recruitment_status === "found") {
      return { label: "Found", style: statusStyles.found };
    }

    return { label: "In progress", style: statusStyles.default };
  };

  const handleAddMember = async () => {
    setSubmitting(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/team/members/add", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          full_name: fullName.trim(),
          national_id: nationalId.trim() || undefined,
        }),
      });

      const payload = (await response.json()) as AddMemberResponse;

      if (!response.ok) {
        setError(payload.error ?? "Failed to add member.");
        setSubmitting(false);
        return;
      }

      setFullName("");
      setNationalId("");
      await loadDashboard();
      setSubmitting(false);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unexpected error.",
      );
      setSubmitting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!selectedRemoval) {
      return;
    }

    const memberName = selectedRemoval.workers?.full_name ?? "this member";
    const confirmed = window.confirm(
      `Remove ${memberName} from the active roster?`,
    );

    if (!confirmed) {
      return;
    }

    setRemoving(true);
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/team/members/remove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          membership_id: selectedRemoval.id,
          ended_reason: endedReason,
          ended_note: endedNote.trim() || null,
        }),
      });

      const payload = (await response.json()) as RemoveMemberResponse;

      if (!response.ok) {
        setError(payload.error ?? "Failed to remove member.");
        setRemoving(false);
        return;
      }

      setSelectedRemoval(null);
      setEndedReason("quit");
      setEndedNote("");
      await loadDashboard();
      setRemoving(false);
    } catch (actionError) {
      setError(
        actionError instanceof Error
          ? actionError.message
          : "Unexpected error.",
      );
      setRemoving(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <div className="w-full max-w-6xl space-y-6 rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-left">
        <div>
          <h1 className="text-2xl font-semibold">Team workforce dashboard</h1>
          <p className="text-sm text-slate-400">
            Manage the on-site roster and track active headcount.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">Loading roster...</p>
        ) : null}
        {!loading && role !== "team_lead" ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error ?? "Access restricted."}
          </p>
        ) : null}
        {!loading && role === "team_lead" ? (
          <div className="space-y-6">
            {error ? (
              <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            <div className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase text-slate-400">Team</p>
                <p className="text-lg font-semibold text-white">
                  {team?.name ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Capacity</p>
                <p className="text-lg font-semibold text-white">
                  {team?.capacity ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">
                  Active headcount
                </p>
                <p className="text-lg font-semibold text-white">{headcount}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Missing</p>
                <p className="text-lg font-semibold text-white">
                  {missingCount}
                </p>
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/30 p-4 md:grid-cols-[2fr,1fr]">
              <div>
                <h2 className="text-lg font-semibold">Add member</h2>
                <p className="text-xs text-slate-400">
                  Add a worker directly to the active roster.
                </p>
              </div>
              <div className="space-y-3">
                <label className="block text-sm text-slate-200">
                  Full name
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <label className="block text-sm text-slate-200">
                  National ID (optional)
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(event) => setNationalId(event.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={submitting || !fullName.trim()}
                  className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Adding..." : "Add member"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">Active members</h2>
              {casesError ? (
                <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {casesError}
                </p>
              ) : null}
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-900/60 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Start date</th>
                      <th className="px-4 py-3 text-left">Case status</th>
                      <th className="px-4 py-3 text-left">Last update</th>
                      <th className="px-4 py-3 text-left">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeMembers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-400" colSpan={5}>
                          No active members.
                        </td>
                      </tr>
                    ) : (
                      activeMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="border-t border-slate-800 text-slate-200"
                        >
                          <td className="px-4 py-3">
                            {member.workers?.full_name ?? "Unknown"}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(
                              `${member.start_date}T00:00:00`,
                            ).toLocaleDateString()}
                          </td>
                          <td className="px-4 py-3">
                            {casesLoading ? (
                              <span className="text-xs text-slate-400">
                                Loading...
                              </span>
                            ) : (
                              (() => {
                                const caseRow =
                                  latestCasesByWorker[member.worker_id];
                                const status = getCaseStatus(caseRow);
                                return (
                                  <span
                                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${status.style}`}
                                  >
                                    {status.label}
                                  </span>
                                );
                              })()
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {casesLoading ? (
                              <span className="text-xs text-slate-400">
                                Loading...
                              </span>
                            ) : (
                              (() => {
                                const caseRow =
                                  latestCasesByWorker[member.worker_id];
                                if (!caseRow) {
                                  return "-";
                                }
                                return (
                                  <div className="space-y-1 text-sm">
                                    <p>{formatDateTime(caseRow.last_update_at)}</p>
                                    {caseRow.sla_deadline_at ? (
                                      <p className="text-xs text-slate-400">
                                        SLA {formatDate(caseRow.sla_deadline_at)}
                                      </p>
                                    ) : null}
                                  </div>
                                );
                              })()
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRemoval(member);
                                setEndedReason("quit");
                                setEndedNote("");
                              }}
                              className="rounded-md border border-rose-400/60 px-3 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/10"
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {selectedRemoval ? (
                <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/40 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-200">
                      Remove {selectedRemoval.workers?.full_name ?? "member"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedRemoval(null)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-slate-200">
                      Reason
                      <select
                        value={endedReason}
                        onChange={(event) => setEndedReason(event.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      >
                        {removalReasons.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm text-slate-200">
                      Note (optional)
                      <input
                        type="text"
                        value={endedNote}
                        onChange={(event) => setEndedNote(event.target.value)}
                        className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmRemove}
                    disabled={removing}
                    className="rounded-md bg-rose-400 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {removing ? "Removing..." : "Confirm removal"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                Inactive/Ended members (last 20)
              </h2>
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-900/60 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">End date</th>
                      <th className="px-4 py-3 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveMembers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-400" colSpan={3}>
                          No inactive members yet.
                        </td>
                      </tr>
                    ) : (
                      inactiveMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="border-t border-slate-800 text-slate-200"
                        >
                          <td className="px-4 py-3">
                            {member.workers?.full_name ?? "Unknown"}
                          </td>
                          <td className="px-4 py-3">
                            {member.end_date
                              ? new Date(
                                  `${member.end_date}T00:00:00`,
                                ).toLocaleDateString()
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {member.ended_reason
                              ? member.ended_reason.replace(/_/g, " ")
                              : "-"}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}
