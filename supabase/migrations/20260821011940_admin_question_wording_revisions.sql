-- Progmiscon
-- Phase 2A-1: versioned, PS-only Admin question wording revisions.
-- Forward-only. Do not apply from the frontend.

begin;

create table public.question_wording_revisions (
  question_id text not null,
  source_version uuid not null,
  question_ind text,
  question_en text,
  revision_origin text not null,
  captured_by uuid references public.lecturer_profiles(user_id),
  captured_at timestamptz not null default pg_catalog.now(),
  constraint question_wording_revisions_pkey
    primary key (question_id, source_version),
  constraint question_wording_revisions_question_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(question_id)) > 0),
  constraint question_wording_revisions_has_content
    check (
      pg_catalog.length(pg_catalog.btrim(coalesce(question_ind, ''))) > 0
      or pg_catalog.length(pg_catalog.btrim(coalesce(question_en, ''))) > 0
    ),
  constraint question_wording_revisions_origin_valid
    check (revision_origin in ('captured_pre_edit', 'admin_edit'))
);

alter table public.question_wording_revisions enable row level security;

revoke all on table public.question_wording_revisions
  from public, anon, authenticated, service_role;

create or replace function public.reject_question_wording_revision_mutation()
returns trigger
language plpgsql
security invoker
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

create or replace function public.save_question_wording_revision_v1(
  input_question_id text,
  input_expected_source_version uuid,
  input_current_question_ind text,
  input_current_question_en text,
  input_question_ind text,
  input_question_en text
)
returns table (
  question_id text,
  previous_source_version uuid,
  source_version uuid,
  question_ind text,
  question_en text,
  updated_at timestamptz,
  captured_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_question_id text := pg_catalog.btrim(input_question_id);
  current_source_version uuid;
  next_source_version uuid;
  revision_updated_at timestamptz;
  revision_captured_at timestamptz := pg_catalog.now();
begin
  if not exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_question_id) = 0
    or (
      pg_catalog.length(pg_catalog.btrim(coalesce(input_current_question_ind, ''))) = 0
      and pg_catalog.length(pg_catalog.btrim(coalesce(input_current_question_en, ''))) = 0
    )
    or (
      pg_catalog.length(pg_catalog.btrim(coalesce(input_question_ind, ''))) = 0
      and pg_catalog.length(pg_catalog.btrim(coalesce(input_question_en, ''))) = 0
    ) then
    raise exception using message = 'INVALID_QUESTION_WORDING', errcode = '22023';
  end if;

  if input_question_ind is not distinct from input_current_question_ind
    and input_question_en is not distinct from input_current_question_en then
    raise exception using message = 'QUESTION_WORDING_UNCHANGED', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'question_review:' || normalized_question_id,
      0
    )
  );

  select baseline.source_version
    into current_source_version
  from public.question_misconception_baselines as baseline
  where baseline.question_id = normalized_question_id
  for update;

  if not found then
    raise exception using message = 'QUESTION_NOT_FOUND', errcode = 'P0001';
  end if;

  if input_expected_source_version is null
    or input_expected_source_version is distinct from current_source_version then
    raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.answer_misconception_baselines as answer_baseline
    where answer_baseline.question_id = normalized_question_id
  ) then
    raise exception using
      message = 'MP_WORDING_EDIT_NOT_SUPPORTED',
      errcode = 'P0001';
  end if;

  insert into public.question_wording_revisions (
    question_id,
    source_version,
    question_ind,
    question_en,
    revision_origin,
    captured_by,
    captured_at
  )
  values (
    normalized_question_id,
    current_source_version,
    input_current_question_ind,
    input_current_question_en,
    'captured_pre_edit',
    (select auth.uid()),
    revision_captured_at
  )
  on conflict (question_id, source_version) do nothing;

  insert into public.question_content_overrides (
    question_id,
    question_ind,
    question_en,
    updated_by
  )
  values (
    normalized_question_id,
    input_question_ind,
    input_question_en,
    (select auth.uid())
  )
  on conflict on constraint question_content_overrides_pkey do update
  set
    question_ind = excluded.question_ind,
    question_en = excluded.question_en,
    updated_by = excluded.updated_by
  returning question_content_overrides.updated_at
    into revision_updated_at;

  next_source_version := pg_catalog.gen_random_uuid();

  update public.question_misconception_baselines as baseline
  set source_version = next_source_version
  where baseline.question_id = normalized_question_id;

  update public.question_reviews as review
  set
    is_active = false,
    inactive_reason = 'source_updated',
    inactive_at = revision_captured_at
  where review.question_id = normalized_question_id
    and review.is_active = true;

  delete from public.question_misconception_overrides as override_row
  where override_row.question_id = normalized_question_id;

  insert into public.question_wording_revisions (
    question_id,
    source_version,
    question_ind,
    question_en,
    revision_origin,
    captured_by,
    captured_at
  )
  values (
    normalized_question_id,
    next_source_version,
    input_question_ind,
    input_question_en,
    'admin_edit',
    (select auth.uid()),
    revision_captured_at
  );

  return query
  select
    normalized_question_id,
    current_source_version,
    next_source_version,
    input_question_ind,
    input_question_en,
    revision_updated_at,
    revision_captured_at;
