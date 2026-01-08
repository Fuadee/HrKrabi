create table if not exists public.team_memberships (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  active boolean not null default true,
  start_date date not null default current_date,
  end_date date null,
  ended_reason text null check (ended_reason in ('quit','absent_3days','replaced','other')),
  ended_note text null,
  created_at timestamptz default now()
);

create unique index if not exists team_memberships_active_unique
  on public.team_memberships (team_id, worker_id)
  where active = true;

insert into public.team_memberships (team_id, worker_id, active, start_date)
select workers.team_id, workers.id, true, current_date
from public.workers
where workers.status = 'active'
  and not exists (
    select 1
    from public.team_memberships
    where team_memberships.team_id = workers.team_id
      and team_memberships.worker_id = workers.id
      and team_memberships.active = true
  );

alter table public.absence_cases
  add column if not exists membership_id uuid references public.team_memberships(id);

alter table public.team_memberships enable row level security;

drop policy if exists "Team leads can view own team memberships" on public.team_memberships;
create policy "Team leads can view own team memberships"
  on public.team_memberships
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'team_lead'
        and profiles.team_id = team_memberships.team_id
    )
  );

drop policy if exists "Team leads can insert team memberships" on public.team_memberships;
create policy "Team leads can insert team memberships"
  on public.team_memberships
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'team_lead'
        and profiles.team_id = team_memberships.team_id
    )
    and team_memberships.active = true
    and team_memberships.end_date is null
    and team_memberships.ended_reason is null
  );

drop policy if exists "Team leads can update own team memberships" on public.team_memberships;
create policy "Team leads can update own team memberships"
  on public.team_memberships
  for update
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'team_lead'
        and profiles.team_id = team_memberships.team_id
    )
  )
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'team_lead'
        and profiles.team_id = team_memberships.team_id
    )
    and team_memberships.active = false
    and team_memberships.end_date is not null
    and team_memberships.ended_reason is not null
  );

drop policy if exists "HR province can view all team memberships" on public.team_memberships;
create policy "HR province can view all team memberships"
  on public.team_memberships
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );
