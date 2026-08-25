-- Progmiscon
-- Phase 2A: trusted Google-authority Admin question-wording overrides.
-- Forward-only. Apply through the migration pipeline, never from the browser.

begin;

alter table public.question_content_overrides
  add column content_version uuid;

update public.question_content_overrides
set content_version = pg_catalog.gen_random_uuid()
where content_version is null;

alter table public.question_content_overrides
  alter column content_version set default pg_catalog.gen_random_uuid(),
  alter column content_version set not null;

create or replace function public.rotate_question_content_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.content_version := pg_catalog.gen_random_uuid();
  return new;
end;
$$;

create trigger question_content_overrides_rotate_content_version
before update on public.question_content_overrides
for each row execute function public.rotate_question_content_version();

revoke all on function public.rotate_question_content_version()
  from public, anon, authenticated, service_role;

create table public.question_wording_revisions (
  id uuid primary key default pg_catalog.gen_random_uuid(),
  question_id text not null,
  actor_id uuid not null references public.lecturer_profiles(user_id),
  authority_sha256 text not null,
  google_drive_version text not null,
  previous_question_ind text,
  previous_question_en text,
  new_question_ind text not null,
  new_question_en text not null,
  result_content_version uuid not null,
  created_at timestamptz not null default pg_catalog.now(),
  constraint question_wording_revisions_question_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(question_id)) > 0),
  constraint question_wording_revisions_authority_sha256_valid
    check (authority_sha256 ~ '^[0-9a-f]{64}$'),
  constraint question_wording_revisions_drive_version_not_blank
    check (
      pg_catalog.length(pg_catalog.btrim(google_drive_version)) > 0
      and pg_catalog.length(google_drive_version) <= 128
    ),
  constraint question_wording_revisions_new_ind_not_blank
    check (pg_catalog.length(pg_catalog.btrim(new_question_ind)) > 0),
  constraint question_wording_revisions_new_en_not_blank
    check (pg_catalog.length(pg_catalog.btrim(new_question_en)) > 0)
);

comment on table public.question_wording_revisions is
  'Immutable Admin wording-edit audit. These rows are not Review snapshots.';

create index question_wording_revisions_lookup_idx
  on public.question_wording_revisions (question_id, created_at desc);

alter table public.question_wording_revisions enable row level security;

revoke all on table public.question_wording_revisions
  from public, anon, authenticated, service_role;

create or replace function public.reject_question_wording_revision_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  raise exception using
    message = 'QUESTION_WORDING_REVISION_IMMUTABLE',
    errcode = '55000';
end;
$$;

create trigger question_wording_revisions_immutable
before update or delete on public.question_wording_revisions
for each row execute function public.reject_question_wording_revision_mutation();

revoke all on function public.reject_question_wording_revision_mutation()
  from public, anon, authenticated, service_role;

