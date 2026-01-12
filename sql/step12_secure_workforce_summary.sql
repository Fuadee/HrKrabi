revoke all on public.hr_team_workforce_summary from public;
revoke all on public.hr_team_workforce_summary from authenticated;

do $$
begin
  revoke all on public.hr_team_workforce_summary from hr_prov;
exception
  when undefined_object then null;
end $$;

create or replace function public.hr_get_team_workforce_summary(
  p_district_name text default null
)
returns table (
  id uuid,
  name text,
  capacity int,
  district_name text,
  active_headcount bigint,
  missing_count bigint,
  last_update timestamptz
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
    summary.last_update
  from public.hr_team_workforce_summary as summary
  where p_district_name is null
    or summary.district_name = p_district_name
  order by summary.name;
end;
$$;

revoke all on function public.hr_get_team_workforce_summary(text) from public;
grant execute on function public.hr_get_team_workforce_summary(text) to authenticated;
