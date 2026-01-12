import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { calculateBusinessDeadline } from "@/lib/businessDays";
import { getSupabaseServerClient } from "@/lib/supabaseServer";

type ReceivePayload = {
  caseId?: string;
  case_id?: string;
  signedBy?: string;
  note?: string;
  documents?: { doc_scope?: string; doc_no?: string }[];
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
    const caseId = (payload.caseId ?? payload.case_id)?.trim();
    const signedBy = payload.signedBy?.trim();
    const note = payload.note?.trim() ?? null;
    const documents = Array.isArray(payload.documents)
      ? payload.documents
          .map((doc) => ({
            doc_scope: doc.doc_scope?.trim(),
            doc_no: doc.doc_no?.trim(),
          }))
          .filter((doc) => doc.doc_scope || doc.doc_no)
      : [];

    if (!caseId) {
      return NextResponse.json(
        { error: "Missing absence case id." },
        { status: 400 },
      );
    }

    if (!signedBy) {
      return NextResponse.json(
        { error: "Signed by is required." },
        { status: 400 },
      );
    }

    if (documents.length < 2) {
      return NextResponse.json(
        { error: "At least two documents are required." },
        { status: 400 },
      );
    }

    if (documents.some((doc) => !doc.doc_scope || !doc.doc_no)) {
      return NextResponse.json(
        { error: "Each document needs a scope and document number." },
        { status: 400 },
      );
    }

    const normalizedScopes = new Set(
      documents.map((doc) => doc.doc_scope?.toUpperCase()),
    );

    if (
      !normalizedScopes.has("INTERNAL") ||
      !normalizedScopes.has("TO_DISTRICT")
    ) {
      return NextResponse.json(
        {
          error:
            "Documents must include INTERNAL (มท.) and TO_DISTRICT (ส่งเขต).",
        },
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
        "id, reason, reported_at, hr_status, sla_deadline_at, recruitment_status, replacement_worker_name, replacement_start_date, final_status, teams(name), workers(full_name)",
      )
      .single();

    if (updateError || !updatedCase) {
      return NextResponse.json(
        { error: updateError?.message ?? "Update failed." },
        { status: 500 },
      );
    }

    const { data: actionData, error: actionError } = await supabase
      .from("hr_case_actions")
      .insert({
        case_id: caseId,
        action_type: "RECEIVE_SEND",
        signed_by: signedBy,
        note,
      })
      .select("id")
      .single<{ id: string }>();

    if (actionError || !actionData) {
      return NextResponse.json(
        { error: actionError?.message ?? "Failed to log action." },
        { status: 500 },
      );
    }

    const documentPayload = documents.map((doc) => ({
      action_id: actionData.id,
      doc_scope: doc.doc_scope,
      doc_no: doc.doc_no,
    }));

    const { error: documentError } = await supabase
      .from("hr_case_action_documents")
      .insert(documentPayload);

    if (documentError) {
      return NextResponse.json(
        { error: documentError.message ?? "Failed to log documents." },
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
