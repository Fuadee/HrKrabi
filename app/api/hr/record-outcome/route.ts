import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type OutcomePayload = {
  caseId?: string;
  outcome?: "found" | "not_found";
  signedBy?: string;
  note?: string;
  documents?: { doc_scope?: string; doc_no?: string }[];
  replacementWorkerName?: string;
  replacementStartDate?: string;
};

const allowedOutcomes = new Set(["found", "not_found"]);

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

    const payload = (await request.json()) as OutcomePayload;
    const caseId = payload.caseId?.trim();
    const outcome = payload.outcome;
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

    if (!caseId || !outcome || !allowedOutcomes.has(outcome)) {
      return NextResponse.json(
        { error: "Missing or invalid outcome data." },
        { status: 400 },
      );
    }

    if (!signedBy) {
      return NextResponse.json(
        { error: "Signed by is required." },
        { status: 400 },
      );
    }

    if (documents.length < 1) {
      return NextResponse.json(
        { error: "At least one document is required." },
        { status: 400 },
      );
    }

    if (documents.some((doc) => !doc.doc_scope || !doc.doc_no)) {
      return NextResponse.json(
        { error: "Each document needs a scope and document number." },
        { status: 400 },
      );
    }

    if (outcome === "found") {
      if (!payload.replacementWorkerName?.trim()) {
        return NextResponse.json(
          { error: "Replacement worker name is required." },
          { status: 400 },
        );
      }

      if (!payload.replacementStartDate) {
        return NextResponse.json(
          { error: "Replacement start date is required." },
          { status: 400 },
        );
      }
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
      .select("id, final_status")
      .eq("id", caseId)
      .single<{ id: string; final_status: string }>();

    if (caseError || !caseRow) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    if (caseRow.final_status !== "open") {
      return NextResponse.json(
        { error: "Case is already finalized." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const updates = {
      recruitment_status: outcome,
      recruitment_updated_at: now,
      replacement_worker_name:
        outcome === "found" ? payload.replacementWorkerName?.trim() : null,
      replacement_start_date:
        outcome === "found" ? payload.replacementStartDate : null,
    };

    const { data: updatedCase, error: updateError } = await supabase
      .from("absence_cases")
      .update(updates)
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

    const actionType =
      outcome === "found" ? "RECORD_FOUND" : "RECORD_NOT_FOUND";

    const { data: actionData, error: actionError } = await supabase
      .from("hr_case_actions")
      .insert({
        case_id: caseId,
        action_type: actionType,
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
