-- Progmiscon
-- Phase 3A: lecturer authentication, allowlist, profiles, and review storage.
-- Run this file once in Supabase Dashboard > SQL Editor.

begin;

create table if not exists public.lecturer_allowlist (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lecturer_allowlist_email_not_blank
    check (length(btrim(email)) > 3)
);

create unique index if not exists lecturer_allowlist_email_lower_key
  on public.lecturer_allowlist (lower(email));

create table if not exists public.lecturer_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lecturer_profiles_email_not_blank
    check (length(btrim(email)) > 3),
  constraint lecturer_profiles_full_name_not_blank
    check (length(btrim(full_name)) > 0)
);

create unique index if not exists lecturer_profiles_email_lower_key
  on public.lecturer_profiles (lower(email));

create table if not exists public.question_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.lecturer_profiles(user_id) on delete cascade,
  question_id text not null,
  has_incorrect_misconceptions boolean not null,
  removed_misconception_ids text[] not null default '{}'::text[],
  removal_reason text,
  has_additional_misconceptions boolean not null,
  additional_misconception_ids text[] not null default '{}'::text[],
  addition_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_reviews_question_id_not_blank
    check (length(btrim(question_id)) > 0),
  constraint question_reviews_removal_complete
    check (
      not has_incorrect_misconceptions
      or (
        cardinality(removed_misconception_ids) > 0
        and length(btrim(coalesce(removal_reason, ''))) > 0
      )
    ),
  constraint question_reviews_addition_complete
    check (
      not has_additional_misconceptions
      or (
        cardinality(additional_misconception_ids) > 0
        and length(btrim(coalesce(addition_reason, ''))) > 0
      )
    ),
  unique (reviewer_id, question_id)
);

create index if not exists question_reviews_reviewer_id_idx
  on public.question_reviews (reviewer_id);

create index if not exists question_reviews_question_id_idx
  on public.question_reviews (question_id);

create table if not exists public.answer_reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid not null references public.lecturer_profiles(user_id) on delete cascade,
  answer_id text not null,
  question_id text not null,
  has_mismatched_misconceptions boolean not null,
  removed_misconception_ids text[] not null default '{}'::text[],
  removal_reason text,
  has_additional_misconceptions boolean not null,
  additional_misconception_ids text[] not null default '{}'::text[],
  addition_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint answer_reviews_answer_id_not_blank
    check (length(btrim(answer_id)) > 0),
  constraint answer_reviews_question_id_not_blank
    check (length(btrim(question_id)) > 0),
  constraint answer_reviews_removal_complete
    check (
      not has_mismatched_misconceptions
      or (
        cardinality(removed_misconception_ids) > 0
        and length(btrim(coalesce(removal_reason, ''))) > 0
      )
    ),
  constraint answer_reviews_addition_complete
    check (
      not has_additional_misconceptions
      or (
        cardinality(additional_misconception_ids) > 0
        and length(btrim(coalesce(addition_reason, ''))) > 0
      )
    ),
  unique (reviewer_id, answer_id)
);

create index if not exists answer_reviews_reviewer_id_idx
  on public.answer_reviews (reviewer_id);

create index if not exists answer_reviews_answer_id_idx
  on public.answer_reviews (answer_id);

create index if not exists answer_reviews_question_id_idx
  on public.answer_reviews (question_id);

create or replace function public.normalize_lecturer_email()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.email = lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists lecturer_allowlist_normalize_email
  on public.lecturer_allowlist;
create trigger lecturer_allowlist_normalize_email
before insert or update on public.lecturer_allowlist
for each row execute procedure public.normalize_lecturer_email();

drop trigger if exists lecturer_profiles_normalize_email
  on public.lecturer_profiles;
create trigger lecturer_profiles_normalize_email
before insert or update on public.lecturer_profiles
for each row execute procedure public.normalize_lecturer_email();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists lecturer_allowlist_set_updated_at
  on public.lecturer_allowlist;
create trigger lecturer_allowlist_set_updated_at
before update on public.lecturer_allowlist
for each row execute procedure public.set_updated_at();

drop trigger if exists lecturer_profiles_set_updated_at
  on public.lecturer_profiles;
create trigger lecturer_profiles_set_updated_at
before update on public.lecturer_profiles
for each row execute procedure public.set_updated_at();

drop trigger if exists question_reviews_set_updated_at
  on public.question_reviews;
create trigger question_reviews_set_updated_at
before update on public.question_reviews
for each row execute procedure public.set_updated_at();

drop trigger if exists answer_reviews_set_updated_at
  on public.answer_reviews;
create trigger answer_reviews_set_updated_at
before update on public.answer_reviews
for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_lecturer_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  allowed_email text;
  allowed_name text;
  requested_name text;
begin
  select lower(btrim(item.email)), nullif(btrim(item.full_name), '')
    into allowed_email, allowed_name
  from public.lecturer_allowlist as item
  where lower(btrim(item.email)) = lower(btrim(new.email))
    and item.active = true
  limit 1;

  if allowed_email is null then
    raise exception 'LECTURER_EMAIL_NOT_ALLOWED';
  end if;

  requested_name := nullif(btrim(new.raw_user_meta_data ->> 'full_name'), '');

  insert into public.lecturer_profiles (
    user_id,
    email,
    full_name,
    active
  )
  values (
    new.id,
    allowed_email,
    coalesce(requested_name, allowed_name, split_part(allowed_email, '@', 1)),
    true
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    full_name = excluded.full_name,
    active = true,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_lecturer_user();

alter table public.lecturer_allowlist enable row level security;
alter table public.lecturer_profiles enable row level security;
alter table public.question_reviews enable row level security;
alter table public.answer_reviews enable row level security;

revoke all on table public.lecturer_allowlist from anon, authenticated;
revoke all on table public.lecturer_profiles from anon;
revoke all on table public.question_reviews from anon;
revoke all on table public.answer_reviews from anon;

grant select on table public.lecturer_profiles to authenticated;
grant select, insert, update on table public.question_reviews to authenticated;
grant select, insert, update on table public.answer_reviews to authenticated;

drop policy if exists "Lecturers can read their own profile"
  on public.lecturer_profiles;
create policy "Lecturers can read their own profile"
on public.lecturer_profiles
for select
to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "Lecturers can read their own question reviews"
  on public.question_reviews;
create policy "Lecturers can read their own question reviews"
on public.question_reviews
for select
to authenticated
using (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
);

drop policy if exists "Lecturers can create their own question reviews"
  on public.question_reviews;
create policy "Lecturers can create their own question reviews"
on public.question_reviews
for insert
to authenticated
with check (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
);

drop policy if exists "Lecturers can update their own question reviews"
  on public.question_reviews;
create policy "Lecturers can update their own question reviews"
on public.question_reviews
for update
to authenticated
using (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
)
with check (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
);

drop policy if exists "Lecturers can read their own answer reviews"
  on public.answer_reviews;
create policy "Lecturers can read their own answer reviews"
on public.answer_reviews
for select
to authenticated
using (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
);

drop policy if exists "Lecturers can create their own answer reviews"
  on public.answer_reviews;
create policy "Lecturers can create their own answer reviews"
on public.answer_reviews
for insert
to authenticated
with check (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
);

drop policy if exists "Lecturers can update their own answer reviews"
  on public.answer_reviews;
create policy "Lecturers can update their own answer reviews"
on public.answer_reviews
for update
to authenticated
using (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
)
with check (
  (select auth.uid()) = reviewer_id
  and exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
);

commit;
