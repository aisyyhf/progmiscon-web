-- Review-v3 forward migration (PR2: finalization / publish-path lifecycle).
--
-- Context. PR1 (20260831130000_review_v3_workflow_reset_and_lifecycle_reads.sql)
-- made the lifecycle definition itself correct: a whole-question reset, the
-- lecturer-facing "current" counts / "reviewed by me" status, the Admin deleted
-- and edit history, the lifecycle CSV state and orphan reconciliation all now
-- agree that a review is a CURRENT reviewer / CURRENT vote only when
--   * question_reviews.is_active = true AND its source_version equals the
--     question's current question_misconception_baselines.source_version;
--   * answer_reviews.is_active = true AND its source_version equals that
--     answer's OWN current answer_misconception_baselines.source_version.
--
-- The Admin Finalization / publish path was deliberately left for this PR. Three
-- functions still aggregated raw review rows with no lifecycle / current-version
-- filter, so a review that is deleted ('deleted'), source-invalidated
-- ('source_updated') or simply from an older source_version could still:
--   * inflate Admin Finalization (get_admin_review_consensus.review_count),
--     e.g. show 3/3 after a third reviewer reset their whole review;
--   * contribute stale removed / additional misconception votes to that panel;
--   * satisfy the publish_* three-reviewer gate;
--   * feed a freshly published override snapshot.
--
-- This migration applies the SAME active/current definition PR1 uses to:
--
--   1. get_admin_review_consensus(): every question and answer CTE
--      (reviewer-count target, removed-vote aggregate, additional-vote
--      aggregate) now joins the target's own baseline and keeps only
--      is_active = true rows at that baseline's source_version. Question CTEs
--      match the question baseline; answer CTEs match each answer's own answer
--      baseline (question and answer source versions are never assumed equal).
--      The consensus math itself -- the final SELECT, the >=2 vote counting done
--      client-side, the published/baseline projection -- is unchanged; only the
--      input row set is filtered.
--
--   2. publish_question_misconception_override(input_question_id): the
--      three-reviewer gate, the >=2 removed-vote aggregate and the >=2
--      additional-vote aggregate now count only is_active = true question
--      reviews at the question baseline's current source_version. The published
--      row records that source_version (the column is NOT NULL and every
--      recompute_*_v3 write already sets it; the manual path now matches).
--
--   3. publish_answer_misconception_override(input_answer_id): identical
--      treatment against the answer's own answer_misconception_baselines
--      source_version. The ANSWER_QUESTION_MISMATCH guard, the catalogue
--      validation of additions, the "baseline minus removals plus additions"
--      final snapshot and source_review_count semantics are unchanged.
--
-- No table, column, constraint, index, trigger or policy is touched and no
-- function signature, ownership, volatility, SECURITY DEFINER attribute,
-- search_path or grant/revoke changes, so the Review-v3 epoch guard contract is
-- unaffected. Already-published overrides are NOT reconciled here: every review
-- lifecycle transition already routes through recompute_*_v3, which deletes an
-- override whose current active/current reviewer count has fallen below three,
-- so stale rows self-heal on the next review touch or baseline sync. A
-- read-only production preflight for operators to quantify this before rollout
-- lives at database/replay/publish-lifecycle-preflight.sql, not in this
-- migration.

begin;

