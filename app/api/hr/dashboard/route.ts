import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ProfileRow = {
  role: string;
};

type TeamRow = {
  id: string;
  name: string;
  capacity: number | null;
  district_id: string | null;
  districts?: { id: string; name: string } | { id: string; name: string }[] | null;
};

type DistrictRow = {
  id: string;
  name: string;
};

type MembershipRow = {
  id: string;
  team_id: string;
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
  hr_received_at: string | null;
  recruitment_updated_at: string | null;
  hr_swap_approved_at: string | null;
  teams:
    | ({
        id: string;
        name: string;
        capacity?: number | null;
        district_id?: string | null;
        districts?: { id: string; name: string } | { id: string; name: string }[] | null;
      })
    | {
        id: string;
        name: string;
        capacity?: number | null;
        district_id?: string | null;
        districts?: { id: string; name: string } | { id: string; name: string }[] | null;
      }[]
    | null;
  workers:
    | { id: string; full_name: string; national_id?: string | null; status?: string | null }
    | { id: string; full_name: string; national_id?: string | null; status?: string | null }[]
    | null;
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

type DistrictSummary = {
  id: string;
  name: string;
  teams_count: number;
  missing_total: number;
  open_cases: number;
  overdue: number;
  last_update: string | null;
};

type DashboardCase = CaseRow & { removedFromTeam?: boolean };

type DashboardResponse = {
  summary: DashboardSummary;
  districts: DistrictSummary[];
  teams: TeamRow[];
  cases: DashboardCase[];
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

function getTeamDistrictId(team: TeamRow | null | undefined): string | null {
  return team?.district_id ?? null;
}

function computeLastUpdateAt(caseRow: CaseRow): string {
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
}

function getDeadlineFlags(caseRow: CaseRow, today: Date) {
  if (!caseRow.sla_deadline_at) {
    return { isOverdue: false, isInSla: false, dueSoon: false };
  }

  const deadline = new Date(`${caseRow.sla_deadline_at}T00:00:00`);
  const diffDays = Math.round(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );
  const isOverdue =
    caseRow.final_status === "open" &&
    (diffDays < 0 || caseRow.hr_status === "sla_expired");
  const isInSla =
    caseRow.final_status === "open" &&
    diffDays >= 0 &&
    caseRow.hr_status !== "sla_expired";
  const dueSoon = caseRow.final_status === "open" && diffDays >= 0 && diffDays <= 1;

  return { isOverdue, isInSla, dueSoon };
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

    const supabase = getSupabaseServerClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single<ProfileRow>();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found." }, { status: 403 });
    }

    if (profile.role !== "hr_prov") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const searchParams = request.nextUrl.searchParams;
    const districtId = searchParams.get("district_id")?.trim() || null;
    const teamId = searchParams.get("team_id")?.trim() || null;
    const status = searchParams.get("status")?.trim() || null;
    const recruitmentStatus =
      searchParams.get("recruitment_status")?.trim() || null;
    const startDate = searchParams.get("start_date")?.trim() || null;
    const endDate = searchParams.get("end_date")?.trim() || null;

    let teamQuery = supabase
      .from("teams")
      .select("id, name, capacity, district_id, districts(id, name)")
      .order("name", { ascending: true });

    if (teamId) {
      teamQuery = teamQuery.eq("id", teamId);
    } else if (districtId) {
      teamQuery = teamQuery.eq("district_id", districtId);
    }

    const { data: teamsData, error: teamsError } =
      await teamQuery.returns<TeamRow[]>();

    if (teamsError) {
      return NextResponse.json({ error: teamsError.message }, { status: 500 });
    }

    const teams = teamsData ?? [];
    const teamIds = teams.map((team) => team.id);

    const { data: districtsData, error: districtsError } = await supabase
      .from("districts")
      .select("id, name")
      .order("name", { ascending: true })
      .returns<DistrictRow[]>();

    if (districtsError) {
      return NextResponse.json(
        { error: districtsError.message },
        { status: 500 },
      );
    }

    const { data: membershipData, error: membershipError } = teamIds.length
      ? await supabase
          .from("team_memberships")
          .select("id, team_id")
          .eq("active", true)
          .in("team_id", teamIds)
          .returns<MembershipRow[]>()
      : { data: [], error: null };

    if (membershipError) {
      return NextResponse.json(
        { error: membershipError.message },
        { status: 500 },
      );
    }

    const headcountByTeam = new Map<string, number>();
    (membershipData ?? []).forEach((membership) => {
      headcountByTeam.set(
        membership.team_id,
        (headcountByTeam.get(membership.team_id) ?? 0) + 1,
      );
    });

    if (teamId && teamIds.length === 0) {
      return NextResponse.json({
        summary: {
          total_teams: 0,
          total_capacity: 0,
          active_headcount: 0,
          missing: 0,
          open_cases_in_sla: 0,
          open_cases_overdue: 0,
          due_24h: 0,
        },
        districts: [],
        teams: [],
        cases: [],
      } satisfies DashboardResponse);
    }

    let casesQuery = supabase
      .from("absence_cases")
      .select(
        "id, team_id, worker_id, membership_id, reason, reported_at, hr_status, sla_deadline_at, recruitment_status, replacement_worker_name, replacement_start_date, final_status, hr_received_at, recruitment_updated_at, hr_swap_approved_at, teams:team_id(id, name, capacity, district_id, districts(id, name)), workers:worker_id(id, full_name, national_id, status)",
      )
      .order("reported_at", { ascending: false })
      .limit(200);

    if (teamIds.length > 0) {
      casesQuery = casesQuery.in("team_id", teamIds);
    }

    if (recruitmentStatus) {
      casesQuery = casesQuery.eq("recruitment_status", recruitmentStatus);
    }

    if (status === "open") {
      casesQuery = casesQuery.eq("final_status", "open");
    }

    if (status === "closed") {
      casesQuery = casesQuery.in("final_status", ["swapped", "vacant"]);
    }

    if (startDate) {
      casesQuery = casesQuery.gte("reported_at", `${startDate}T00:00:00`);
    }

    if (endDate) {
      casesQuery = casesQuery.lte("reported_at", `${endDate}T23:59:59`);
    }

    const { data: casesData, error: casesError } =
      await casesQuery.returns<CaseRow[]>();

    if (casesError) {
      return NextResponse.json({ error: casesError.message }, { status: 500 });
    }

    const caseRows = casesData ?? [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let filteredCases = caseRows;

    if (status === "in_sla" || status === "overdue") {
      filteredCases = caseRows.filter((caseRow) => {
        const flags = getDeadlineFlags(caseRow, today);
        return status === "in_sla" ? flags.isInSla : flags.isOverdue;
      });
    }

    const missingMembershipCases = filteredCases.filter(
      (caseItem) => !caseItem.membership_id,
    );
    const workerIds = Array.from(
      new Set(missingMembershipCases.map((caseItem) => caseItem.worker_id)),
    );
    const membershipIds = Array.from(
      new Set(
        filteredCases
          .map((caseItem) => caseItem.membership_id)
          .filter((membershipId): membershipId is string =>
            Boolean(membershipId),
          ),
      ),
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
        return NextResponse.json({ error: activeError.message }, { status: 500 });
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
        return NextResponse.json(
          { error: membershipError.message },
          { status: 500 },
        );
      }

      membershipRows?.forEach((membership) => {
        membershipActiveLookup.set(membership.id, membership.active);
      });
    }

    const normalizedCases: DashboardCase[] = filteredCases.map((caseItem) => {
      const key = `${caseItem.team_id}-${caseItem.worker_id}`;
      const hasActiveMembership = caseItem.membership_id
        ? membershipActiveLookup.get(caseItem.membership_id) ?? false
        : activeMembershipLookup.has(key);

      return {
        ...caseItem,
        removedFromTeam: !hasActiveMembership,
      };
    });

    const summary: DashboardSummary = {
      total_teams: teams.length,
      total_capacity: teams.reduce(
        (total, team) => total + (team.capacity ?? 0),
        0,
      ),
      active_headcount: teams.reduce(
        (total, team) => total + (headcountByTeam.get(team.id) ?? 0),
        0,
      ),
      missing: teams.reduce((total, team) => {
        const capacity = team.capacity ?? 0;
        const headcount = headcountByTeam.get(team.id) ?? 0;
        return total + Math.max(0, capacity - headcount);
      }, 0),
      open_cases_in_sla: 0,
      open_cases_overdue: 0,
      due_24h: 0,
    };

    const districtsById = new Map<string, DistrictSummary>();

    (districtsData ?? []).forEach((district) => {
      districtsById.set(district.id, {
        id: district.id,
        name: district.name,
        teams_count: 0,
        missing_total: 0,
        open_cases: 0,
        overdue: 0,
        last_update: null,
      });
    });

    teams.forEach((team) => {
      const districtIdForTeam = getTeamDistrictId(team);
      if (!districtIdForTeam) {
        return;
      }
      const summaryRow = districtsById.get(districtIdForTeam);
      if (!summaryRow) {
        return;
      }
      summaryRow.teams_count += 1;
      const capacity = team.capacity ?? 0;
      const headcount = headcountByTeam.get(team.id) ?? 0;
      summaryRow.missing_total += Math.max(0, capacity - headcount);
    });

    normalizedCases.forEach((caseRow) => {
      const team = Array.isArray(caseRow.teams)
        ? caseRow.teams[0]
        : caseRow.teams;
      const districtIdForCase = getTeamDistrictId(team as TeamRow);
      if (!districtIdForCase) {
        return;
      }
      const summaryRow = districtsById.get(districtIdForCase);
      if (!summaryRow) {
        return;
      }

      const { isOverdue, isInSla, dueSoon } = getDeadlineFlags(caseRow, today);

      if (caseRow.final_status === "open") {
        summaryRow.open_cases += 1;
        if (isOverdue) {
          summaryRow.overdue += 1;
        }
      }

      if (isInSla) {
        summary.open_cases_in_sla += 1;
      }

      if (isOverdue) {
        summary.open_cases_overdue += 1;
      }

      if (dueSoon) {
        summary.due_24h += 1;
      }

      const lastUpdate = computeLastUpdateAt(caseRow);
      if (!summaryRow.last_update) {
        summaryRow.last_update = lastUpdate;
      } else {
        summaryRow.last_update =
          new Date(summaryRow.last_update).getTime() >
          new Date(lastUpdate).getTime()
            ? summaryRow.last_update
            : lastUpdate;
      }
    });

    const districtSummaries = Array.from(districtsById.values()).filter(
      (district) => district.teams_count > 0,
    );

    districtSummaries.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json({
      summary,
      districts: districtSummaries,
      teams,
      cases: normalizedCases,
    } satisfies DashboardResponse);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
