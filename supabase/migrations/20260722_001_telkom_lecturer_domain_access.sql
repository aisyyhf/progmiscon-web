-- Progmiscon
-- Allow verified Telkom University emails to become ordinary lecturers.
-- Existing lecturer profiles and allowlist entries remain unchanged.

begin;

create or replace function public.is_telkom_lecturer_email(input_email text)
returns boolean
language sql
immutable
parallel safe
set search_path = ''
as $$
  select lower(btrim(coalesce(input_email, '')))
    ~ '^[^@[:space:]]+@telkomuniversity[.]ac[.]id$';
$$;

revoke all on function public.is_telkom_lecturer_email(text) from public;

create or replace function public.enforce_verified_telkom_lecturer_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Keep an unchanged legacy profile valid, including an older non-Telkom one.
  if tg_op = 'UPDATE'
    and new.user_id = old.user_id
    and lower(btrim(new.email)) = lower(btrim(old.email)) then
    return new;
  end if;

  if not public.is_telkom_lecturer_email(new.email) then
    raise exception 'LECTURER_EMAIL_DOMAIN_NOT_ALLOWED';
  end if;

  if not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = new.user_id
      and auth_user.email_confirmed_at is not null
      and lower(btrim(coalesce(auth_user.email, '')))
        = lower(btrim(new.email))
      and public.is_telkom_lecturer_email(auth_user.email)
  ) then
    raise exception 'LECTURER_EMAIL_NOT_VERIFIED';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_verified_telkom_lecturer_profile()
  from public;

drop trigger if exists lecturer_profiles_enforce_verified_telkom_email
  on public.lecturer_profiles;
create trigger lecturer_profiles_enforce_verified_telkom_email
before insert or update of user_id, email on public.lecturer_profiles
for each row
execute procedure public.enforce_verified_telkom_lecturer_profile();

create or replace function public.handle_new_lecturer_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text;
  current_profile_email text;
  allowed_name text;
  allowed_active boolean;
  requested_name text;
begin
  normalized_email := lower(btrim(coalesce(new.email, '')));

  select lower(btrim(profile.email))
    into current_profile_email
  from public.lecturer_profiles as profile
  where profile.user_id = new.id;

  -- Do not rewrite or revoke an unchanged legacy lecturer account.
  if current_profile_email is not null
    and current_profile_email = normalized_email then
    return new;
  end if;

  if not public.is_telkom_lecturer_email(normalized_email) then
    raise exception 'LECTURER_EMAIL_DOMAIN_NOT_ALLOWED';
  end if;

  -- Signup may create auth.users before the confirmation link is opened.
  if new.email_confirmed_at is null then
    return new;
  end if;

  -- A domain-approved account starts as an ordinary lecturer. Existing rows,
  -- including manually assigned admins, win on conflict and are not changed.
  insert into public.lecturer_allowlist (
    email,
    full_name,
    active,
    is_admin
  )
  values (
    normalized_email,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    true,
    false
  )
  on conflict do nothing;

  select nullif(btrim(item.full_name), ''), item.active
    into allowed_name, allowed_active
  from public.lecturer_allowlist as item
  where lower(btrim(item.email)) = normalized_email
  limit 1;

  -- Preserve an explicit deactivation in the existing allowlist.
  if allowed_active is distinct from true then
    if current_profile_email is not null then
      update public.lecturer_profiles
      set
        email = normalized_email,
        active = false,
        updated_at = now()
      where user_id = new.id;
    end if;

    return new;
  end if;

  requested_name := nullif(
    btrim(new.raw_user_meta_data ->> 'full_name'),
    ''
  );

  insert into public.lecturer_profiles (
    user_id,
    email,
    full_name,
    active
  )
  values (
    new.id,
    normalized_email,
    coalesce(
      requested_name,
      allowed_name,
      split_part(normalized_email, '@', 1)
    ),
    true
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    active = true,
    updated_at = now();

  return new;
end;
$$;

revoke all on function public.handle_new_lecturer_user() from public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, email_confirmed_at on auth.users
for each row
execute procedure public.handle_new_lecturer_user();

commit;
