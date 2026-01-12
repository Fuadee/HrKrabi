create or replace view public.hr_team_workforce_summary
with (security_barrier = true) as
with active as (
  select
    team_memberships.team_id,
    count(*)::int8 as active_headcount,
    max(team_memberships.updated_at) as last_update
  from public.team_memberships
  where team_memberships.status = 'active'
  group by team_memberships.team_id
)
select
  teams.id,
  teams.name,
  teams.capacity,
  teams.district_name,
  coalesce(active.active_headcount, 0)::int8 as active_headcount,
  greatest(
    coalesce(teams.capacity, 0) - coalesce(active.active_headcount, 0),
    0
  )::int8 as missing_count,
  active.last_update
from public.teams
left join active on active.team_id = teams.id;

grant select on public.hr_team_workforce_summary to authenticated;

do $$
begin
  grant select on public.hr_team_workforce_summary to hr_prov;
exception
  when undefined_object then null;
end $$;
