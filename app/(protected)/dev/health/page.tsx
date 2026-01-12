"use client";

import { useEffect, useState } from "react";

type HealthResponse = {
  ok: boolean;
  supabaseUrlPresent: boolean;
  serviceKeyPresent: boolean;
  queryOk: boolean;
  serverReachable: boolean;
  count?: number;
  errorSummary?: string;
  errorCode?: string;
  errorDetails?: string;
};

/**
 * UI สำหรับตรวจสอบการเชื่อมต่อ Supabase ระหว่างการพัฒนา
 */
export default function DevHealthPage() {
  const [data, setData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/dev/health", { cache: "no-store" });
        const json = (await response.json()) as HealthResponse;
        if (!cancelled) {
          setData(json);
        }
      } catch (err) {
        if (!cancelled) {
          setData({
            ok: false,
            supabaseUrlPresent: false,
            serviceKeyPresent: false,
            queryOk: false,
            serverReachable: false,
            errorSummary:
              err instanceof Error ? err.message : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ",
          });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, []);

  const statusColor = data?.queryOk
    ? "text-emerald-300"
    : "text-rose-300";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6 text-[#E7EEF8]">
      <h1 className="text-2xl font-semibold">ตรวจสุขภาพ Supabase</h1>
      {loading ? (
        <p>กำลังตรวจสอบสถานะ...</p>
      ) : (
        <p className={`text-lg font-medium ${statusColor}`}>
          {data?.queryOk
            ? "ปกติ"
            : data?.errorSummary || "การเชื่อมต่อ Supabase ล้มเหลว"}
        </p>
      )}
      <section className="rounded-xl border border-white/5 bg-[#0B1220] p-4">
        <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-400">
          ผลลัพธ์ดิบ
        </h2>
        <pre className="mt-2 overflow-auto text-sm text-slate-300">
          {JSON.stringify(data, null, 2)}
        </pre>
      </section>
    </main>
  );
}
