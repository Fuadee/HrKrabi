import { NextResponse } from 'next/server';
import { addBusinessDays } from '@/lib/dates';
import { createSimplePdf } from '@/lib/pdf';
import { supabaseAdmin } from '@/lib/supabase';

async function uploadPdf(caseId: string, docType: string, content: string[]) {
  const pdfBuffer = await createSimplePdf(docType, content);
  const filePath = `${caseId}/${docType.replace(/\s+/g, '_').toLowerCase()}.pdf`;
  const { error } = await supabaseAdmin.storage
    .from('documents')
    .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (error) {
    throw new Error(error.message);
  }

  await supabaseAdmin.from('documents').insert({
    case_id: caseId,
    doc_type: docType,
    storage_path: filePath,
  });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const caseId = formData.get('case_id')?.toString();

  if (!caseId) {
    return NextResponse.json({ error: 'Missing case.' }, { status: 400 });
  }

  const { data: caseData } = await supabaseAdmin
    .from('cases')
    .select('id, worker:workers(full_name)')
    .eq('id', caseId)
    .single();

  const today = new Date();
  const deadline = addBusinessDays(today, 3);

  try {
    await uploadPdf(caseId, 'HR Region Notice', [
      `Case ID: ${caseId}`,
      `Worker: ${caseData?.worker?.full_name ?? 'Unknown'}`,
      `Sent: ${today.toDateString()}`,
    ]);
    await uploadPdf(caseId, 'Recruitment Notice', [
      `Case ID: ${caseId}`,
      `Worker: ${caseData?.worker?.full_name ?? 'Unknown'}`,
      `Sent: ${today.toDateString()}`,
    ]);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from('cases')
    .update({
      doc_sent_to_region_date: today.toISOString().slice(0, 10),
      replacement_deadline_date: deadline.toISOString().slice(0, 10),
      case_status: 'WAIT_REPLACEMENT',
    })
    .eq('id', caseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.redirect(new URL('/hr/dashboard', request.url));
}
