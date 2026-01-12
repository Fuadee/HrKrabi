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
  workers:
    | { id: string; full_name: string }
    | { id: string; full_name: string }[]
    | null;
};

const reasonLabels: Record<string, string> = {
  absent: "ขาดงาน",
  missing: "ขาดกำลังคน",
  quit: "ลาออก",
  other: "อื่น ๆ",
};

const statusLabels: Record<string, string> = {
  reported: "รายงานแล้ว",
  in_sla: "อยู่ใน SLA",
  sla_expired: "เกิน SLA",
  awaiting: "รอดำเนินการ",
  found: "พบคนแทนแล้ว",
  not_found: "ยังไม่พบ",
  closed: "ปิดแล้ว",
  open: "กำลังดำเนินการ",
};

const formatReason = (value: string) =>
  reasonLabels[value] ?? value.replace(/_/g, " ");

const formatStatus = (value: string) =>
  statusLabels[value] ?? value.replace(/_/g, " ");

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
        setError(profileError?.message ?? "ไม่สามารถโหลดโปรไฟล์ได้");
        setLoading(false);
        return;
      }

      setRole(profile.role);

      if (profile.role !== "team_lead") {
        const redirectTarget = getDefaultRouteForRole(profile.role);
        setError("เฉพาะหัวหน้าทีมเท่านั้นที่ดูเคสได้");
        setLoading(false);
        router.replace(redirectTarget);
        return;
      }

      const { data: casesData, error: casesError } = await supabase
        .from("absence_cases")
        .select(
          "id, reason, status, reported_at, workers:worker_id(id, full_name)",
        )
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
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-[#E7EEF8]">
      <div className="w-full max-w-3xl space-y-4 rounded-2xl border border-white/5 bg-[#0B1220]/80 p-6 text-left shadow-[0_20px_60px_rgba(5,8,20,0.45)]">
        <div>
          <h1 className="text-2xl font-semibold">เคสขาดงานล่าสุด</h1>
          <p className="text-sm text-slate-400">
            20 เคสล่าสุดที่รายงานสำหรับทีมของคุณ
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">กำลังโหลดเคส...</p>
        ) : null}
        {!loading && role !== "team_lead" ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error ?? "ไม่มีสิทธิ์เข้าถึง"}
          </p>
        ) : null}
        {!loading && role === "team_lead" ? (
          <div className="overflow-hidden rounded-xl border border-white/5">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-[#0E1629]">
                <tr>
                  <th className="table-header-cell px-4 py-3 text-left">
                    ผู้ปฏิบัติงาน
                  </th>
                  <th className="table-header-cell px-4 py-3 text-left">
                    เหตุผล
                  </th>
                  <th className="table-header-cell px-4 py-3 text-left">
                    สถานะ
                  </th>
                  <th className="table-header-cell px-4 py-3 text-left">
                    วันที่รายงาน
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {cases.length === 0 ? (
                  <tr>
                    <td
                      className="px-4 py-4 text-slate-400"
                      colSpan={4}
                    >
                      ยังไม่มีเคสที่รายงาน
                    </td>
                  </tr>
                ) : (
                  cases.map((caseItem) => {
                    const workerName = Array.isArray(caseItem.workers)
                      ? caseItem.workers[0]?.full_name
                      : caseItem.workers?.full_name;

                    return (
                      <tr
                        key={caseItem.id}
                        className="table-row-hover text-slate-200"
                      >
                        <td className="px-4 py-3">
                          {workerName ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          {formatReason(caseItem.reason)}
                        </td>
                        <td className="px-4 py-3">
                          {formatStatus(caseItem.status)}
                        </td>
                        <td className="px-4 py-3">
                          {new Date(caseItem.reported_at).toLocaleString(
                            "th-TH",
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </main>
  );
}
