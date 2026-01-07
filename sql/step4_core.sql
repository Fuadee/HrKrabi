create extension if not exists pgcrypto;

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  capacity int not null default 0,
  created_at timestamptz default now()
);

create table if not exists public.workers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  full_name text not null,
  national_id text null,
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz default now()
);

create table if not exists public.absence_cases (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete restrict,
  reported_by uuid not null references auth.users(id) on delete restrict,
  reason text not null check (reason in ('absent','missing','quit')),
  note text null,
  reported_at timestamptz not null default now(),
  status text not null default 'reported' check (status in ('reported','acknowledged','closed')),
  last_seen_date date null
);

alter table public.teams enable row level security;
alter table public.workers enable row level security;
alter table public.absence_cases enable row level security;

create policy "Team leads can view own team"
  on public.teams
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.team_id = teams.id
    )
  );

create policy "Team leads can view own workers"
  on public.workers
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.team_id = workers.team_id
    )
  );

create policy "Team leads can report cases"
  on public.absence_cases
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.team_id = absence_cases.team_id
    )
    and reported_by = auth.uid()
  );

create policy "Team leads can view own cases"
  on public.absence_cases
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.team_id = absence_cases.team_id
    )
  );

insert into public.teams (id, name, capacity)
select gen_random_uuid(), 'Team 1', 8
where not exists (
  select 1 from public.teams where name = 'Team 1'
);

with team_row as (
  select id from public.teams where name = 'Team 1' limit 1
)
insert into public.workers (team_id, full_name, status)
select team_row.id, worker.full_name, 'active'
from team_row
cross join (
  values
    ('Worker One'),
    ('Worker Two'),
    ('Worker Three'),
    ('Worker Four'),
    ('Worker Five')
) as worker(full_name)
where not exists (
  select 1 from public.workers where team_id = team_row.id
);
