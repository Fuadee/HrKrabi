create or replace view public.hr_team_workforce_summary
with (security_barrier = true) as
select
  teams.id,
  teams.name,
  teams.capacity,
  teams.district_name,
  coalesce(active_counts.active_headcount, 0) as active_headcount,
  coalesce(missing_counts.missing_count, 0) as missing_count,
  missing_counts.last_update
from public.teams
left join (
  select
    team_memberships.team_id,
    count(*) as active_headcount
  from public.team_memberships
  where team_memberships.active = true
  group by team_memberships.team_id
) as active_counts on active_counts.team_id = teams.id
left join (
  select
    absence_cases.team_id,
    count(*) as missing_count,
    max(absence_cases.reported_at) as last_update
  from public.absence_cases
  where absence_cases.final_status = 'open'
  group by absence_cases.team_id
) as missing_counts on missing_counts.team_id = teams.id;

grant select on public.hr_team_workforce_summary to authenticated;

do $$
begin
  grant select on public.hr_team_workforce_summary to hr_prov;
exception
  when undefined_object then null;
end $$;
