import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ProfileRow = {
  role: string;
  team_id: string | null;
};

type CaseRow = {
  id: string;
  worker_id: string;
  reason: string;
  note: string | null;
  reported_at: string;
  hr_status: string;
  final_status: string;
  hr_received_at: string | null;
  sla_deadline_at: string | null;
  recruitment_status: string;
  recruitment_updated_at: string | null;
  hr_swap_approved_at: string | null;
};

type TeamCaseResponse = {
  id: string;
  worker_id: string;
  reported_at: string;
  hr_status: string;
  final_status: string;
  hr_received_at: string | null;
  sla_deadline_at: string | null;
  recruitment_status: string;
  recruitment_updated_at: string | null;
  hr_swap_approved_at: string | null;
  last_update_at: string;
};

function getSupabaseAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    const missing = [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `Missing Supabase environment variables: ${missing}. Check .env.local.`,
    );
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSupabaseAuthedClient(token: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    const missing = [
      !supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !anonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `Missing Supabase environment variables: ${missing}. Check .env.local.`,
    );
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

function computeLastUpdateAt(row: CaseRow) {
  const reportedTimestamp = new Date(row.reported_at).getTime();
  const timestamps = [
    reportedTimestamp,
    row.hr_received_at
      ? new Date(row.hr_received_at).getTime()
      : reportedTimestamp,
    row.recruitment_updated_at
      ? new Date(row.recruitment_updated_at).getTime()
      : reportedTimestamp,
    row.hr_swap_approved_at
      ? new Date(row.hr_swap_approved_at).getTime()
      : reportedTimestamp,
  ].filter((value) => !Number.isNaN(value));

  return new Date(Math.max(...timestamps)).toISOString();
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length)
      : null;

    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabaseAuth = getSupabaseAnonClient();
    const { data: userData, error: userError } =
      await supabaseAuth.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = getSupabaseAuthedClient(token);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, team_id")
      .eq("id", userData.user.id)
      .single<ProfileRow>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 403 });
    }

    if (profile.role !== "team_lead") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!profile.team_id) {
      return NextResponse.json(
        { error: "No team assigned to this profile." },
        { status: 403 },
      );
    }

    const workerIdsParam = request.nextUrl.searchParams.get("worker_ids");
    const workerIds = workerIdsParam
      ? workerIdsParam.split(",").map((id) => id.trim())
      : [];

    if (workerIds.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const { data: caseRows, error: casesError } = await supabase
      .from("absence_cases")
      .select(
        "distinct on (worker_id) id, worker_id, reported_at, hr_status, final_status, hr_received_at, sla_deadline_at, recruitment_status, recruitment_updated_at, hr_swap_approved_at",
      )
      .eq("team_id", profile.team_id)
      .in("worker_id", workerIds)
      .order("worker_id", { ascending: true })
      .order("reported_at", { ascending: false });

    if (casesError) {
      return NextResponse.json(
        { error: casesError.message },
        { status: 500 },
      );
    }

    const response: TeamCaseResponse[] = (caseRows ?? []).map((row) => ({
      id: row.id,
      worker_id: row.worker_id,
      reported_at: row.reported_at,
      hr_status: row.hr_status,
      final_status: row.final_status,
      hr_received_at: row.hr_received_at,
      sla_deadline_at: row.sla_deadline_at,
      recruitment_status: row.recruitment_status,
      recruitment_updated_at: row.recruitment_updated_at,
      hr_swap_approved_at: row.hr_swap_approved_at,
      last_update_at: computeLastUpdateAt(row),
    }));

    return NextResponse.json({ data: response });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
