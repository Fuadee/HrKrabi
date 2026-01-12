"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { getDefaultRouteForRole } from "@/lib/roleRedirect";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

type Worker = {
  id: string;
  full_name: string;
  status: string;
};

type Profile = {
  role: string;
  team_id: string | null;
};

type CaseResponse = {
  id: string;
  reported_at: string;
};

const reasons = [
  { value: "absent", label: "ขาดงาน" },
  { value: "missing", label: "ขาดกำลังคน" },
  { value: "quit", label: "ลาออก" },
];

const workerStatusLabels: Record<string, string> = {
  active: "ปฏิบัติงาน",
  inactive: "สิ้นสุดแล้ว",
};

const formatWorkerStatus = (value: string) =>
  workerStatusLabels[value] ?? value;

export default function TeamReportPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [reason, setReason] = useState("absent");
  const [lastSeenDate, setLastSeenDate] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CaseResponse | null>(null);
  const [role, setRole] = useState<string | null>(null);

  const sortedWorkers = useMemo(
    () =>
      [...workers].sort((a, b) => a.full_name.localeCompare(b.full_name)),
    [workers],
  );

  useEffect(() => {
    let isMounted = true;

    const loadWorkers = async () => {
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
        setError(profileError?.message ?? "ไม่สามารถโหลดโปรไฟล์ได้");
        setLoading(false);
        return;
      }

      setRole(profile.role);

      if (profile.role !== "team_lead") {
        const redirectTarget = getDefaultRouteForRole(profile.role);
        setError("เฉพาะหัวหน้าทีมเท่านั้นที่รายงานเคสได้");
        setLoading(false);
        router.replace(redirectTarget);
        return;
      }

      if (!profile.team_id) {
        setError("โปรไฟล์ของคุณยังไม่ได้ระบุทีม");
        setLoading(false);
        return;
      }

      const { data: workersData, error: workersError } = await supabase
        .from("workers")
        .select("id, full_name, status")
        .eq("team_id", profile.team_id)
        .eq("status", "active")
        .order("full_name");

      if (!isMounted) {
        return;
      }

      if (workersError) {
        setError(workersError.message);
        setLoading(false);
        return;
      }

      setWorkers(workersData ?? []);
      setWorkerId(workersData?.[0]?.id ?? "");
      setLoading(false);
    };

    loadWorkers();

    return () => {
      isMounted = false;
    };
  }, [router]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      if (!workerId) {
        setError("กรุณาเลือกผู้ปฏิบัติงานเพื่อรายงาน");
        setSubmitting(false);
        return;
      }

      const response = await fetch("/api/team/report", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          worker_id: workerId,
          reason,
          last_seen_date: lastSeenDate || null,
          note: note.trim() || null,
        }),
      });

      const payload = (await response.json()) as {
        data?: { id: string; reported_at: string };
        error?: string;
      };

      if (!response.ok) {
        setError(payload.error ?? "ไม่สามารถรายงานเคสได้");
        setSubmitting(false);
        return;
      }

      setSuccess({
        id: payload.data?.id ?? "",
        reported_at: payload.data?.reported_at ?? new Date().toISOString(),
      });
      setNote("");
      setLastSeenDate("");
      setSubmitting(false);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "เกิดข้อผิดพลาดที่ไม่คาดคิด",
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-[#E7EEF8]">
      <div className="w-full max-w-xl space-y-4 rounded-2xl border border-white/5 bg-[#0B1220]/80 p-6 text-left shadow-[0_20px_60px_rgba(5,8,20,0.45)]">
        <div>
          <h1 className="text-2xl font-semibold">รายงานเคสขาดงาน</h1>
          <p className="text-sm text-slate-400">
            รายงานผู้ปฏิบัติงานที่ขาดงานหรือขาดกำลังคน
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">กำลังโหลดข้อมูลทีม...</p>
        ) : null}
        {!loading && role !== "team_lead" ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error ?? "ไม่มีสิทธิ์เข้าถึง"}
          </p>
        ) : null}
        {!loading && role === "team_lead" ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              เลือกผู้ปฏิบัติงาน
              <select
                value={workerId}
                onChange={(event) => setWorkerId(event.target.value)}
                className="select-premium mt-1"
              >
                {sortedWorkers.length === 0 ? (
                  <option value="">ไม่มีรายชื่อให้เลือก</option>
                ) : (
                  sortedWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name} ({formatWorkerStatus(worker.status)})
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              เหตุผล
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="select-premium mt-1"
              >
                {reasons.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              วันที่พบล่าสุด (ถ้ามี)
              <input
                type="date"
                value={lastSeenDate}
                onChange={(event) => setLastSeenDate(event.target.value)}
                className="input-premium mt-1"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              หมายเหตุ (ถ้ามี)
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="input-premium mt-1"
                placeholder="รายละเอียดเพิ่มเติมสำหรับเคสนี้"
              />
            </label>
            {error ? (
              <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                รายงานเคสสำเร็จ: {success.id} เมื่อ{" "}
                {new Date(success.reported_at).toLocaleString("th-TH")}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || sortedWorkers.length === 0}
              className="btn-gold w-full text-sm"
            >
              {submitting ? "กำลังรายงาน..." : "รายงานเคส"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
