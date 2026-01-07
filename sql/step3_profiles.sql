create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('team_lead', 'hr_prov', 'recruitment')),
  team_id uuid null,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create or replace function public.handle_new_user_profiles()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'team_lead')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_profiles on auth.users;
create trigger on_auth_user_created_profiles
  after insert on auth.users
  for each row execute function public.handle_new_user_profiles();

create policy "Users can view own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles
  for update
  using (auth.uid() = id);
