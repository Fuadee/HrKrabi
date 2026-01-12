"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getDefaultRouteForRole } from "@/lib/roleRedirect";
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

type ActiveMembershipRow = {
  id: string;
  worker_id: string;
  start_date: string;
  workers: { full_name: string } | { full_name: string }[] | null;
};

type InactiveMembershipRow = {
  id: string;
  worker_id: string;
  end_date: string | null;
  ended_reason: string | null;
  workers: { full_name: string } | { full_name: string }[] | null;
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
  { value: "quit", label: "ลาออก" },
  { value: "absent_3days", label: "ขาดงาน 3 วัน" },
  { value: "replaced", label: "ถูกแทนที่" },
  { value: "other", label: "อื่น ๆ" },
];

export default function TeamDashboardPage() {
  const router = useRouter();
  const [team, setTeam] = useState<TeamRow | null>(null);
  const [activeMembers, setActiveMembers] = useState<ActiveMembershipRow[]>([]);
  const [inactiveMembers, setInactiveMembers] = useState<
    InactiveMembershipRow[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedRemoval, setSelectedRemoval] =
    useState<ActiveMembershipRow | null>(null);
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
      setError(profileError?.message ?? "ไม่สามารถโหลดโปรไฟล์ได้");
      setLoading(false);
      return;
    }

    setRole(profile.role);

    if (profile.role !== "team_lead") {
      const redirectTarget = getDefaultRouteForRole(profile.role);
      setError("เฉพาะหัวหน้าทีมเท่านั้นที่เข้าถึงแดชบอร์ดได้");
      setLoading(false);
      setCasesLoading(false);
      router.replace(redirectTarget);
      return;
    }

    if (!profile.team_id) {
      setError("โปรไฟล์ของคุณยังไม่ได้ระบุทีม");
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
      setError(teamError?.message ?? "ไม่สามารถโหลดข้อมูลทีมได้");
      setLoading(false);
      setCasesLoading(false);
      return;
    }

    const { data: activeData, error: activeError } = await supabase
      .from("team_memberships")
      .select(
        "id, worker_id, start_date, workers:worker_id(id, full_name, national_id, status)",
      )
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
      .select(
        "id, worker_id, end_date, ended_reason, workers:worker_id(id, full_name, national_id, status)",
      )
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
            "ไม่สามารถดึงสถานะเคสได้ แต่ยังสามารถดูรายชื่อกำลังคนได้",
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
    setActiveMembers(activeData ?? []);
    setInactiveMembers(inactiveData ?? []);
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
    value ? new Date(value).toLocaleDateString("th-TH") : "-";
  const formatDateTime = (value?: string | null) =>
    value ? new Date(value).toLocaleString("th-TH") : "-";
  const getWorkerName = (
    worker: { full_name: string } | { full_name: string }[] | null,
  ) => (Array.isArray(worker) ? worker[0]?.full_name : worker?.full_name);

  const statusStyles: Record<string, string> = {
    reported: "badge bg-slate-800/60 text-slate-200 border-slate-600/40",
    in_sla: "badge bg-emerald-500/10 text-emerald-200 border-emerald-500/30",
    sla_expired: "badge bg-amber-500/10 text-amber-200 border-amber-500/30",
    not_found: "badge bg-rose-500/10 text-rose-200 border-rose-500/30",
    found: "badge bg-sky-500/10 text-sky-200 border-sky-500/30",
    swapped: "badge bg-violet-500/10 text-violet-200 border-violet-500/30",
    vacant: "badge bg-orange-500/10 text-orange-200 border-orange-500/30",
    closed: "badge bg-slate-600/30 text-slate-100 border-slate-500/40",
    default: "badge bg-slate-800/60 text-slate-200 border-slate-600/40",
  };

  const getCaseStatus = (caseRow?: CaseRow | null) => {
    if (!caseRow) {
      return { label: "—", style: statusStyles.default };
    }

    const finalStatus = caseRow.final_status;
    if (["swapped", "vacant", "closed"].includes(finalStatus)) {
      return {
        label:
          finalStatus === "swapped"
            ? "สลับกำลังคนแล้ว"
            : finalStatus === "vacant"
              ? "ตำแหน่งว่าง"
              : "ปิดแล้ว",
        style: statusStyles[finalStatus] ?? statusStyles.default,
      };
    }

    if (caseRow.hr_status === "pending" && !caseRow.hr_received_at) {
      return { label: "รายงานแล้ว", style: statusStyles.reported };
    }
    if (caseRow.hr_status === "in_sla") {
      return { label: "อยู่ใน SLA", style: statusStyles.in_sla };
    }
    if (caseRow.hr_status === "sla_expired") {
      return { label: "เกิน SLA", style: statusStyles.sla_expired };
    }
    if (caseRow.recruitment_status === "not_found") {
      return { label: "ยังไม่พบ", style: statusStyles.not_found };
    }
    if (caseRow.recruitment_status === "found") {
      return { label: "พบคนแทนแล้ว", style: statusStyles.found };
    }

    return { label: "กำลังดำเนินการ", style: statusStyles.default };
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
        setError(payload.error ?? "ไม่สามารถเพิ่มกำลังคนได้");
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
          : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
      );
      setSubmitting(false);
    }
  };

  const handleConfirmRemove = async () => {
    if (!selectedRemoval) {
      return;
    }

    const memberName = getWorkerName(selectedRemoval.workers) ?? "กำลังคนนี้";
    const confirmed = window.confirm(
      `ต้องการนำ ${memberName} ออกจากรายชื่อปฏิบัติงานหรือไม่`,
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
        setError(payload.error ?? "ไม่สามารถนำกำลังคนออกได้");
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
          : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
      );
      setRemoving(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-[#E7EEF8]">
      <div className="w-full max-w-6xl space-y-6 rounded-2xl border border-white/5 bg-[#0B1220]/80 p-6 text-left shadow-[0_20px_60px_rgba(5,8,20,0.45)]">
        <div>
          <h1 className="text-2xl font-semibold">แดชบอร์ดกำลังคนของทีม</h1>
          <p className="text-sm text-slate-400">
            บริหารรายชื่อและติดตามกำลังคนปฏิบัติงานของทีม
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">กำลังโหลดรายชื่อ...</p>
        ) : null}
        {!loading && role !== "team_lead" ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error ?? "ไม่มีสิทธิ์เข้าถึง"}
          </p>
        ) : null}
        {!loading && role === "team_lead" ? (
          <div className="space-y-6">
            {error ? (
              <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            <div className="grid gap-4 rounded-xl border border-white/5 bg-[#0E1629] p-4 md:grid-cols-4">
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  ทีม
                </p>
                <p className="text-lg font-semibold text-[#E7EEF8]">
                  {team?.name ?? "-"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  อัตรากำลัง
                </p>
                <p className="text-lg font-semibold text-[#E7EEF8]">
                  {team?.capacity ?? 0}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  กำลังคนปฏิบัติงาน
                </p>
                <p className="text-lg font-semibold text-[#E7EEF8]">
                  {headcount}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">
                  ขาด
                </p>
                <p className="text-lg font-semibold text-[#E7EEF8]">
                  {missingCount}
                </p>
              </div>
            </div>

            <div className="grid gap-4 rounded-xl border border-white/5 bg-[#0E1629] p-4 md:grid-cols-[2fr,1fr]">
              <div>
                <h2 className="text-lg font-semibold">เพิ่มกำลังคน</h2>
                <p className="text-xs text-slate-400">
                  เพิ่มผู้ปฏิบัติงานเข้าสู่รายชื่อปฏิบัติงานทันที
                </p>
              </div>
              <div className="space-y-3">
                <label className="block text-sm text-slate-200">
                  ชื่อ-สกุล
                  <input
                    type="text"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="input-premium mt-1"
                  />
                </label>
                <label className="block text-sm text-slate-200">
                  เลขประจำตัวประชาชน (ถ้ามี)
                  <input
                    type="text"
                    value={nationalId}
                    onChange={(event) => setNationalId(event.target.value)}
                    className="input-premium mt-1"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleAddMember}
                  disabled={submitting || !fullName.trim()}
                  className="btn-gold w-full text-sm"
                >
                  {submitting ? "กำลังเพิ่ม..." : "เพิ่มกำลังคน"}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">กำลังคนปฏิบัติงาน</h2>
              {casesError ? (
                <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                  {casesError}
                </p>
              ) : null}
              <div className="overflow-hidden rounded-xl border border-white/5">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[#0E1629]">
                    <tr>
                      <th className="table-header-cell px-4 py-3 text-left">
                        ชื่อ-สกุล
                      </th>
                      <th className="table-header-cell px-4 py-3 text-left">
                        วันที่เริ่ม
                      </th>
                      <th className="table-header-cell px-4 py-3 text-left">
                        สถานะเคส
                      </th>
                      <th className="table-header-cell px-4 py-3 text-left">
                        อัปเดตล่าสุด
                      </th>
                      <th className="table-header-cell px-4 py-3 text-left">
                        การดำเนินการ
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {activeMembers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-400" colSpan={5}>
                          ยังไม่มีรายชื่อปฏิบัติงาน
                        </td>
                      </tr>
                    ) : (
                      activeMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="table-row-hover text-slate-200"
                        >
                          <td className="px-4 py-3">
                            {getWorkerName(member.workers) ?? "ไม่ทราบชื่อ"}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(
                              `${member.start_date}T00:00:00`,
                            ).toLocaleDateString("th-TH")}
                          </td>
                          <td className="px-4 py-3">
                            {casesLoading ? (
                              <span className="text-xs text-slate-400">
                                กำลังโหลด...
                              </span>
                            ) : (
                              (() => {
                                const caseRow =
                                  latestCasesByWorker[member.worker_id];
                                const status = getCaseStatus(caseRow);
                                return (
                                  <span className={status.style}>
                                    {status.label}
                                  </span>
                                );
                              })()
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {casesLoading ? (
                              <span className="text-xs text-slate-400">
                                กำลังโหลด...
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
                                        กำหนด SLA{" "}
                                        {formatDate(caseRow.sla_deadline_at)}
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
                              className="btn-destructive"
                            >
                              ลบออก
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {selectedRemoval ? (
                <div className="space-y-3 rounded-xl border border-white/5 bg-[#0E1629] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-200">
                      ลบ{" "}
                      {getWorkerName(selectedRemoval.workers) ?? "กำลังคน"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedRemoval(null)}
                      className="text-xs text-slate-400 hover:text-slate-200"
                    >
                      ยกเลิก
                    </button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="block text-sm text-slate-200">
                      เหตุผล
                      <select
                        value={endedReason}
                        onChange={(event) => setEndedReason(event.target.value)}
                        className="select-premium mt-1"
                      >
                        {removalReasons.map((item) => (
                          <option key={item.value} value={item.value}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm text-slate-200">
                      หมายเหตุ (ถ้ามี)
                      <input
                        type="text"
                        value={endedNote}
                        onChange={(event) => setEndedNote(event.target.value)}
                        className="input-premium mt-1"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmRemove}
                    disabled={removing}
                    className="btn-destructive px-4 py-2 text-sm"
                  >
                    {removing ? "กำลังลบ..." : "ยืนยันการลบ"}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="space-y-3">
              <h2 className="text-lg font-semibold">
                กำลังคนที่สิ้นสุด (20 รายการล่าสุด)
              </h2>
              <div className="overflow-hidden rounded-xl border border-white/5">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-[#0E1629]">
                    <tr>
                      <th className="table-header-cell px-4 py-3 text-left">
                        ชื่อ-สกุล
                      </th>
                      <th className="table-header-cell px-4 py-3 text-left">
                        วันที่สิ้นสุด
                      </th>
                      <th className="table-header-cell px-4 py-3 text-left">
                        เหตุผล
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {inactiveMembers.length === 0 ? (
                      <tr>
                        <td className="px-4 py-4 text-slate-400" colSpan={3}>
                          ยังไม่มีรายชื่อที่สิ้นสุด
                        </td>
                      </tr>
                    ) : (
                      inactiveMembers.map((member) => (
                        <tr
                          key={member.id}
                          className="table-row-hover text-slate-200"
                        >
                          <td className="px-4 py-3">
                            {getWorkerName(member.workers) ?? "ไม่ทราบชื่อ"}
                          </td>
                          <td className="px-4 py-3">
                            {member.end_date
                              ? new Date(
                                  `${member.end_date}T00:00:00`,
                                ).toLocaleDateString("th-TH")
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            {member.ended_reason
                              ? removalReasons.find(
                                  (reason) =>
                                    reason.value === member.ended_reason,
                                )?.label ?? member.ended_reason.replace(/_/g, " ")
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
