"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ActionModal,
  ActionModalMode,
  ActionModalPayload,
} from "@/components/hr/ActionModal";
import { HistoryModal } from "@/components/hr/HistoryModal";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Profile = {
  role: string;
};

type TeamRow = {
  id: string;
  name: string;
  capacity?: number | null;
  district_id?: string | null;
  districts?: { id: string; name: string } | { id: string; name: string }[] | null;
};

type DistrictSummary = {
  id: string;
  name: string;
  teams_count: number;
  missing_total: number;
  open_cases: number;
  overdue: number;
  last_update: string | null;
};

type DashboardSummary = {
  total_teams: number;
  total_capacity: number;
  active_headcount: number;
  missing: number;
  open_cases_in_sla: number;
  open_cases_overdue: number;
  due_24h: number;
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
  teams:
    | TeamRow
    | TeamRow[]
    | null;
  workers: { id: string; full_name: string; national_id?: string | null; status?: string | null } | { id: string; full_name: string; national_id?: string | null; status?: string | null }[] | null;
  removedFromTeam?: boolean;
};

type CaseResponse = {
  data?: CaseRow;
  error?: string;
};

type ActionModalState = {
  caseId: string;
  mode: ActionModalMode;
  initialReplacementName?: string;
  initialReplacementStartDate?: string;
};

