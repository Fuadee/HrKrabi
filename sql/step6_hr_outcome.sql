alter table public.absence_cases
  add column if not exists recruitment_status text not null default 'awaiting'
    check (recruitment_status in ('awaiting','found','not_found')),
  add column if not exists recruitment_updated_at timestamptz null,
  add column if not exists replacement_worker_name text null,
  add column if not exists replacement_start_date date null,
  add column if not exists hr_swap_approved_at timestamptz null,
  add column if not exists final_status text not null default 'open'
    check (final_status in ('open','swapped','vacant'));

alter table public.absence_cases
  drop constraint if exists absence_cases_hr_status_check;

alter table public.absence_cases
  add constraint absence_cases_hr_status_check
  check (hr_status in ('pending','received','in_sla','sla_expired','closed'));

create table if not exists public.vacancy_periods (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.absence_cases(id) on delete cascade,
  team_id uuid not null references public.teams(id) on delete cascade,
  started_at date not null,
  ended_at date null,
  created_at timestamptz default now()
);

alter table public.vacancy_periods enable row level security;

drop policy if exists "HR province can update recruitment outcomes" on public.absence_cases;
create policy "HR province can update recruitment outcomes"
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

drop policy if exists "HR province can insert vacancy periods" on public.vacancy_periods;
create policy "HR province can insert vacancy periods"
  on public.vacancy_periods
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );

drop policy if exists "HR province can view vacancy periods" on public.vacancy_periods;
create policy "HR province can view vacancy periods"
  on public.vacancy_periods
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );
