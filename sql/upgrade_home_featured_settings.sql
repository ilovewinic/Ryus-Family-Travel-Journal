-- 가족 여행기록장: 첫 화면 대표 여행 설정
-- 가족 구성원은 조회할 수 있고, 부모 계정만 변경할 수 있습니다.
-- Supabase SQL Editor에서 한 번 실행하면 됩니다.

create table if not exists public.family_home_settings (
  id smallint primary key default 1 check (id = 1),
  featured_trip_ids text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.family_home_settings enable row level security;

drop policy if exists family_home_settings_select_family
  on public.family_home_settings;
create policy family_home_settings_select_family
  on public.family_home_settings
  for select
  to authenticated
  using (public.is_family_member());

drop policy if exists family_home_settings_insert_parent
  on public.family_home_settings;
create policy family_home_settings_insert_parent
  on public.family_home_settings
  for insert
  to authenticated
  with check (public.is_family_parent());

drop policy if exists family_home_settings_update_parent
  on public.family_home_settings;
create policy family_home_settings_update_parent
  on public.family_home_settings
  for update
  to authenticated
  using (public.is_family_parent())
  with check (public.is_family_parent());

grant select, insert, update
  on public.family_home_settings
  to authenticated;

insert into public.family_home_settings (id, featured_trip_ids)
values (1, '{}'::text[])
on conflict (id) do nothing;
