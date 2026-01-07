import { NextResponse } from 'next/server';
import { businessDaysBetween, differenceInCalendarDays } from '@/lib/dates';
import { vacancyCountMode } from '@/lib/config';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const formData = await request.formData();
  const caseId = formData.get('case_id')?.toString();

  if (!caseId) {
    return NextResponse.json({ error: 'Missing case.' }, { status: 400 });
  }

  const today = new Date();
  const exitDate = today.toISOString().slice(0, 10);
  const vacancyDays =
    vacancyCountMode === 'business'
      ? Math.max(0, businessDaysBetween(today, today))
      : differenceInCalendarDays(today, today);

  const { error } = await supabaseAdmin
    .from('cases')
    .update({
      system_exit_date: exitDate,
      vacancy_start_date: exitDate,
      vacancy_days: vacancyDays,
      case_status: 'CLOSED',
    })
    .eq('id', caseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from('audit_logs').insert({
    case_id: caseId,
    action: 'REMOVAL_CONFIRMED',
  });

  return NextResponse.redirect(new URL('/hr/dashboard', request.url));
}