-- ===========================================================================
-- 1. Admin Finalization consensus -- lifecycle / current-version aware
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_admin_review_consensus()
 RETURNS TABLE(target_type text, target_id text, question_id text, review_count integer, removed_votes jsonb, additional_votes jsonb, published_misconception_ids text[], published_at timestamp with time zone, baseline_misconception_ids text[], baseline_synced_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with question_targets as (
    select
      'question'::text as target_type,
      review.question_id as target_id,
      review.question_id,
      pg_catalog.count(distinct review.reviewer_id)::integer as review_count
    from public.question_reviews as review
    join public.question_misconception_baselines as baseline
      on baseline.question_id = review.question_id
     and baseline.source_version = review.source_version
    where review.is_active = true
    group by review.question_id
  ),
  question_removed as (
    select
      review.question_id as target_id,
      pg_catalog.btrim(value.id) as id,
      pg_catalog.count(distinct review.reviewer_id)::integer as votes
    from public.question_reviews as review
    join public.question_misconception_baselines as baseline
      on baseline.question_id = review.question_id
     and baseline.source_version = review.source_version
    cross join lateral pg_catalog.unnest(review.removed_misconception_ids) as value(id)
    where review.is_active = true
      and review.has_incorrect_misconceptions
      and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
    group by review.question_id, pg_catalog.btrim(value.id)
  ),
  question_added as (
    select
      review.question_id as target_id,
      pg_catalog.btrim(value.id) as id,
      pg_catalog.count(distinct review.reviewer_id)::integer as votes
    from public.question_reviews as review
    join public.question_misconception_baselines as baseline
      on baseline.question_id = review.question_id
     and baseline.source_version = review.source_version
    cross join lateral pg_catalog.unnest(review.additional_misconception_ids) as value(id)
    where review.is_active = true
      and review.has_additional_misconceptions
      and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
    group by review.question_id, pg_catalog.btrim(value.id)
  ),
  answer_targets as (
    select
      'answer'::text as target_type,
      review.answer_id as target_id,
      pg_catalog.min(review.question_id) as question_id,
      pg_catalog.count(distinct review.reviewer_id)::integer as review_count
    from public.answer_reviews as review
    join public.answer_misconception_baselines as baseline
      on baseline.answer_id = review.answer_id
     and baseline.source_version = review.source_version
    where review.is_active = true
    group by review.answer_id
  ),
  answer_removed as (
    select
      review.answer_id as target_id,
      pg_catalog.btrim(value.id) as id,
      pg_catalog.count(distinct review.reviewer_id)::integer as votes
    from public.answer_reviews as review
    join public.answer_misconception_baselines as baseline
      on baseline.answer_id = review.answer_id
     and baseline.source_version = review.source_version
    cross join lateral pg_catalog.unnest(review.removed_misconception_ids) as value(id)
    where review.is_active = true
      and review.has_mismatched_misconceptions
      and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
    group by review.answer_id, pg_catalog.btrim(value.id)
  ),
  answer_added as (
    select
      review.answer_id as target_id,
      pg_catalog.btrim(value.id) as id,
      pg_catalog.count(distinct review.reviewer_id)::integer as votes
    from public.answer_reviews as review
    join public.answer_misconception_baselines as baseline
      on baseline.answer_id = review.answer_id
     and baseline.source_version = review.source_version
    cross join lateral pg_catalog.unnest(review.additional_misconception_ids) as value(id)
    where review.is_active = true
      and review.has_additional_misconceptions
      and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
    group by review.answer_id, pg_catalog.btrim(value.id)
  )
  select
    target.target_type,
    target.target_id,
    target.question_id,
    target.review_count,
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(vote.id, vote.votes order by vote.id)
        from question_removed as vote
        where vote.target_id = target.target_id
      ),
      '{}'::jsonb
    ),
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(vote.id, vote.votes order by vote.id)
        from question_added as vote
        where vote.target_id = target.target_id
      ),
      '{}'::jsonb
    ),
    published.misconception_ids,
    published.published_at,
    baseline.misconception_ids,
    baseline.synced_at
  from question_targets as target
  left join public.question_misconception_overrides as published
    on published.question_id = target.target_id
  left join public.question_misconception_baselines as baseline
    on baseline.question_id = target.target_id
  where (select public.current_user_is_admin())

  union all

  select
    target.target_type,
    target.target_id,
    target.question_id,
    target.review_count,
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(vote.id, vote.votes order by vote.id)
        from answer_removed as vote
        where vote.target_id = target.target_id
      ),
      '{}'::jsonb
    ),
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(vote.id, vote.votes order by vote.id)
        from answer_added as vote
        where vote.target_id = target.target_id
      ),
      '{}'::jsonb
    ),
    published.misconception_ids,
    published.published_at,
    baseline.misconception_ids,
    baseline.synced_at
  from answer_targets as target
  left join public.answer_misconception_overrides as published
    on published.answer_id = target.target_id
  left join public.answer_misconception_baselines as baseline
    on baseline.answer_id = target.target_id
  where (select public.current_user_is_admin());
