alter table public.teams
  add column if not exists district_name text;

update public.teams
set district_name = 'ไม่ระบุ'
where district_name is null;

create index if not exists idx_teams_district_name
  on public.teams(district_name);

drop policy if exists "HR province can update team districts" on public.teams;
create policy "HR province can update team districts"
  on public.teams
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
