import 'server-only';

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const supabaseUrlPresent = Boolean(supabaseUrl);
  const serviceKeyPresent = Boolean(serviceRoleKey);

  let queryOk = false;
  let queryError: string | null = null;

  if (supabaseUrl && serviceRoleKey) {
    const supabaseServer = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { error } = await supabaseServer.from('teams').select('id').limit(1);
    if (error) {
      queryError = error.message;
      console.error('[dev/health] Supabase query failed', {
        code: error.code ?? null,
        message: error.message ?? null,
        details: error.details ?? null,
        hint: error.hint ?? null,
      });
    } else {
      queryOk = true;
    }
  } else {
    queryError = 'Missing Supabase environment variables.';
  }

  return NextResponse.json({
    ok: true,
    supabaseUrlPresent,
    serviceKeyPresent,
    queryOk,
    queryError,
  });
}