$function$;

revoke all on function public.get_admin_review_consensus() from public, anon, authenticated, service_role;
grant execute on function public.get_admin_review_consensus() to authenticated;

-- ===========================================================================
-- 2. Question publish override -- lifecycle / current-version aware
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.publish_question_misconception_override(input_question_id text)
 RETURNS TABLE(question_id text, misconception_ids text[], source_review_count integer, published_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized_question_id text := pg_catalog.btrim(input_question_id);
  current_version uuid;
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

  select baseline.misconception_ids, baseline.source_version
    into baseline_ids, current_version
  from public.question_misconception_baselines as baseline
  where baseline.question_id = normalized_question_id;

  if not found then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  select pg_catalog.count(distinct review.reviewer_id)::integer
    into reviewer_count
  from public.question_reviews as review
  where review.question_id = normalized_question_id
    and review.is_active = true
    and review.source_version = current_version;

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
          and review.is_active = true
          and review.source_version = current_version
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
          and review.is_active = true
          and review.source_version = current_version
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
    published_at,
    source_version
  )
  values (
    normalized_question_id,
    final_ids,
    reviewer_count,
    (select auth.uid()),
    pg_catalog.now(),
    current_version
  )
  on conflict on constraint question_misconception_overrides_pkey do update
  set
    misconception_ids = excluded.misconception_ids,
    source_review_count = excluded.source_review_count,
    published_by = excluded.published_by,
    published_at = excluded.published_at,
    source_version = excluded.source_version
  returning
    question_misconception_overrides.question_id,
    question_misconception_overrides.misconception_ids,
    question_misconception_overrides.source_review_count,
    question_misconception_overrides.published_at,
    question_misconception_overrides.updated_at
  into question_id, misconception_ids, source_review_count, published_at, updated_at;

  return next;
end;
$function$;

revoke all on function public.publish_question_misconception_override(text) from public, anon, authenticated, service_role;

-- ===========================================================================
-- 3. Answer publish override -- lifecycle / current-version aware
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.publish_answer_misconception_override(input_answer_id text)
 RETURNS TABLE(answer_id text, question_id text, misconception_ids text[], source_review_count integer, published_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  normalized_answer_id text := pg_catalog.btrim(input_answer_id);
  normalized_question_id text;
  current_version uuid;
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

  select baseline.question_id, baseline.misconception_ids, baseline.source_version
    into normalized_question_id, baseline_ids, current_version
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
  where review.answer_id = normalized_answer_id
    and review.is_active = true
    and review.source_version = current_version;

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
          and review.is_active = true
          and review.source_version = current_version
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
          and review.is_active = true
          and review.source_version = current_version
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
    published_at,
    source_version
  )
  values (
    normalized_answer_id,
    normalized_question_id,
    final_ids,
    reviewer_count,
    (select auth.uid()),
    pg_catalog.now(),
    current_version
  )
  on conflict on constraint answer_misconception_overrides_pkey do update
  set
    question_id = excluded.question_id,
    misconception_ids = excluded.misconception_ids,
    source_review_count = excluded.source_review_count,
    published_by = excluded.published_by,
    published_at = excluded.published_at,
    source_version = excluded.source_version
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
$function$;

revoke all on function public.publish_answer_misconception_override(text) from public, anon, authenticated, service_role;

commit;
