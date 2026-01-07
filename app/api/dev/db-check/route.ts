import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // DEV ONLY: service role query to verify team/profile relationships.
  const { data: teams, error: teamsError } = await supabaseAdmin
    .from('teams')
    .select('id, name')
    .order('name');

  if (teamsError) {
    return NextResponse.json({ error: teamsError.message }, { status: 500 });
  }

  const { data: workers, error: workersError } = await supabaseAdmin
    .from('workers')
    .select('id, full_name, team_id')
    .order('full_name');

  if (workersError) {
    return NextResponse.json({ error: workersError.message }, { status: 500 });
  }

  const { data: profiles, error: profilesError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, team_id')
    .order('id');

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 500 });
  }

  return NextResponse.json({ teams, workers, profiles });
}
