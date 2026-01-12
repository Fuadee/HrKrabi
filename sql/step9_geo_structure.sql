create table if not exists public.provinces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz default now()
);

create table if not exists public.districts (
  id uuid primary key default gen_random_uuid(),
  province_id uuid not null references public.provinces(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table public.teams
  add column if not exists district_id uuid references public.districts(id);

create index if not exists teams_district_id_idx
  on public.teams(district_id);

create index if not exists districts_province_id_idx
  on public.districts(province_id);

insert into public.provinces (name)
select 'Default Province'
where not exists (
  select 1 from public.provinces
);

insert into public.districts (province_id, name)
select provinces.id, 'Unknown District'
from public.provinces
where not exists (
  select 1 from public.districts
);

update public.teams
set district_id = (
  select districts.id
  from public.districts
  order by created_at
  limit 1
)
where district_id is null;

alter table public.provinces enable row level security;
alter table public.districts enable row level security;

drop policy if exists "HR province can view provinces" on public.provinces;
create policy "HR province can view provinces"
  on public.provinces
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );

drop policy if exists "HR province can view districts" on public.districts;
create policy "HR province can view districts"
  on public.districts
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'hr_prov'
    )
  );
