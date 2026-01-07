import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type HealthResponse = {
  ok: boolean;
  supabaseUrlPresent: boolean;
  serviceKeyPresent: boolean;
  queryOk: boolean;
  error?: string;
};

/**
 * Development-only health check for Supabase connectivity.
 */
export async function GET() {
  const supabaseUrlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKeyPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let queryOk = false;
  let error: string | undefined;

  if (!supabaseUrlPresent || !serviceKeyPresent) {
    const missing = [
      !supabaseUrlPresent ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !serviceKeyPresent ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");
    error = `Missing Supabase environment variables: ${missing}.`;
  } else {
    try {
      const supabase = getSupabaseServerClient();
      const { error: queryError } = await supabase
        .from("teams")
        .select("*")
        .limit(1);

      if (queryError) {
        throw queryError;
      }

      queryOk = true;
    } catch (err) {
      error = err instanceof Error ? err.message : "Unknown error";
    }
  }

  const response: HealthResponse = {
    ok: supabaseUrlPresent && serviceKeyPresent && queryOk,
    supabaseUrlPresent,
    serviceKeyPresent,
    queryOk,
    ...(error ? { error } : {}),
  };

  return NextResponse.json(response);
}
