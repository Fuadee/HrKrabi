import { NextResponse } from "next/server";

import { getSupabaseServerClient } from "@/lib/supabaseServer";

type HealthResponse = {
  ok: boolean;
  supabaseUrlPresent: boolean;
  serviceKeyPresent: boolean;
  queryOk: boolean;
  serverTime?: string;
  errorSummary: string;
  errorName?: string;
  errorMessage?: string;
  errorCode?: string;
  errorDetails?: string;
  errorHint?: string;
  cause?: unknown;
  stack?: string;
};

/**
 * Development-only health check for Supabase connectivity.
 */
export async function GET() {
  const supabaseUrlPresent = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const serviceKeyPresent = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
  let queryOk = false;
  let errorSummary = "OK";
  let errorName: string | undefined;
  let errorMessage: string | undefined;
  let errorCode: string | undefined;
  let errorDetails: string | undefined;
  let errorHint: string | undefined;
  let cause: unknown;
  let stack: string | undefined;
  let serverTime: string | undefined;

  const captureUnknown = (err: unknown) => {
    const errorLike = err as {
      name?: string;
      message?: string;
      code?: string;
      cause?: unknown;
      stack?: string;
    };
    errorSummary = errorLike?.message ?? "Unknown error";
    errorName = errorLike?.name;
    errorMessage = errorLike?.message;
    errorCode = errorLike?.code;
    cause = safeSerialize(errorLike?.cause);
    stack =
      process.env.NODE_ENV !== "production" ? errorLike?.stack : undefined;
  };

  const safeSerialize = (value: unknown) => {
    if (value === undefined) {
      return undefined;
    }
    if (value instanceof Error) {
      return {
        name: value.name,
        message: value.message,
        stack: value.stack,
      };
    }
    try {
      return JSON.parse(JSON.stringify(value));
    } catch {
      return String(value);
    }
  };

  if (!supabaseUrlPresent || !serviceKeyPresent) {
    const missing = [
      !supabaseUrlPresent ? "NEXT_PUBLIC_SUPABASE_URL" : null,
      !serviceKeyPresent ? "SUPABASE_SERVICE_ROLE_KEY" : null,
    ]
      .filter(Boolean)
      .join(", ");
    errorSummary = `Missing Supabase environment variables: ${missing}.`;
    errorName = "MissingSupabaseEnv";
    errorMessage = errorSummary;
  } else {
    try {
      const supabase = getSupabaseServerClient();
      const { data, error: queryError } = await supabase.rpc("sql", {
        query: "select now() as server_time;",
      });

      if (queryError) {
        errorSummary = queryError.message ?? "Supabase query error";
        errorName = queryError.name;
        errorMessage = queryError.message;
        errorCode = queryError.code;
        errorDetails = queryError.details;
        errorHint = queryError.hint;
        throw queryError;
      }

      serverTime = Array.isArray(data) ? data[0]?.server_time : undefined;
      if (!serverTime) {
        throw new Error("Supabase query returned no server_time.");
      }
      queryOk = true;
    } catch (err) {
      captureUnknown(err);
    }
  }

  const errorInfo =
    errorSummary === "OK"
      ? undefined
      : {
          errorSummary,
          errorName,
          errorMessage,
          errorCode,
          errorDetails,
          errorHint,
          cause,
          stack,
        };

  if (errorInfo) {
    console.error("Supabase dev health check failed", errorInfo);
  }

  const response: HealthResponse = {
    ok: supabaseUrlPresent && serviceKeyPresent && queryOk,
    supabaseUrlPresent,
    serviceKeyPresent,
    queryOk,
    ...(serverTime ? { serverTime } : {}),
    errorSummary,
    ...(errorName ? { errorName } : {}),
    ...(errorMessage ? { errorMessage } : {}),
    ...(errorCode ? { errorCode } : {}),
    ...(errorDetails ? { errorDetails } : {}),
    ...(errorHint ? { errorHint } : {}),
    ...(cause ? { cause } : {}),
    ...(stack ? { stack } : {}),
  };

  return NextResponse.json(response);
}
