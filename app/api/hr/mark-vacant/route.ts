import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type VacantPayload = {
  caseId?: string;
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

function formatDateOnly(date: Date) {
  return date.toISOString().split("T")[0];
}

export async function POST(request: NextRequest) {
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

    const payload = (await request.json()) as VacantPayload;
    const caseId = payload.caseId?.trim();

    if (!caseId) {
      return NextResponse.json(
        { error: "Missing absence case id." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
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

    const { data: caseRow, error: caseError } = await supabase
      .from("absence_cases")
      .select(
        "id, team_id, recruitment_status, final_status, sla_deadline_at",
      )
      .eq("id", caseId)
      .single<{
        id: string;
        team_id: string;
        recruitment_status: string;
        final_status: string;
        sla_deadline_at: string | null;
      }>();

    if (caseError || !caseRow) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    if (caseRow.final_status !== "open") {
      return NextResponse.json(
        { error: "Case is already finalized." },
        { status: 400 },
      );
    }

    if (caseRow.recruitment_status !== "not_found") {
      return NextResponse.json(
        { error: "Recruitment outcome is not marked as not found." },
        { status: 400 },
      );
    }

    if (!caseRow.sla_deadline_at) {
      return NextResponse.json(
        { error: "SLA deadline is missing." },
        { status: 400 },
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(`${caseRow.sla_deadline_at}T00:00:00`);

    if (today.getTime() <= deadline.getTime()) {
      return NextResponse.json(
        { error: "SLA deadline has not expired yet." },
        { status: 400 },
      );
    }

    const startedAt = new Date(deadline);
    startedAt.setDate(startedAt.getDate() + 1);

    const { data: updatedCase, error: updateError } = await supabase
      .from("absence_cases")
      .update({
        final_status: "vacant",
        hr_status: "sla_expired",
      })
      .eq("id", caseId)
      .select(
        "id, reason, reported_at, hr_status, sla_deadline_at, recruitment_status, replacement_worker_name, replacement_start_date, final_status, teams(name), workers(full_name)",
      )
      .single();

    if (updateError || !updatedCase) {
      return NextResponse.json(
        { error: updateError?.message ?? "Update failed." },
        { status: 500 },
      );
    }

    const { error: vacancyError } = await supabase
      .from("vacancy_periods")
      .insert({
        case_id: caseId,
        team_id: caseRow.team_id,
        started_at: formatDateOnly(startedAt),
      });

    if (vacancyError) {
      return NextResponse.json(
        { error: vacancyError.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: updatedCase });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
