import { businessDaysBetween } from '@/lib/dates';
import { supabaseAdmin } from '@/lib/supabase';

function formatDate(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
}

export default async function HrDashboardPage() {
  const { data: cases } = await supabaseAdmin
    .from('cases')
    .select(
      `id, reported_at, doc_sent_to_region_date, replacement_deadline_date, case_status,
       recruitment_result, system_exit_date, vacancy_days, worker:workers(full_name)`
    )
    .order('reported_at', { ascending: false });

  const today = new Date();

  return (
    <section className="card">
      <h2>HR Provincial Dashboard</h2>
      <p className="notice">
        SLA counts 3 business days from the document sent date (doc_sent_to_region_date).
      </p>
      <table>
        <thead>
          <tr>
            <th>Worker</th>
            <th>Status</th>
            <th>Reported</th>
            <th>Doc Sent</th>
            <th>Deadline</th>
            <th>Days Left</th>
            <th>Recruitment</th>
            <th>Vacancy Days</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {cases?.map((item) => {
            const deadline = item.replacement_deadline_date
              ? new Date(item.replacement_deadline_date)
              : null;
            const daysLeft = deadline ? businessDaysBetween(today, deadline) : null;
            const badgeClass =
              daysLeft === null
                ? 'badge orange'
                : daysLeft >= 1
                ? 'badge green'
                : 'badge red';
            return (
              <tr key={item.id}>
                <td>{item.worker?.full_name ?? 'Unknown'}</td>
                <td>{item.case_status}</td>
                <td>{formatDate(item.reported_at)}</td>
                <td>{formatDate(item.doc_sent_to_region_date)}</td>
                <td>{formatDate(item.replacement_deadline_date)}</td>
                <td>
                  <span className={badgeClass}>
                    {daysLeft === null ? 'N/A' : `${daysLeft} days`}
                  </span>
                </td>
                <td>{item.recruitment_result ?? '-'}</td>
                <td>{item.vacancy_days ?? '-'}</td>
                <td>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    <form method="post" action="/api/hr/send-docs">
                      <input type="hidden" name="case_id" value={item.id} />
                      <button type="submit">Send Docs</button>
                    </form>
                    <form method="post" action="/api/hr/mark-replaced">
                      <input type="hidden" name="case_id" value={item.id} />
                      <button className="secondary" type="submit">
                        Approve Substitution
                      </button>
                    </form>
                    <form method="post" action="/api/hr/mark-removed">
                      <input type="hidden" name="case_id" value={item.id} />
                      <button className="secondary" type="submit">
                        Remove From System
                      </button>
                    </form>
                    <form method="post" action="/api/hr/confirm-removal">
                      <input type="hidden" name="case_id" value={item.id} />
                      <button className="secondary" type="submit">
                        Confirm Region Removal
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