create or replace function public.admin_question_wording_actor_is_authorized_v1(
  input_actor_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select input_actor_id is not null and exists (
    select 1
    from public.lecturer_profiles as profile
    inner join public.lecturer_allowlist as allowed
      on pg_catalog.lower(pg_catalog.btrim(allowed.email))
        = pg_catalog.lower(pg_catalog.btrim(profile.email))
    where profile.user_id = input_actor_id
      and profile.active = true
      and allowed.active = true
      and allowed.is_admin = true
  );
$$;

revoke all on function public.admin_question_wording_actor_is_authorized_v1(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.admin_question_wording_actor_is_authorized_v1(uuid)
  to service_role;

create or replace function public.admin_save_question_wording_override_v1(
  input_actor_id uuid,
  input_question_id text,
  input_expected_content_version uuid,
  input_authority_sha256 text,
  input_google_drive_version text,
  input_trusted_question_ind text,
  input_trusted_question_en text,
  input_question_ind text,
  input_question_en text
)
returns table (
  question_id text,
  question_ind text,
  question_en text,
  content_version uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_question_id text := pg_catalog.btrim(coalesce(input_question_id, ''));
  normalized_question_ind text := pg_catalog.btrim(coalesce(input_question_ind, ''));
  normalized_question_en text := pg_catalog.btrim(coalesce(input_question_en, ''));
  normalized_trusted_question_ind text := pg_catalog.btrim(coalesce(input_trusted_question_ind, ''));
  normalized_trusted_question_en text := pg_catalog.btrim(coalesce(input_trusted_question_en, ''));
  normalized_drive_version text := pg_catalog.btrim(coalesce(input_google_drive_version, ''));
  current_override public.question_content_overrides%rowtype;
  current_exists boolean;
  saved_content_version uuid;
  saved_at timestamptz;
begin
  if not public.admin_question_wording_actor_is_authorized_v1(input_actor_id) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_question_id) = 0
    or pg_catalog.length(normalized_question_ind) = 0
    or pg_catalog.length(normalized_question_en) = 0
    or pg_catalog.length(normalized_trusted_question_ind) = 0
    or pg_catalog.length(normalized_trusted_question_en) = 0
    or coalesce(input_authority_sha256, '') !~ '^[0-9a-f]{64}$'
    or pg_catalog.length(normalized_drive_version) = 0
    or pg_catalog.length(normalized_drive_version) > 128 then
    raise exception using message = 'INVALID_QUESTION_WORDING', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'admin_question_wording:' || normalized_question_id,
      0
    )
  );

  select override_row.*
  into current_override
  from public.question_content_overrides as override_row
  where override_row.question_id = normalized_question_id
  for update;
  current_exists := found;

  if (
    current_exists
    and (
      input_expected_content_version is null
      or current_override.content_version is distinct from input_expected_content_version
    )
  ) or (
    not current_exists
    and input_expected_content_version is not null
  ) then
    raise exception using message = 'QUESTION_OVERRIDE_STALE', errcode = 'P0001';
  end if;

  if current_exists
    and pg_catalog.btrim(coalesce(current_override.question_ind, '')) = normalized_question_ind
    and pg_catalog.btrim(coalesce(current_override.question_en, '')) = normalized_question_en then
    raise exception using message = 'QUESTION_WORDING_UNCHANGED', errcode = 'P0001';
  end if;

  if current_exists then
    update public.question_content_overrides as override_row
    set
      question_ind = normalized_question_ind,
      question_en = normalized_question_en,
      updated_by = input_actor_id
    where override_row.question_id = normalized_question_id
    returning override_row.content_version, override_row.updated_at
      into saved_content_version, saved_at;
  else
    insert into public.question_content_overrides (
      question_id,
      question_ind,
      question_en,
      question_code,
      updated_by
    )
    values (
      normalized_question_id,
      normalized_question_ind,
      normalized_question_en,
      null,
      input_actor_id
    )
    returning
      question_content_overrides.content_version,
      question_content_overrides.updated_at
      into saved_content_version, saved_at;
  end if;

  insert into public.question_wording_revisions (
    question_id,
    actor_id,
    authority_sha256,
    google_drive_version,
    previous_question_ind,
    previous_question_en,
    new_question_ind,
    new_question_en,
    result_content_version,
    created_at
  )
  values (
    normalized_question_id,
    input_actor_id,
    input_authority_sha256,
    normalized_drive_version,
    case when current_exists then current_override.question_ind else normalized_trusted_question_ind end,
    case when current_exists then current_override.question_en else normalized_trusted_question_en end,
    normalized_question_ind,
    normalized_question_en,
    saved_content_version,
    saved_at
  );

  return query select
    normalized_question_id,
    normalized_question_ind,
    normalized_question_en,
    saved_content_version,
    saved_at;
end;
$$;

revoke all on function public.admin_save_question_wording_override_v1(
  uuid, text, uuid, text, text, text, text, text, text
) from public, anon, authenticated, service_role;
grant execute on function public.admin_save_question_wording_override_v1(
  uuid, text, uuid, text, text, text, text, text, text
) to service_role;

-- Edge load is service-role-only. Browser roles continue to consume only the
-- existing published effective-data RPC.
grant select on table public.question_content_overrides to service_role;

-- Retire arbitrary browser mutation paths. No live frontend caller remains.
revoke execute on function public.save_question_content_override(
  text, text, text, text
) from public, anon, authenticated, service_role;
revoke execute on function public.reset_question_content_override(text)
  from public, anon, authenticated, service_role;

commit;
