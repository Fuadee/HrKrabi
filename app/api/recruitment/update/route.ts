import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const formData = await request.formData();
  const caseId = formData.get('case_id')?.toString();
  const recruitmentResult = formData.get('recruitment_result')?.toString();
  const replacementName = formData.get('replacement_name')?.toString() || null;
  const replacementStartDate = formData.get('replacement_start_date')?.toString() || null;

  if (!caseId || !recruitmentResult) {
    return NextResponse.json({ error: 'Missing case or result.' }, { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from('cases')
    .update({
      recruitment_result: recruitmentResult,
      replacement_name: replacementName,
      replacement_start_date: replacementStartDate,
    })
    .eq('id', caseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from('audit_logs').insert({
    case_id: caseId,
    action: `RECRUITMENT_${recruitmentResult}`,
  });

  return NextResponse.redirect(new URL('/recruitment/cases', request.url));
}
