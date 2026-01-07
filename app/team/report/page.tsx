import { supabaseAdmin } from '@/lib/supabase';

export default async function TeamReportPage() {
  const { data: workers } = await supabaseAdmin
    .from('workers')
    .select('id, full_name, team:teams(name)')
    .order('full_name');

  return (
    <section className="card">
      <h2>Report Missing/Absent Case</h2>
      <p className="notice">One click reporting for team leads.</p>
      <form method="post" action="/api/team/report">
        <label>
          Worker
          <select name="worker_id" required>
            <option value="">Select worker</option>
            {workers?.map((worker) => (
              <option key={worker.id} value={worker.id}>
                {worker.full_name} ({worker.team?.name ?? 'Unassigned'})
              </option>
            ))}
          </select>
        </label>
        <label>
          Reason
          <input name="reason" placeholder="Absent / Missing" required />
        </label>
        <label>
          Note
          <textarea name="note" rows={3} />
        </label>
        <button type="submit">Report Case</button>
      </form>
    </section>
  );
}
