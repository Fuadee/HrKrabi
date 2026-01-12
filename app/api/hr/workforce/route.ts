import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type TeamRow = {
  id: string;
  name: string;
  capacity: number;
  district_name: string | null;
  active_headcount: number;
  missing_capacity: number;
  open_cases: number;
  last_case_update: string | null;
  missing_count: number;
  last_update: string | null;
};

type TeamSummary = TeamRow & {
  active_headcount: number;
  missing_capacity: number;
  open_cases: number;
  last_case_update: string | null;
  missing_count: number;
  last_update: string | null;
};

type TeamOption = {
  id: string;
  name: string;
  district_name: string | null;
};

type MemberRow = {
  id: string;
  team_id: string;
  active: boolean;
  start_date: string;
  workers:
    | { full_name: string; national_id?: string | null; status?: string | null }
    | { full_name: string; national_id?: string | null; status?: string | null }[]
    | null;
};

const districtOptions = [
  "เมืองกระบี่",
  "อ่าวลึก",
  "เหนือคลอง",
  "เขาพนม",
  "คลองท่อม",
  "เกาะลันตา",
  "ไม่ระบุ",
];

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

function getSupabaseUserClient(token: string) {
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
    global: {
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function normalizeWorkerName(workers: MemberRow["workers"]) {
  if (!workers) {
    return null;
  }

  if (Array.isArray(workers)) {
    return workers[0] ?? null;
  }

  return workers;
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

    const searchParams = request.nextUrl.searchParams;
    const rawDistrict = searchParams.get("district")?.trim();
    const teamId = searchParams.get("teamId")?.trim() ?? null;
    const districtName =
      rawDistrict && rawDistrict.length > 0 ? rawDistrict : "ไม่ระบุ";

    if (!districtOptions.includes(districtName)) {
      return NextResponse.json(
        { error: "Invalid district." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const supabaseUser = getSupabaseUserClient(token);
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single<{ role: string }>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 403 });
    }

    if (profile.role !== "hr_prov") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: teamsInDistrict, error: teamsError } = await supabaseUser.rpc(
      "hr_get_team_workforce_summary",
      {
        p_district_name: districtName,
      },
    );

    if (teamsError) {
      return NextResponse.json(
        { error: teamsError.message },
        { status: 500 },
      );
    }

    const teamRows = (teamsInDistrict ?? []) as TeamRow[];
    const teamIds = teamRows.map((team) => team.id);

    const { data: availableTeams, error: availableTeamsError } =
      await supabaseUser.rpc("hr_get_team_workforce_summary", {
        p_district_name: null,
      });

    if (availableTeamsError) {
      return NextResponse.json(
        { error: availableTeamsError.message },
        { status: 500 },
      );
    }

    const availableTeamsRows = (availableTeams ?? []) as TeamOption[];

    const summaries: TeamSummary[] = teamRows.map((team) => ({
      ...team,
      active_headcount: Number(team.active_headcount ?? 0),
      missing_capacity: Number(team.missing_capacity ?? 0),
      open_cases: Number(team.open_cases ?? 0),
      last_case_update: team.last_case_update ?? null,
      missing_count: Number(team.missing_count ?? 0),
      last_update: team.last_update ?? null,
    }));

    let activeMembers: Array<{
      id: string;
      full_name: string;
      national_id?: string | null;
      status?: string | null;
      start_date: string;
      membership_status: string;
    }> = [];

    if (teamId && teamIds.includes(teamId)) {
      const { data: members, error: membersError } = await supabase
        .from("team_memberships")
        .select("id, team_id, active, start_date, workers(full_name, national_id, status)")
        .eq("team_id", teamId)
        .eq("active", true)
        .order("start_date", { ascending: true });

      if (membersError) {
        return NextResponse.json(
          { error: membersError.message },
          { status: 500 },
        );
      }

      activeMembers = (members ?? []).map((member) => {
        const worker = normalizeWorkerName(member.workers);
        return {
          id: member.id,
          full_name: worker?.full_name ?? "-",
          national_id: worker?.national_id ?? null,
          status: worker?.status ?? null,
          start_date: member.start_date,
          membership_status: member.active ? "active" : "inactive",
        };
      });
    }

    return NextResponse.json({
      data: {
        district: districtName,
        districts: districtOptions,
        teams: summaries,
        availableTeams: availableTeamsRows,
        activeMembers,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
