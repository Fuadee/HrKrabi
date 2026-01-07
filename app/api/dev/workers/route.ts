import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get('team_id');

  if (!teamId) {
    return NextResponse.json({ error: 'Missing team_id' }, { status: 400 });
  }

  // DEV ONLY: service role query to bypass RLS for debugging.
  const { data: workers, error } = await supabaseAdmin
    .from('workers')
    .select('id, full_name, team_id, team:teams(name)')
    .eq('team_id', teamId)
    .order('full_name');

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ workers });
}
