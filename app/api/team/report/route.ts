import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const formData = await request.formData();
  const workerId = formData.get('worker_id')?.toString();
  const reason = formData.get('reason')?.toString();
  const note = formData.get('note')?.toString() ?? null;

  if (!workerId || !reason) {
    return NextResponse.json({ error: 'Missing worker or reason.' }, { status: 400 });
  }

  const { data: worker } = await supabaseAdmin
    .from('workers')
    .select('team_id')
    .eq('id', workerId)
    .single();

  const { error } = await supabaseAdmin.from('cases').insert({
    worker_id: workerId,
    team_id: worker?.team_id ?? null,
    reported_at: new Date().toISOString(),
    reason,
    note,
    case_status: 'REPORTED',
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/team/report', request.url));
}
