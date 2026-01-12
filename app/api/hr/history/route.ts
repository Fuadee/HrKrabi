import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ActionDocumentRow = {
  id: string;
  doc_scope: string;
  doc_no: string;
  created_at: string;
};

type ActionRow = {
  id: string;
  case_id: string;
  action_type: string;
  signed_by: string;
  note: string | null;
  created_at: string;
  hr_case_action_documents?: ActionDocumentRow[];
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

    const caseId = request.nextUrl.searchParams.get("caseId")?.trim();

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

    const { data: actions, error: actionsError } = await supabase
      .from("hr_case_actions")
      .select(
        "id, case_id, action_type, signed_by, note, created_at, hr_case_action_documents(id, doc_scope, doc_no, created_at)",
      )
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    if (actionsError) {
      return NextResponse.json(
        { error: actionsError.message ?? "Failed to fetch history." },
        { status: 500 },
      );
    }

    const normalized = (actions ?? []).map((action: ActionRow) => ({
      id: action.id,
      case_id: action.case_id,
      action_type: action.action_type,
      signed_by: action.signed_by,
      note: action.note,
      created_at: action.created_at,
      documents: (action.hr_case_action_documents ?? [])
        .map((doc) => ({
          id: doc.id,
          doc_scope: doc.doc_scope,
          doc_no: doc.doc_no,
          created_at: doc.created_at,
        }))
        .sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime(),
        ),
    }));

    return NextResponse.json({ data: normalized });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected server error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export function POST() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
