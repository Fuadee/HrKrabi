alter table public.absence_cases
  add column if not exists hr_received_at timestamptz null,
  add column if not exists sla_deadline_at date null,
  add column if not exists hr_status text not null default 'pending'
    check (hr_status in ('pending','received','in_sla','sla_expired')),
  add column if not exists document_sent boolean not null default false;

drop policy if exists "HR province can view all cases" on public.absence_cases;
create policy "HR province can view all cases"
  on public.absence_cases
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );

drop policy if exists "HR province can update HR fields" on public.absence_cases;
create policy "HR province can update HR fields"
  on public.absence_cases
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );

drop policy if exists "HR province can view all teams" on public.teams;
create policy "HR province can view all teams"
  on public.teams
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );

drop policy if exists "HR province can view all workers" on public.workers;
create policy "HR province can view all workers"
  on public.workers
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );
