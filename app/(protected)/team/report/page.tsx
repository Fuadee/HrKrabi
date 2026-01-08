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
  { value: "absent", label: "Absent" },
  { value: "missing", label: "Missing" },
  { value: "quit", label: "Quit" },
];

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
        setError(profileError?.message ?? "Unable to load profile.");
        setLoading(false);
        return;
      }

      setRole(profile.role);

      if (profile.role !== "team_lead") {
        const redirectTarget = getDefaultRouteForRole(profile.role);
        setError("Only team leads can report cases.");
        setLoading(false);
        router.replace(redirectTarget);
        return;
      }

      if (!profile.team_id) {
        setError("No team assigned to your profile.");
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
        setError("Select a worker to report.");
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
        setError(payload.error ?? "Failed to report case.");
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
          : "Unexpected error.",
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center text-white">
      <div className="w-full max-w-xl space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-left">
        <div>
          <h1 className="text-2xl font-semibold">Report absence case</h1>
          <p className="text-sm text-slate-400">
            One-click report for missing or absent workers.
          </p>
        </div>
        {loading ? (
          <p className="text-sm text-slate-300">Loading team data...</p>
        ) : null}
        {!loading && role !== "team_lead" ? (
          <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {error ?? "Access restricted."}
          </p>
        ) : null}
        {!loading && role === "team_lead" ? (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-200">
              Select worker
              <select
                value={workerId}
                onChange={(event) => setWorkerId(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-slate-400 focus:outline-none"
              >
                {sortedWorkers.length === 0 ? (
                  <option value="">No workers available</option>
                ) : (
                  sortedWorkers.map((worker) => (
                    <option key={worker.id} value={worker.id}>
                      {worker.full_name} ({worker.status})
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Reason
              <select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-slate-400 focus:outline-none"
              >
                {reasons.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Last seen date (optional)
              <input
                type="date"
                value={lastSeenDate}
                onChange={(event) => setLastSeenDate(event.target.value)}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-slate-400 focus:outline-none"
              />
            </label>
            <label className="block text-sm font-medium text-slate-200">
              Note (optional)
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white focus:border-slate-400 focus:outline-none"
                placeholder="Extra context for the case"
              />
            </label>
            {error ? (
              <p className="rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
                Case reported: {success.id} at {success.reported_at}
              </p>
            ) : null}
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || sortedWorkers.length === 0}
              className="w-full rounded-md bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Reporting..." : "Report Case"}
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
