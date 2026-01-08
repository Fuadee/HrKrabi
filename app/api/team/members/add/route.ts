import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type AddMemberPayload = {
  full_name?: string;
  national_id?: string | null;
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

    const payload = (await request.json()) as AddMemberPayload;
    const fullName = payload.full_name?.trim();
    const nationalId = payload.national_id?.trim() || null;

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
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
      .insert({
        team_id: profile.team_id,
        full_name: fullName,
        national_id: nationalId,
        status: "active",
      })
      .select("id, team_id, full_name, national_id, status")
      .single();

    if (workerError || !worker) {
      return NextResponse.json(
        { error: workerError?.message ?? "Failed to create worker." },
        { status: 500 },
      );
    }

    const { data: membership, error: membershipError } = await supabase
      .from("team_memberships")
      .insert({
        team_id: profile.team_id,
        worker_id: worker.id,
        active: true,
      })
      .select("id, team_id, worker_id, active, start_date")
      .single();

    if (membershipError || !membership) {
      return NextResponse.json(
        { error: membershipError?.message ?? "Failed to create membership." },
        { status: 500 },
      );
    }

    return NextResponse.json({ data: { worker, membership } });
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
