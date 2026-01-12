create table if not exists public.hr_case_actions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.absence_cases(id) on delete cascade,
  action_type text not null,
  signed_by text not null,
  note text null,
  created_at timestamptz not null default now()
);

create index if not exists hr_case_actions_case_id_idx
  on public.hr_case_actions(case_id);

create table if not exists public.hr_case_action_documents (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.hr_case_actions(id) on delete cascade,
  doc_scope text not null,
  doc_no text not null,
  created_at timestamptz not null default now()
);

create index if not exists hr_case_action_documents_action_id_idx
  on public.hr_case_action_documents(action_id);

alter table public.hr_case_actions enable row level security;
alter table public.hr_case_action_documents enable row level security;

drop policy if exists "HR province can insert case actions" on public.hr_case_actions;
create policy "HR province can insert case actions"
  on public.hr_case_actions
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );

drop policy if exists "HR province can view case actions" on public.hr_case_actions;
create policy "HR province can view case actions"
  on public.hr_case_actions
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );

drop policy if exists "HR province can insert case action documents" on public.hr_case_action_documents;
create policy "HR province can insert case action documents"
  on public.hr_case_action_documents
  for insert
  with check (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );

drop policy if exists "HR province can view case action documents" on public.hr_case_action_documents;
create policy "HR province can view case action documents"
  on public.hr_case_action_documents
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );
