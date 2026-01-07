import 'server-only';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

type RequiredEnvVar = (typeof REQUIRED_ENV_VARS)[number];

type ErrorPayload = {
  error: string;
  details?: string;
  hint?: string;
};

function getMissingEnvVars(env: NodeJS.ProcessEnv): RequiredEnvVar[] {
  return REQUIRED_ENV_VARS.filter((name) => !env[name]);
}

function logSupabaseError(context: string, error: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}) {
  console.error(`[team/report] ${context}`, {
    code: error.code ?? null,
    message: error.message ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  });
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export async function POST(request: Request) {
  const missingEnvVars = getMissingEnvVars(process.env);
  if (missingEnvVars.length > 0) {
    console.error('[team/report] Missing Supabase env vars', { missingEnvVars });
    return NextResponse.json(
      {
        error: 'Missing Supabase environment variables.',
        details: missingEnvVars.join(', '),
        hint: 'Set the required env vars before calling this endpoint.',
      } satisfies ErrorPayload,
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const workerId = formData.get('worker_id')?.toString();
  const reason = formData.get('reason')?.toString();
  const note = formData.get('note')?.toString() ?? null;
  const userId = formData.get('user_id')?.toString() ?? null;

  console.info('[team/report] Incoming request', {
    workerId,
    reason,
    note: note ? '[redacted]' : null,
    userId,
  });

  if (!workerId || !reason) {
    return NextResponse.json({ error: 'Missing worker or reason.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  try {
    const { data: worker, error: workerError } = await supabaseServer
      .from('workers')
      .select('team_id')
      .eq('id', workerId)
      .single();

    if (workerError) {
      logSupabaseError('Failed to load worker team', workerError);
      return NextResponse.json(
        {
          error: 'Failed to load worker team.',
          details: workerError.details ?? workerError.message,
          hint: workerError.hint ?? undefined,
        } satisfies ErrorPayload,
        { status: 500 }
      );
    }

    const { error: insertError } = await supabaseServer.from('cases').insert({
      worker_id: workerId,
      team_id: worker?.team_id ?? null,
      reported_at: new Date().toISOString(),
      reason,
      note,
      case_status: 'REPORTED',
    });

    if (insertError) {
      logSupabaseError('Failed to insert case', insertError);
      const isRlsError =
        insertError.code === '42501' ||
        insertError.message?.toLowerCase().includes('row level security');

      if (isRlsError) {
        return NextResponse.json(
          {
            error: 'RLS blocked insert. Ensure policy allows TEAM_LEAD to insert cases for their team.',
            details: insertError.details ?? insertError.message,
            hint: insertError.hint ?? undefined,
          } satisfies ErrorPayload,
          { status: 403 }
        );
      }

      return NextResponse.json(
        {
          error: 'Failed to create case.',
          details: insertError.details ?? insertError.message,
          hint: insertError.hint ?? undefined,
        } satisfies ErrorPayload,
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[team/report] Unexpected error', error);
    return NextResponse.json(
      {
        error: 'Unexpected server error.',
        details: error instanceof Error ? error.message : 'Unknown error',
        hint: 'Check server logs for details.',
      } satisfies ErrorPayload,
      { status: 500 }
    );
  }

  return NextResponse.redirect(new URL('/team/report', request.url));
}
