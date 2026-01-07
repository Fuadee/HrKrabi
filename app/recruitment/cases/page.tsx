import { supabaseAdmin } from '@/lib/supabase';

export default async function RecruitmentCasesPage() {
  const { data: cases } = await supabaseAdmin
    .from('cases')
    .select('id, replacement_deadline_date, case_status, worker:workers(full_name)')
    .eq('case_status', 'WAIT_REPLACEMENT')
    .order('replacement_deadline_date', { ascending: true });

  return (
    <section className="card">
      <h2>Recruitment Cases</h2>
      <p className="notice">Update replacement results within the SLA window.</p>
      <table>
        <thead>
          <tr>
            <th>Worker</th>
            <th>Deadline</th>
            <th>Replacement Status</th>
          </tr>
        </thead>
        <tbody>
          {cases?.map((item) => (
            <tr key={item.id}>
              <td>{item.worker?.full_name ?? 'Unknown'}</td>
              <td>
                {item.replacement_deadline_date
                  ? new Date(item.replacement_deadline_date).toLocaleDateString()
                  : '-'}
              </td>
              <td>
                <form method="post" action="/api/recruitment/update">
                  <input type="hidden" name="case_id" value={item.id} />
                  <select name="recruitment_result" defaultValue="FOUND">
                    <option value="FOUND">Found</option>
                    <option value="NOT_FOUND">Not Found</option>
                  </select>
                  <input name="replacement_name" placeholder="Replacement name" />
                  <input type="date" name="replacement_start_date" />
                  <button type="submit">Update</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
