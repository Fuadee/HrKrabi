import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { calculateBusinessDeadline } from "@/lib/businessDays";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ReceivePayload = {
  case_id?: string;
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

    const payload = (await request.json()) as ReceivePayload;
    const caseId = payload.case_id?.trim();

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
      .select("id, hr_status")
      .eq("id", caseId)
      .single<{ id: string; hr_status: string }>();

    if (caseError || !caseRow) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    if (caseRow.hr_status !== "pending") {
      return NextResponse.json(
        { error: "Case is already in progress." },
        { status: 400 },
      );
    }

    const now = new Date();
    const deadline = calculateBusinessDeadline(now, 3);

    const { data: updatedCase, error: updateError } = await supabase
      .from("absence_cases")
      .update({
        hr_received_at: now.toISOString(),
        sla_deadline_at: deadline,
        hr_status: "in_sla",
        document_sent: true,
      })
      .eq("id", caseId)
      .select(
        "id, reason, reported_at, hr_status, sla_deadline_at, teams(name), workers(full_name)",
      )
      .single();

    if (updateError || !updatedCase) {
      return NextResponse.json(
        { error: updateError?.message ?? "Update failed." },
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