type DashboardResponse = {
  summary: DashboardSummary;
  districts: DistrictSummary[];
  teams: TeamRow[];
  cases: CaseRow[];
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

function formatDateTime(value: string | null) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function getTeamName(teams: CaseRow["teams"]) {
  if (!teams) {
    return "-";
  }

  if (Array.isArray(teams)) {
    return teams[0]?.name ?? "-";
  }

  return teams.name ?? "-";
}

function getTeamDistrict(teams: CaseRow["teams"]) {
  if (!teams) {
    return "-";
  }

  const team = Array.isArray(teams) ? teams[0] : teams;
  if (!team?.districts) {
    return "-";
  }

  if (Array.isArray(team.districts)) {
    return team.districts[0]?.name ?? "-";
  }

  return team.districts.name ?? "-";
}

function getWorkerName(workers: CaseRow["workers"]) {
  if (!workers) {
    return "-";
  }

  if (Array.isArray(workers)) {
    return workers[0]?.full_name ?? "-";
  }

  return workers.full_name ?? "-";
}

export default function HrDashboardPage() {
  const router = useRouter();
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [districts, setDistricts] = useState<DistrictSummary[]>([]);
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [actionCaseId, setActionCaseId] = useState<string | null>(null);
  const [actionModalState, setActionModalState] =
    useState<ActionModalState | null>(null);
  const [historyCaseId, setHistoryCaseId] = useState<string | null>(null);
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [recruitmentFilter, setRecruitmentFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const sortedCases = useMemo(
    () =>
      [...cases].sort(
        (a, b) =>
          new Date(b.reported_at).getTime() -
          new Date(a.reported_at).getTime(),
      ),
    [cases],
  );
  const availableTeams = useMemo(() => {
    if (!selectedDistrictId) {
      return teams;
    }

    return teams.filter((team) => team.district_id === selectedDistrictId);
  }, [selectedDistrictId, teams]);

  useEffect(() => {
    if (
      selectedTeamId &&
      !availableTeams.some((team) => team.id === selectedTeamId)
    ) {
      setSelectedTeamId("");
    }
  }, [availableTeams, selectedTeamId]);

  const getAccessToken = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const fetchDashboard = async (options?: { skipLoading?: boolean }) => {
    if (!options?.skipLoading) {
      setLoadingDashboard(true);
    }
    setError(null);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const params = new URLSearchParams();
      if (selectedDistrictId) {
        params.set("district_id", selectedDistrictId);
      }
      if (selectedTeamId) {
        params.set("team_id", selectedTeamId);
      }
      if (statusFilter) {
        params.set("status", statusFilter);
      }
      if (recruitmentFilter) {
        params.set("recruitment_status", recruitmentFilter);
      }
      if (startDate) {
        params.set("start_date", startDate);
      }
      if (endDate) {
        params.set("end_date", endDate);
      }

      const query = params.toString();
      const response = await fetch(`/api/hr/dashboard${query ? `?${query}` : ""}`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json()) as DashboardResponse & {
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "Failed to load dashboard data.");
        setLoadingDashboard(false);
        return;
      }

      setSummary(payload.summary);
      setDistricts(payload.districts);
      setTeams(payload.teams);
      setCases(payload.cases);
      setLoadingDashboard(false);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unexpected error.",
      );
      setLoadingDashboard(false);
    }
  };

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
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

      setLoading(false);
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (role !== "hr_prov") {
      return;
    }
    fetchDashboard();
  }, [
    role,
    selectedDistrictId,
    selectedTeamId,
    statusFilter,
    recruitmentFilter,
    startDate,
    endDate,
  ]);

  const handleReceive = async (
    caseId: string,
    payload: ActionModalPayload,
  ) => {
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
        body: JSON.stringify({
          caseId,
          signedBy: payload.signedBy,
          note: payload.note,
          documents: payload.documents.map((doc) => ({
            doc_scope: doc.docScope,
            doc_no: doc.docNo,
          })),
        }),
      });

      const responsePayload = (await response.json()) as CaseResponse;

      if (!response.ok) {
        setError(responsePayload.error ?? "Failed to receive case.");
        setActionCaseId(null);
        return;
      }

      if (responsePayload.data) {
        await fetchDashboard({ skipLoading: true });
      }

      setActionModalState(null);
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
    payload: ActionModalPayload,
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
          signedBy: payload.signedBy,
          note: payload.note,
          documents: payload.documents.map((doc) => ({
            doc_scope: doc.docScope,
            doc_no: doc.docNo,
          })),
          replacementWorkerName:
            outcome === "found" ? payload.replacementWorkerName : undefined,
          replacementStartDate:
            outcome === "found" ? payload.replacementStartDate : undefined,
        }),
      });

      const responsePayload = (await response.json()) as CaseResponse;

      if (!response.ok) {
        setError(responsePayload.error ?? "Failed to record outcome.");
        setActionCaseId(null);
        return;
      }

      if (responsePayload.data) {
        await fetchDashboard({ skipLoading: true });
      }

      setActionModalState(null);
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

  const submitActionModal = async (payload: ActionModalPayload) => {
    if (!actionModalState) {
      return;
    }

    if (actionModalState.mode === "receive") {
      await handleReceive(actionModalState.caseId, payload);
      return;
    }

    const outcome =
      actionModalState.mode === "record_found" ? "found" : "not_found";
    await handleRecordOutcome(actionModalState.caseId, outcome, payload);
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
        await fetchDashboard({ skipLoading: true });
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
        await fetchDashboard({ skipLoading: true });
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
          <div className="space-y-6">
            {error ? (
              <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            <div className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/40 p-4 md:grid-cols-3 lg:grid-cols-6">
              <div>
                <p className="text-xs uppercase text-slate-400">Total teams</p>
                <p className="text-lg font-semibold text-white">
                  {summary?.total_teams ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Capacity</p>
                <p className="text-lg font-semibold text-white">
                  {summary?.total_capacity ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">
                  Active headcount
                </p>
                <p className="text-lg font-semibold text-white">
                  {summary?.active_headcount ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Missing</p>
                <p className="text-lg font-semibold text-white">
                  {summary?.missing ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">In SLA</p>
                <p className="text-lg font-semibold text-white">
                  {summary?.open_cases_in_sla ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-400">Overdue</p>
                <p className="text-lg font-semibold text-white">
                  {summary?.open_cases_overdue ?? 0}
                </p>
              </div>
            </div>

            <div className="grid gap-4 rounded-lg border border-slate-800 bg-slate-900/30 p-4 md:grid-cols-6">
              <label className="text-xs uppercase text-slate-400">
                District
                <select
                  value={selectedDistrictId}
                  onChange={(event) => {
                    setSelectedDistrictId(event.target.value);
                    setSelectedTeamId("");
                  }}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="">All districts</option>
                  {districts.map((district) => (
                    <option key={district.id} value={district.id}>
                      {district.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase text-slate-400">
                Team
                <select
                  value={selectedTeamId}
                  onChange={(event) => setSelectedTeamId(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="">All teams</option>
                  {availableTeams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase text-slate-400">
                Status
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_sla">In SLA</option>
                  <option value="overdue">Overdue</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
              <label className="text-xs uppercase text-slate-400">
                Recruitment
                <select
                  value={recruitmentFilter}
                  onChange={(event) => setRecruitmentFilter(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                >
                  <option value="">All</option>
                  <option value="awaiting">Awaiting</option>
                  <option value="found">Found</option>
                  <option value="not_found">Not found</option>
                </select>
              </label>
              <label className="text-xs uppercase text-slate-400">
                Start date
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="text-xs uppercase text-slate-400">
                End date
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
                />
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">District summary</h2>
                {summary ? (
                  <span className="text-xs text-slate-400">
                    Due &lt;= 24h: {summary.due_24h}
                  </span>
                ) : null}
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-800">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-900/60 text-slate-300">
                    <tr>
                      <th className="px-4 py-3 text-left">District</th>
                      <th className="px-4 py-3 text-left">Teams</th>
                      <th className="px-4 py-3 text-left">Missing</th>
                      <th className="px-4 py-3 text-left">Open cases</th>
                      <th className="px-4 py-3 text-left">Overdue</th>
                      <th className="px-4 py-3 text-left">Last update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {districts.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-400" colSpan={6}>
                          No districts configured yet.
                        </td>
                      </tr>
                    ) : (
                      districts.map((district) => (
                        <tr
                          key={district.id}
                          className="border-t border-slate-800 text-slate-200"
                        >
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDistrictId(district.id);
                                setSelectedTeamId("");
                              }}
                              className="text-left text-sm font-semibold text-white transition hover:text-slate-200"
                            >
                              {district.name}
                            </button>
                          </td>
                          <td className="px-4 py-3">{district.teams_count}</td>
                          <td className="px-4 py-3">{district.missing_total}</td>
                          <td className="px-4 py-3">{district.open_cases}</td>
                          <td className="px-4 py-3">{district.overdue}</td>
                          <td className="px-4 py-3">
                            {formatDateTime(district.last_update)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {loadingDashboard ? (
              <p className="text-sm text-slate-400">Loading dashboard...</p>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-900/60 text-slate-300">
                  <tr>
                    <th className="px-4 py-3 text-left">District</th>
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
                      <td className="px-4 py-4 text-slate-400" colSpan={11}>
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
                            {getTeamDistrict(caseItem.teams)}
                          </td>
                          <td className="px-4 py-3">
                            {getTeamName(caseItem.teams)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span>{getWorkerName(caseItem.workers)}</span>
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
                                  onClick={() => {
                                    setActionModalState({
                                      caseId: caseItem.id,
                                      mode: "receive",
                                    });
                                    setError(null);
                                  }}
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
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionModalState({
                                        caseId: caseItem.id,
                                        mode: "record_found",
                                        initialReplacementName:
                                          caseItem.replacement_worker_name ?? "",
                                        initialReplacementStartDate:
                                          caseItem.replacement_start_date ?? "",
                                      });
                                      setError(null);
                                    }}
                                    className="rounded-md border border-emerald-400/60 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/10"
                                  >
                                    Record Found
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActionModalState({
                                        caseId: caseItem.id,
                                        mode: "record_not_found",
                                      });
                                      setError(null);
                                    }}
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
                                  disabled={
                                    actionCaseId === caseItem.id || !isWithinSla
                                  }
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
                              <button
                                type="button"
                                onClick={() => setHistoryCaseId(caseItem.id)}
                                className="rounded-md border border-slate-700 px-3 py-2 text-xs text-slate-200 transition hover:bg-slate-800/60"
                              >
                                History
                              </button>
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
      <ActionModal
        isOpen={Boolean(actionModalState)}
        mode={actionModalState?.mode ?? "receive"}
        title={
          actionModalState?.mode === "receive"
            ? "Receive & Send Documents"
            : actionModalState?.mode === "record_found"
              ? "Record Found Outcome"
              : "Record Not Found Outcome"
        }
        isSubmitting={
          Boolean(actionModalState) &&
          actionCaseId === actionModalState?.caseId
        }
        initialReplacementName={actionModalState?.initialReplacementName}
        initialReplacementStartDate={
          actionModalState?.initialReplacementStartDate
        }
        onClose={() => setActionModalState(null)}
        onSubmit={submitActionModal}
      />
      <HistoryModal
        isOpen={Boolean(historyCaseId)}
        caseId={historyCaseId}
        onClose={() => setHistoryCaseId(null)}
      />
    </main>
  );
}
