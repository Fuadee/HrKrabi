import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type HealthResponse = {
  ok: boolean;
  supabaseUrlPresent: boolean;
  serviceKeyPresent: boolean;
  queryOk: boolean;
  serverReachable: boolean;
  count?: number;
  errorSummary?: string;
  errorCode?: string;
  errorDetails?: string;
};

/**
 * Development-only health check for Supabase connectivity.
 */
export async function GET() {
  const supabaseUrlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKeyPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let queryOk = false;
  let serverReachable = false;
  let errorSummary: string | undefined;
  let errorCode: string | undefined;
  let errorDetails: string | undefined;
  let count: number | undefined;

  if (!supabaseUrlPresent || !serviceKeyPresent) {
    const missing = [
      !supabaseUrlPresent ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !serviceKeyPresent ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");
    errorSummary = `Missing Supabase environment variables: ${missing}.`;
  } else {
    try {
      const supabase = getSupabaseServerClient();
      const { error: queryError, count: queryCount } = await supabase
        .from("auth.users")
        .select("id", { head: true, count: "exact" })
        .limit(1);

      serverReachable = true;
      if (queryError) {
        errorSummary = queryError.message ?? "Supabase query error";
        errorCode = queryError.code ?? undefined;
        errorDetails = queryError.details ?? undefined;
        console.error("Supabase dev health check failed", queryError);
      } else {
        queryOk = true;
        if (typeof queryCount === "number") {
          count = queryCount;
        }
      }
    } catch (err) {
      console.error("Supabase dev health check failed", err);
      if (err instanceof Error) {
        errorSummary = err.message;
      } else {
        errorSummary = "Unknown error";
      }
    }
  }

  const response: HealthResponse = {
    ok: supabaseUrlPresent && serviceKeyPresent && queryOk && serverReachable,
    supabaseUrlPresent,
    serviceKeyPresent,
    queryOk,
    serverReachable,
    ...(typeof count === "number" ? { count } : {}),
    ...(errorSummary ? { errorSummary } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(errorDetails ? { errorDetails } : {}),
  };

  return NextResponse.json(response);
}
