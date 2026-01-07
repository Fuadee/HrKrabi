import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ReportPayload = {
  worker_id?: string;
  reason?: "absent" | "missing" | "quit";
  note?: string | null;
  last_seen_date?: string | null;
};

const allowedReasons = new Set(["absent", "missing", "quit"]);

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

    const payload = (await request.json()) as ReportPayload;
    const workerId = payload.worker_id?.trim();
    const reason = payload.reason;

    if (!workerId || !reason || !allowedReasons.has(reason)) {
      return NextResponse.json(
        { error: "Missing or invalid worker/reason." },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServerClient();
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role, team_id")
      .eq("id", userData.user.id)
      .single<{ role: string; team_id: string | null }>();

    if (profileError || !profile?.team_id) {
      return NextResponse.json({ error: "Profile not found." }, { status: 403 });
    }

    if (profile.role !== "team_lead") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("id, team_id")
      .eq("id", workerId)
      .single<{ id: string; team_id: string }>();

    if (workerError || !worker) {
      return NextResponse.json({ error: "Worker not found." }, { status: 404 });
    }

    if (worker.team_id !== profile.team_id) {
      return NextResponse.json(
        { error: "Worker is not in your team." },
        { status: 403 },
      );
    }

    const note = payload.note?.trim();
    const lastSeenDate = payload.last_seen_date || null;

    const { data: createdCase, error: insertError } = await supabase
      .from("absence_cases")
      .insert({
        team_id: profile.team_id,
        worker_id: workerId,
        reported_by: userData.user.id,
        reason,
        note: note || null,
        last_seen_date: lastSeenDate,
      })
      .select("*")
      .single();

    if (insertError || !createdCase) {
      return NextResponse.json(
        { error: insertError?.message ?? "Insert failed." },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: createdCase });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function GET() {
  return NextResponse.json(
    { error: "Method not allowed" },
    { status: 405 },
  );
}
