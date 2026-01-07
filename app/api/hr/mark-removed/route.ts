import { NextResponse } from 'next/server';
import { createSimplePdf } from '@/lib/pdf';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: Request) {
  const formData = await request.formData();
  const caseId = formData.get('case_id')?.toString();

  if (!caseId) {
    return NextResponse.json({ error: 'Missing case.' }, { status: 400 });
  }

  const pdfBuffer = await createSimplePdf('Remove From System', [
    `Case ID: ${caseId}`,
    `Requested: ${new Date().toDateString()}`,
  ]);
  const filePath = `${caseId}/remove_from_system.pdf`;

  const { error: uploadError } = await supabaseAdmin.storage
    .from('documents')
    .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  await supabaseAdmin.from('documents').insert({
    case_id: caseId,
    doc_type: 'Remove From System',
    storage_path: filePath,
  });

  const { error } = await supabaseAdmin
    .from('cases')
    .update({
      case_status: 'REMOVAL_PENDING',
    })
    .eq('id', caseId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from('audit_logs').insert({
    case_id: caseId,
    action: 'REMOVAL_REQUESTED',
  });

  return NextResponse.redirect(new URL('/hr/dashboard', request.url));
}
