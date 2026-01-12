-- Fix HR workforce summary view + RPC in a safe, repeatable order.
-- 1) Keep existing columns (missing_count, last_update) in place.
-- 2) Append new columns to the end to avoid view column reorder errors.
-- 3) Recreate the RPC with a stable signature and access control.

create or replace view public.hr_team_workforce_summary
with (security_barrier = true) as
with active_counts as (
  select
    team_memberships.team_id,
    count(*)::int8 as active_headcount
  from public.team_memberships
  where team_memberships.active = true
  group by team_memberships.team_id
),
open_case_counts as (
  select
    absence_cases.team_id,
    count(*)::int8 as open_cases,
    max(absence_cases.reported_at) as last_case_update
  from public.absence_cases
  where absence_cases.final_status = 'open'
  group by absence_cases.team_id
)
select
  teams.id,
  teams.name,
  teams.capacity,
  teams.district_name,
  coalesce(active_counts.active_headcount, 0)::int8 as active_headcount,
  greatest(
    coalesce(teams.capacity, 0) - coalesce(active_counts.active_headcount, 0),
    0
  )::int8 as missing_count,
  open_case_counts.last_case_update as last_update,
  greatest(
    coalesce(teams.capacity, 0) - coalesce(active_counts.active_headcount, 0),
    0
  )::int8 as missing_capacity,
  coalesce(open_case_counts.open_cases, 0)::int8 as open_cases,
  open_case_counts.last_case_update as last_case_update
from public.teams
left join active_counts on active_counts.team_id = teams.id
left join open_case_counts on open_case_counts.team_id = teams.id;

revoke all on public.hr_team_workforce_summary from public;
revoke all on public.hr_team_workforce_summary from authenticated;

do $$
begin
  revoke all on public.hr_team_workforce_summary from hr_prov;
exception
  when undefined_object then null;
end $$;

-- Drop and recreate the RPC to avoid 42P13 errors when return types drift.
drop function if exists public.hr_get_team_workforce_summary(text);

create function public.hr_get_team_workforce_summary(
  p_district_name text default null
)
returns table (
  id uuid,
  name text,
  capacity int,
  district_name text,
  active_headcount bigint,
  missing_count bigint,
  last_update timestamptz,
  missing_capacity bigint,
  open_cases bigint,
  last_case_update timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = auth.uid()
      and profiles.role = 'hr_prov'
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    summary.id,
    summary.name,
    summary.capacity,
    summary.district_name,
    summary.active_headcount,
    summary.missing_count,
    summary.last_update,
    summary.missing_capacity,
    summary.open_cases,
    summary.last_case_update
  from public.hr_team_workforce_summary as summary
  where p_district_name is null
    or summary.district_name = p_district_name
  order by summary.name;
end;
$$;

revoke all on function public.hr_get_team_workforce_summary(text) from public;
grant execute on function public.hr_get_team_workforce_summary(text) to authenticated;
