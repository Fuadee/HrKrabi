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
  teams: TeamRow | TeamRow[] | null;
  workers:
    | {
        id: string;
        full_name: string;
        national_id?: string | null;
        status?: string | null;
      }
    | {
        id: string;
        full_name: string;
        national_id?: string | null;
        status?: string | null;
      }[]
    | null;
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

type SlaBadge = {
  label: string;
  className: string;
};

const hrStatusLabels: Record<string, string> = {
  pending: "รอดำเนินการ",
  in_sla: "อยู่ใน SLA",
  sla_expired: "เกิน SLA",
  closed: "ปิดแล้ว",
};

const recruitmentStatusLabels: Record<string, string> = {
  awaiting: "รอดำเนินการ",
  found: "พบคนแทนแล้ว",
  not_found: "ยังไม่พบ",
};

const reasonLabels: Record<string, string> = {
  absent: "ขาดงาน",
  missing: "ขาดกำลังคน",
  quit: "ลาออก",
  other: "อื่น ๆ",
};

const formatReasonLabel = (value: string) =>
  reasonLabels[value] ?? value.replace(/_/g, " ");

const formatHrStatusLabel = (value: string) =>
  hrStatusLabels[value] ?? value.replace(/_/g, " ");

const formatRecruitmentLabel = (value: string) =>
  recruitmentStatusLabels[value] ?? value.replace(/_/g, " ");

