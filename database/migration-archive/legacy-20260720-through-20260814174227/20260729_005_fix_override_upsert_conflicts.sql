-- Progmiscon
-- Replace override upserts with unambiguous primary-key conflict targets.

begin;

create or replace function public.publish_question_misconception_override(
  input_question_id text
)
returns table (
  question_id text,
  misconception_ids text[],
  source_review_count integer,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_question_id text := pg_catalog.btrim(input_question_id);
  reviewer_count integer;
  baseline_ids text[];
  removed_ids text[];
  added_ids text[];
  invalid_added_id text;
  final_ids text[];
begin
  if not exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_question_id) = 0 then
    raise exception using message = 'INVALID_TARGET_ID', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('question_review:' || normalized_question_id, 0)
  );

  select baseline.misconception_ids
    into baseline_ids
  from public.question_misconception_baselines as baseline
  where baseline.question_id = normalized_question_id;

  if not found then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  select pg_catalog.count(distinct review.reviewer_id)::integer
    into reviewer_count
  from public.question_reviews as review
  where review.question_id = normalized_question_id;

  if reviewer_count <> 3 then
    raise exception using message = 'CONSENSUS_REQUIRES_THREE_REVIEWERS', errcode = 'P0001';
  end if;

  select
    public.normalize_text_id_array(
      array(
        select pg_catalog.btrim(value.id)
        from public.question_reviews as review
        cross join lateral pg_catalog.unnest(
          review.removed_misconception_ids
        ) as value(id)
        where review.question_id = normalized_question_id
          and review.has_incorrect_misconceptions
          and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
        group by pg_catalog.btrim(value.id)
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      )
    ),
    public.normalize_text_id_array(
      array(
        select pg_catalog.btrim(value.id)
        from public.question_reviews as review
        cross join lateral pg_catalog.unnest(
          review.additional_misconception_ids
        ) as value(id)
        where review.question_id = normalized_question_id
          and review.has_additional_misconceptions
          and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
        group by pg_catalog.btrim(value.id)
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      )
    )
  into removed_ids, added_ids;

  select added.id
    into invalid_added_id
  from pg_catalog.unnest(added_ids) as added(id)
  where not exists (
    select 1
    from public.master_misconception_catalog as catalog
    where catalog.misconception_id = added.id
  )
  limit 1;

  if invalid_added_id is not null then
    raise exception using message = 'INVALID_MISCONCEPTION_ID', errcode = '22023';
  end if;

  select public.normalize_text_id_array(
    array(
      select baseline.id
      from pg_catalog.unnest(baseline_ids) as baseline(id)
      where not (baseline.id = any(removed_ids))
      union
      select added.id from pg_catalog.unnest(added_ids) as added(id)
    )
  ) into final_ids;

  insert into public.question_misconception_overrides (
    question_id,
    misconception_ids,
    source_review_count,
    published_by,
    published_at
  )
  values (
    normalized_question_id,
    final_ids,
    reviewer_count,
    (select auth.uid()),
    pg_catalog.now()
  )
  on conflict on constraint question_misconception_overrides_pkey do update
  set
    misconception_ids = excluded.misconception_ids,
    source_review_count = excluded.source_review_count,
    published_by = excluded.published_by,
    published_at = excluded.published_at
  returning
    question_misconception_overrides.question_id,
    question_misconception_overrides.misconception_ids,
    question_misconception_overrides.source_review_count,
    question_misconception_overrides.published_at,
    question_misconception_overrides.updated_at
  into question_id, misconception_ids, source_review_count, published_at, updated_at;

  return next;
end;
$$;

