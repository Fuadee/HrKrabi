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
 * Simple UI for validating Supabase connectivity during development.
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
            errorSummary: err instanceof Error ? err.message : "Unknown error",
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

  const statusColor = data?.queryOk ? "text-green-600" : "text-red-600";

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Supabase Health Check</h1>
      {loading ? (
        <p>Loading health status…</p>
      ) : (
        <p className={`text-lg font-medium ${statusColor}`}>
          {data?.queryOk ? "OK" : data?.errorSummary || "Supabase query failed"}
        </p>
      )}
      <section className="rounded border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold uppercase text-slate-500">
          Raw Response
        </h2>
        <pre className="mt-2 overflow-auto text-sm">
          {JSON.stringify(data, null, 2)}
        </pre>
      </section>
    </main>
  );
}
