-- Progmiscon
-- Admin access for the read-only administration workspace.
-- Run this file once in Supabase Dashboard > SQL Editor.

begin;

alter table public.lecturer_allowlist
  add column if not exists is_admin boolean;

update public.lecturer_allowlist
set is_admin = false
where is_admin is null;

alter table public.lecturer_allowlist
  alter column is_admin set default false,
  alter column is_admin set not null;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lecturer_profiles as profile
    inner join public.lecturer_allowlist as allowed
      on lower(btrim(allowed.email)) = lower(btrim(profile.email))
    where profile.user_id = (select auth.uid())
      and profile.active = true
      and allowed.active = true
      and allowed.is_admin = true
  );
$$;

revoke all on function public.current_user_is_admin() from public;
grant execute on function public.current_user_is_admin() to authenticated;

commit;
