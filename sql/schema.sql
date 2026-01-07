-- Enable UUIDs
create extension if not exists "pgcrypto";

create table if not exists teams (
  id uuid primary key default gen_random_uuid(),
  name text not null
);

create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references teams(id) on delete set null,
  full_name text not null,
  employee_code text,
  active boolean default true
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null check (role in ('TEAM_LEAD', 'HR_PROV', 'RECRUITMENT', 'VIEWER')),
  team_id uuid references teams(id) on delete set null
);

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid references workers(id) on delete cascade,
  team_id uuid references teams(id) on delete set null,
  reported_at timestamptz not null default now(),
  doc_sent_to_region_date date,
  replacement_deadline_date date,
  case_status text not null,
  recruitment_result text,
  system_exit_date date,
  vacancy_start_date date,
  vacancy_days integer,
  reason text,
  note text,
  replacement_name text,
  replacement_start_date date,
  created_at timestamptz not null default now()
);

create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  doc_type text not null,
  storage_path text not null,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references cases(id) on delete cascade,
  action text not null,
  actor_id uuid references profiles(id),
  metadata jsonb,
  created_at timestamptz not null default now()
);

alter table teams enable row level security;
alter table workers enable row level security;
alter table profiles enable row level security;
alter table cases enable row level security;
alter table documents enable row level security;
alter table audit_logs enable row level security;

-- Profiles policies
create policy "Profiles are viewable by owner" on profiles
  for select using (auth.uid() = id);

create policy "Profiles insert self" on profiles
  for insert with check (auth.uid() = id);

-- Teams and workers
create policy "Team lead can view own team" on teams
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.role in ('TEAM_LEAD', 'HR_PROV', 'VIEWER', 'RECRUITMENT'))
    )
  );

create policy "Team lead can view workers" on workers
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.role in ('HR_PROV', 'VIEWER', 'RECRUITMENT')
          or (profiles.role = 'TEAM_LEAD' and profiles.team_id = workers.team_id))
    )
  );

-- Cases access
create policy "Team lead can insert cases" on cases
  for insert with check (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and profiles.role = 'TEAM_LEAD'
        and profiles.team_id = cases.team_id
    )
  );

create policy "Team lead can view cases" on cases
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid()
        and (profiles.role in ('HR_PROV', 'VIEWER')
          or (profiles.role = 'TEAM_LEAD' and profiles.team_id = cases.team_id)
          or (profiles.role = 'RECRUITMENT' and cases.case_status = 'WAIT_REPLACEMENT'))
    )
  );

create policy "HR prov full access" on cases
  for all using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'HR_PROV')
  ) with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'HR_PROV')
  );

create policy "Recruitment can update wait replacement" on cases
  for update using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'RECRUITMENT'
    )
    and cases.case_status = 'WAIT_REPLACEMENT'
  );

create policy "Viewer read-only" on cases
  for select using (
    exists (
      select 1 from profiles
      where profiles.id = auth.uid() and profiles.role = 'VIEWER'
    )
  );

-- Documents
create policy "HR prov documents access" on documents
  for all using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'HR_PROV')
  ) with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'HR_PROV')
  );

create policy "Viewer documents select" on documents
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'VIEWER')
  );

-- Audit logs
create policy "HR prov logs" on audit_logs
  for all using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'HR_PROV')
  ) with check (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'HR_PROV')
  );

create policy "Viewer logs" on audit_logs
  for select using (
    exists (select 1 from profiles where profiles.id = auth.uid() and profiles.role = 'VIEWER')
  );