function getSlaBadge(caseItem: CaseRow): SlaBadge {
  const statusLabel = formatHrStatusLabel(caseItem.hr_status);

  if (!caseItem.sla_deadline_at) {
    return {
      label: statusLabel,
      className:
        "badge border-slate-200 bg-slate-100 text-slate-700",
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
      className: "badge border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  if (diffDays <= 1) {
    return {
      label: statusLabel,
      className: "badge border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: statusLabel,
    className: "badge border-emerald-200 bg-emerald-50 text-emerald-700",
  };
}

function getRecruitmentBadge(caseItem: CaseRow): SlaBadge {
  const label = formatRecruitmentLabel(caseItem.recruitment_status);

  if (caseItem.recruitment_status === "found") {
    return {
      label,
      className: "badge border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (caseItem.recruitment_status === "not_found") {
    return {
      label,
      className: "badge border-rose-200 bg-rose-50 text-rose-700",
    };
  }

  return {
    label,
    className: "badge border-slate-200 bg-slate-100 text-slate-700",
  };
}

function formatDate(dateValue: string | null) {
  if (!dateValue) {
    return "-";
  }

  return new Date(`${dateValue}T00:00:00`).toLocaleDateString("th-TH");
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
  const [loading, setLoading] = useState(true);
  const [loadingCases, setLoadingCases] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [actionCaseId, setActionCaseId] = useState<string | null>(null);
  const [actionModalState, setActionModalState] =
    useState<ActionModalState | null>(null);
  const [historyCaseId, setHistoryCaseId] = useState<string | null>(null);

  const sortedCases = useMemo(
    () =>
      [...cases].sort(
        (a, b) =>
          new Date(b.reported_at).getTime() -
          new Date(a.reported_at).getTime(),
      ),
    [cases],
  );

  const getAccessToken = async () => {
    const supabase = getSupabaseBrowserClient();
    const { data: sessionData } = await supabase.auth.getSession();
    return sessionData.session?.access_token ?? null;
  };

  const fetchCases = async (options?: { skipLoading?: boolean }) => {
    if (!options?.skipLoading) {
      setLoadingCases(true);
    }
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: casesData, error: casesError } = await supabase
        .from("absence_cases")
        .select(
          "id, team_id, worker_id, membership_id, reason, reported_at, hr_status, sla_deadline_at, recruitment_status, replacement_worker_name, replacement_start_date, final_status, teams:team_id(id, name), workers:worker_id(id, full_name, national_id, status)",
        )
        .order("reported_at", { ascending: false })
        .limit(200);

      if (casesError) {
        setError(casesError.message);
        setLoadingCases(false);
        return;
      }

      const caseRows = casesData ?? [];
      const missingMembershipCases = caseRows.filter(
        (caseItem) => !caseItem.membership_id,
      );
      const workerIds = Array.from(
        new Set(missingMembershipCases.map((caseItem) => caseItem.worker_id)),
      );
      const membershipIds = Array.from(
        new Set(
          caseRows
            .map((caseItem) => caseItem.membership_id)
            .filter((membershipId): membershipId is string =>
              Boolean(membershipId),
            ),
        ),
      );
      const teamIds = Array.from(
        new Set(caseRows.map((caseItem) => caseItem.team_id)),
      );
      const activeMembershipLookup = new Set<string>();
      const membershipActiveLookup = new Map<string, boolean>();

      if (workerIds.length > 0 && teamIds.length > 0) {
        const { data: activeRows, error: activeError } = await supabase
          .from("team_memberships")
          .select("team_id, worker_id")
          .eq("active", true)
          .in("worker_id", workerIds)
          .in("team_id", teamIds);

        if (activeError) {
          setError(activeError.message);
          setLoadingCases(false);
          return;
        }

        activeRows?.forEach((membership) => {
          activeMembershipLookup.add(
            `${membership.team_id}-${membership.worker_id}`,
          );
        });
      }

      if (membershipIds.length > 0) {
        const { data: membershipRows, error: membershipError } = await supabase
          .from("team_memberships")
          .select("id, active")
          .in("id", membershipIds);

        if (membershipError) {
          setError(membershipError.message);
          setLoadingCases(false);
          return;
        }

        membershipRows?.forEach((membership) => {
          membershipActiveLookup.set(membership.id, membership.active);
        });
      }

      const normalizedCases: CaseRow[] = caseRows.map((caseItem) => {
        const key = `${caseItem.team_id}-${caseItem.worker_id}`;
        const hasActiveMembership = caseItem.membership_id
          ? membershipActiveLookup.get(caseItem.membership_id) ?? false
          : activeMembershipLookup.has(key);

        return {
          ...caseItem,
          removedFromTeam: !hasActiveMembership,
        };
      });

      setCases(normalizedCases);
      setLoadingCases(false);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
      );
      setLoadingCases(false);
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
        setError(profileError?.message ?? "ไม่สามารถโหลดโปรไฟล์ได้");
        setLoading(false);
        return;
      }

      setRole(profile.role);

      if (profile.role !== "hr_prov") {
        setError("เฉพาะ HR จังหวัดเท่านั้นที่เข้าถึงแดชบอร์ดนี้ได้");
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
    fetchCases();
  }, [role]);

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
        setError(responsePayload.error ?? "ไม่สามารถรับเคสได้");
        setActionCaseId(null);
        return;
      }

      if (responsePayload.data) {
        await fetchCases({ skipLoading: true });
      }

      setActionModalState(null);
      setActionCaseId(null);
    } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
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
        setError(responsePayload.error ?? "ไม่สามารถบันทึกผลได้");
        setActionCaseId(null);
        return;
      }

      if (responsePayload.data) {
        await fetchCases({ skipLoading: true });
      }

      setActionModalState(null);
      setActionCaseId(null);
    } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
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
        setError(payload.error ?? "ไม่สามารถอนุมัติการสลับกำลังคนได้");
        setActionCaseId(null);
        return;
      }

      if (payload.data) {
        await fetchCases({ skipLoading: true });
      }

      setActionCaseId(null);
    } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
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
        setError(payload.error ?? "ไม่สามารถระบุเป็นตำแหน่งว่างได้");
        setActionCaseId(null);
        return;
      }

      if (payload.data) {
        await fetchCases({ skipLoading: true });
      }

      setActionCaseId(null);
    } catch (actionError) {
        setError(
          actionError instanceof Error
            ? actionError.message
            : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
        );
      setActionCaseId(null);
    }
  };

  return (
    <main className="flex w-full flex-col gap-6 text-left text-text-main">
      <div className="card-surface w-full space-y-6 p-6">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">
              แดชบอร์ด HR จังหวัด
            </h1>
            <span className="h-2 w-20 rounded-full bg-ig" />
          </div>
          <p className="mt-2 text-sm text-text-muted">
            รับเคส บันทึกผลการสรรหา และปิดงานแทน/ว่าง
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-text-muted">กำลังโหลดเคส...</p>
        ) : null}
        {!loading && role !== "hr_prov" ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error ?? "ไม่มีสิทธิ์เข้าถึง"}
          </p>
        ) : null}
        {!loading && role === "hr_prov" ? (
          <div className="space-y-6">
            {error ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </p>
            ) : null}

            {loadingCases ? (
              <p className="text-sm text-text-muted">กำลังโหลดเคส...</p>
            ) : null}

            <div className="overflow-hidden rounded-2xl border border-border-soft bg-surface shadow-card">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="table-header-cell px-4 py-3 text-left">
                      ทีม
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      ผู้ปฏิบัติงาน
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      เหตุผล
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      วันที่รายงาน
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      สถานะ HR
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      กำหนดเสร็จ (SLA)
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      การสรรหา
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      ผู้แทน
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      วันที่เริ่ม
                    </th>
                    <th className="table-header-cell px-4 py-3 text-left">
                      การดำเนินการ
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-soft">
                  {sortedCases.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-text-muted" colSpan={10}>
                        ยังไม่มีเคสการขาดงาน
                      </td>
                    </tr>
                  ) : (
                    sortedCases.map((caseItem) => {
                      const badge = getSlaBadge(caseItem);
                      const recruitmentBadge = getRecruitmentBadge(caseItem);
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
                          className={`table-row-hover text-sm text-text-main ${
                            actionCaseId === caseItem.id
                              ? "bg-lavender-tint"
                              : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            {getTeamName(caseItem.teams)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-col gap-1">
                              <span>{getWorkerName(caseItem.workers)}</span>
                              {caseItem.removedFromTeam ? (
                                <span className="badge w-fit border-rose-200 bg-rose-50 text-rose-700">
                                  ถูกนำออกจากทีม
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {formatReasonLabel(caseItem.reason)}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(caseItem.reported_at).toLocaleString(
                              "th-TH",
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={badge.className}>{badge.label}</span>
                          </td>
                          <td className="px-4 py-3">
                            {formatDate(caseItem.sla_deadline_at)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={recruitmentBadge.className}>
                              {recruitmentBadge.label}
                            </span>
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
                                  className="btn-primary-ig"
                                >
                                  {actionCaseId === caseItem.id
                                    ? "กำลังส่ง..."
                                    : "รับเคส"}
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
                                          caseItem.replacement_worker_name ??
                                          "",
                                        initialReplacementStartDate:
                                          caseItem.replacement_start_date ??
                                          "",
                                      });
                                      setError(null);
                                    }}
                                    className="btn-success"
                                  >
                                    บันทึก: พบคนแทน
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
                                    className="btn-warning"
                                  >
                                    {actionCaseId === caseItem.id
                                      ? "กำลังบันทึก..."
                                      : "บันทึก: ยังไม่พบคนแทน"}
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
                                  className="btn-success"
                                >
                                  ปิดงาน
                                </button>
                              ) : null}
                              {isNotFound && isOpen && isAfterSla ? (
                                <button
                                  type="button"
                                  onClick={() => handleMarkVacant(caseItem.id)}
                                  disabled={actionCaseId === caseItem.id}
                                  className="btn-danger"
                                >
                                  ปิดงาน: ตำแหน่งว่าง
                                </button>
                              ) : null}
                              {!isPending && !isOpen ? (
                                <span className="text-xs text-text-muted">
                                  ปิดงานแล้ว
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setHistoryCaseId(caseItem.id)}
                                className="btn-ghost"
                              >
                                ประวัติ
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
            ? "รับเคสและส่งเอกสาร"
            : actionModalState?.mode === "record_found"
              ? "บันทึกผล: พบคนแทน"
              : "บันทึกผล: ยังไม่พบคนแทน"
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