create or replace function public.publish_answer_misconception_override(
  input_answer_id text
)
returns table (
  answer_id text,
  question_id text,
  misconception_ids text[],
  source_review_count integer,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_answer_id text := pg_catalog.btrim(input_answer_id);
  normalized_question_id text;
  baseline_ids text[];
  reviewer_count integer;
  reviewed_question_id text;
  reviewed_question_count integer;
  removed_ids text[];
  added_ids text[];
  invalid_added_id text;
  final_ids text[];
begin
  if not exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_answer_id) = 0 then
    raise exception using message = 'INVALID_TARGET_ID', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('answer_review:' || normalized_answer_id, 0)
  );

  select baseline.question_id, baseline.misconception_ids
    into normalized_question_id, baseline_ids
  from public.answer_misconception_baselines as baseline
  where baseline.answer_id = normalized_answer_id;

  if not found then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  select
    pg_catalog.count(distinct review.reviewer_id)::integer,
    pg_catalog.min(review.question_id),
    pg_catalog.count(distinct review.question_id)::integer
    into reviewer_count, reviewed_question_id, reviewed_question_count
  from public.answer_reviews as review
  where review.answer_id = normalized_answer_id;

  if reviewer_count <> 3 then
    raise exception using message = 'CONSENSUS_REQUIRES_THREE_REVIEWERS', errcode = 'P0001';
  end if;

  if reviewed_question_count <> 1
    or reviewed_question_id is distinct from normalized_question_id then
    raise exception using message = 'ANSWER_QUESTION_MISMATCH', errcode = '22023';
  end if;

  select
    public.normalize_text_id_array(
      array(
        select pg_catalog.btrim(value.id)
        from public.answer_reviews as review
        cross join lateral pg_catalog.unnest(
          review.removed_misconception_ids
        ) as value(id)
        where review.answer_id = normalized_answer_id
          and review.has_mismatched_misconceptions
          and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
        group by pg_catalog.btrim(value.id)
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      )
    ),
    public.normalize_text_id_array(
      array(
        select pg_catalog.btrim(value.id)
        from public.answer_reviews as review
        cross join lateral pg_catalog.unnest(
          review.additional_misconception_ids
        ) as value(id)
        where review.answer_id = normalized_answer_id
          and review.has_additional_misconceptions
          and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
        group by pg_catalog.btrim(value.id)
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      )
    )
  into removed_ids, added_ids;

  select added.id
    into invalid_added_id
  from pg_catalog.unnest(added_ids) as added(id)
  where not exists (
    select 1
    from public.master_misconception_catalog as catalog
    where catalog.misconception_id = added.id
  )
  limit 1;

  if invalid_added_id is not null then
    raise exception using message = 'INVALID_MISCONCEPTION_ID', errcode = '22023';
  end if;

  select public.normalize_text_id_array(
    array(
      select baseline.id
      from pg_catalog.unnest(baseline_ids) as baseline(id)
      where not (baseline.id = any(removed_ids))
      union
      select added.id from pg_catalog.unnest(added_ids) as added(id)
    )
  ) into final_ids;

  insert into public.answer_misconception_overrides (
    answer_id,
    question_id,
    misconception_ids,
    source_review_count,
    published_by,
    published_at
  )
  values (
    normalized_answer_id,
    normalized_question_id,
    final_ids,
    reviewer_count,
    (select auth.uid()),
    pg_catalog.now()
  )
  on conflict on constraint answer_misconception_overrides_pkey do update
  set
    question_id = excluded.question_id,
    misconception_ids = excluded.misconception_ids,
    source_review_count = excluded.source_review_count,
    published_by = excluded.published_by,
    published_at = excluded.published_at
  returning
    answer_misconception_overrides.answer_id,
    answer_misconception_overrides.question_id,
    answer_misconception_overrides.misconception_ids,
    answer_misconception_overrides.source_review_count,
    answer_misconception_overrides.published_at,
    answer_misconception_overrides.updated_at
  into answer_id, question_id, misconception_ids, source_review_count, published_at, updated_at;

  return next;
end;
$$;

create or replace function public.save_question_content_override(
  input_question_id text,
  input_question_ind text,
  input_question_en text,
  input_question_code text
)
returns table (
  question_id text,
  question_ind text,
  question_en text,
  question_code text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_question_id text := pg_catalog.btrim(input_question_id);
begin
  if not exists (
    select 1 from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid()) and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_question_id) = 0
    or (
      pg_catalog.length(pg_catalog.btrim(coalesce(input_question_ind, ''))) = 0
      and pg_catalog.length(pg_catalog.btrim(coalesce(input_question_en, ''))) = 0
      and pg_catalog.length(pg_catalog.btrim(coalesce(input_question_code, ''))) = 0
    ) then
    raise exception using message = 'INVALID_QUESTION_CONTENT', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  if not exists (
    select 1
    from public.question_misconception_baselines as baseline
    where baseline.question_id = normalized_question_id
  ) then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  insert into public.question_content_overrides (
    question_id, question_ind, question_en, question_code, updated_by
  )
  values (
    normalized_question_id,
    input_question_ind,
    input_question_en,
    input_question_code,
    (select auth.uid())
  )
  on conflict on constraint question_content_overrides_pkey do update
  set
    question_ind = excluded.question_ind,
    question_en = excluded.question_en,
    question_code = excluded.question_code,
    updated_by = excluded.updated_by
  returning
    question_content_overrides.question_id,
    question_content_overrides.question_ind,
    question_content_overrides.question_en,
    question_content_overrides.question_code,
    question_content_overrides.updated_at
  into question_id, question_ind, question_en, question_code, updated_at;

  return next;
end;
$$;

create or replace function public.save_answer_content_override(
  input_answer_id text,
  input_answer_text text
)
returns table (
  answer_id text,
  answer_text text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_answer_id text := pg_catalog.btrim(input_answer_id);
begin
  if not exists (
    select 1 from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid()) and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_answer_id) = 0
    or pg_catalog.length(pg_catalog.btrim(input_answer_text)) = 0 then
    raise exception using message = 'INVALID_ANSWER_CONTENT', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  if not exists (
    select 1
    from public.answer_misconception_baselines as baseline
    where baseline.answer_id = normalized_answer_id
  ) then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  insert into public.answer_content_overrides (
    answer_id, answer_text, updated_by
  )
  values (
    normalized_answer_id,
    input_answer_text,
    (select auth.uid())
  )
  on conflict on constraint answer_content_overrides_pkey do update
  set answer_text = excluded.answer_text, updated_by = excluded.updated_by
  returning
    answer_content_overrides.answer_id,
    answer_content_overrides.answer_text,
    answer_content_overrides.updated_at
  into answer_id, answer_text, updated_at;

  return next;
end;
$$;

revoke all on function public.publish_question_misconception_override(text)
  from public, anon, service_role;
revoke all on function public.publish_answer_misconception_override(text)
  from public, anon, service_role;
revoke all on function public.save_question_content_override(text, text, text, text)
  from public, anon, service_role;
revoke all on function public.save_answer_content_override(text, text)
  from public, anon, service_role;

grant execute on function public.publish_question_misconception_override(text)
  to authenticated;
grant execute on function public.publish_answer_misconception_override(text)
  to authenticated;
grant execute on function public.save_question_content_override(text, text, text, text)
  to authenticated;
grant execute on function public.save_answer_content_override(text, text)
  to authenticated;

commit;
