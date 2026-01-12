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
  )::int8 as missing_capacity,
  coalesce(open_case_counts.open_cases, 0)::int8 as open_cases,
  open_case_counts.last_case_update as last_case_update,
  greatest(
    coalesce(teams.capacity, 0) - coalesce(active_counts.active_headcount, 0),
    0
  )::int8 as missing_count,
  open_case_counts.last_case_update as last_update
from public.teams
left join active_counts on active_counts.team_id = teams.id
left join open_case_counts on open_case_counts.team_id = teams.id;

grant select on public.hr_team_workforce_summary to authenticated;

do $$
begin
  grant select on public.hr_team_workforce_summary to hr_prov;
exception
  when undefined_object then null;
end $$;
