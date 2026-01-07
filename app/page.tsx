export default function Home() {
  return (
    <section className="card">
      <h2>Welcome</h2>
      <p className="notice">
        This MVP tracks workforce replacement cases and enforces the 3 business day SLA
        starting from the HR_PROV document sent date.
      </p>
      <ul>
        <li>Team leads report missing/absent cases.</li>
        <li>HR Provincial sends documents and tracks SLA.</li>
        <li>Recruitment updates replacement outcomes.</li>
      </ul>
    </section>
  );
}