end;
$$;

create or replace function public.get_question_wording_revisions(
  input_question_ids text[]
)
returns table (
  question_id text,
  source_version uuid,
  question_ind text,
  question_en text,
  revision_origin text,
  captured_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    revision.question_id,
    revision.source_version,
    revision.question_ind,
    revision.question_en,
    revision.revision_origin,
    revision.captured_at
  from public.question_wording_revisions as revision
  where exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
    and revision.question_id = any (
      public.normalize_text_id_array(input_question_ids)
    )
  order by revision.question_id, revision.captured_at, revision.source_version;
$$;

create or replace function public.get_question_review_counts()
returns table (
  question_id text,
  review_count integer,
  latest_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    review.question_id,
    pg_catalog.count(distinct review.reviewer_id)::integer as review_count,
    pg_catalog.max(review.updated_at) as latest_updated_at
  from public.question_reviews as review
  inner join public.question_misconception_baselines as baseline
    on baseline.question_id = review.question_id
    and baseline.source_version = review.source_version
  where review.is_active = true
    and exists (
      select 1
      from public.lecturer_profiles as profile
      where profile.user_id = (select auth.uid())
        and profile.active = true
    )
  group by review.question_id;
$$;

create or replace function public.get_answer_review_counts()
returns table (
  answer_id text,
  review_count integer,
  latest_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    review.answer_id,
    pg_catalog.count(distinct review.reviewer_id)::integer as review_count,
    pg_catalog.max(review.updated_at) as latest_updated_at
  from public.answer_reviews as review
  inner join public.answer_misconception_baselines as baseline
    on baseline.answer_id = review.answer_id
    and baseline.source_version = review.source_version
  where review.is_active = true
    and exists (
      select 1
      from public.lecturer_profiles as profile
      where profile.user_id = (select auth.uid())
        and profile.active = true
    )
  group by review.answer_id;
$$;

create or replace function public.get_my_review_status()
returns table (
  question_ids text[],
  answer_ids text[],
  question_review_count integer,
  answer_review_count integer,
  latest_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with question_status as (
    select
      coalesce(
        pg_catalog.array_agg(
          distinct review.question_id
          order by review.question_id
        ),
        '{}'::text[]
      ) as question_ids,
      pg_catalog.count(distinct review.question_id)::integer as review_count,
      pg_catalog.max(review.updated_at) as latest_updated_at
    from public.question_reviews as review
    inner join public.question_misconception_baselines as baseline
      on baseline.question_id = review.question_id
      and baseline.source_version = review.source_version
    where review.reviewer_id = (select auth.uid())
      and review.is_active = true
      and exists (
        select 1
        from public.lecturer_profiles as profile
        where profile.user_id = (select auth.uid())
          and profile.active = true
      )
  ),
  answer_status as (
    select
      coalesce(
        pg_catalog.array_agg(
          distinct review.answer_id
          order by review.answer_id
        ),
        '{}'::text[]
      ) as answer_ids,
      pg_catalog.count(distinct review.answer_id)::integer as review_count,
      pg_catalog.max(review.updated_at) as latest_updated_at
    from public.answer_reviews as review
    inner join public.answer_misconception_baselines as baseline
      on baseline.answer_id = review.answer_id
      and baseline.source_version = review.source_version
    where review.reviewer_id = (select auth.uid())
      and review.is_active = true
      and exists (
        select 1
        from public.lecturer_profiles as profile
        where profile.user_id = (select auth.uid())
          and profile.active = true
      )
  )
  select
    question_status.question_ids,
    answer_status.answer_ids,
    question_status.review_count,
    answer_status.review_count,
    greatest(
      question_status.latest_updated_at,
      answer_status.latest_updated_at
    )
  from question_status
  cross join answer_status;
$$;

revoke all on function public.save_question_wording_revision_v1(
  text, uuid, text, text, text, text
) from public, anon, service_role;
grant execute on function public.save_question_wording_revision_v1(
  text, uuid, text, text, text, text
) to authenticated;

revoke all on function public.get_question_wording_revisions(text[])
  from public, anon, service_role;
grant execute on function public.get_question_wording_revisions(text[])
  to authenticated;

revoke all on function public.get_question_review_counts()
  from public, anon, service_role;
grant execute on function public.get_question_review_counts()
  to authenticated;

revoke all on function public.get_answer_review_counts()
  from public, anon, service_role;
grant execute on function public.get_answer_review_counts()
  to authenticated;

revoke all on function public.get_my_review_status()
  from public, anon, service_role;
grant execute on function public.get_my_review_status()
  to authenticated;

revoke all on function public.save_question_content_override(
  text, text, text, text
) from public, anon, authenticated;
revoke all on function public.save_answer_content_override(text, text)
  from public, anon, authenticated;
revoke all on function public.reset_question_content_override(text)
  from public, anon, authenticated;
revoke all on function public.reset_answer_content_override(text)
  from public, anon, authenticated;

commit;
