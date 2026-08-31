-- Review-v3 forward migration (PR1: lifecycle correctness -- core + reads).
--
-- Context. Deleting a lecturer's Question Review previously only deactivated the
-- question_reviews row. For a multiple-choice question the same lecturer's
-- Answer Reviews A/B/C/D stayed is_active = true, so the lecturer kept counting
-- as a reviewer and the Answer Reviews kept feeding current consensus even
-- though, from the lecturer's point of view, they had reset their whole review
-- of that question. The frontend "Hapus review" control also called only the
-- single-row delete. There is no way for a lecturer to atomically reset their
-- entire review workflow for one question.
--
-- This migration:
--
--   1. Adds delete_question_review_workflow_v3(p_question_id, p_source_version).
--      It deactivates the caller's active current-version Question Review (if
--      any) AND every one of the caller's active Answer Reviews for that
--      question that still matches the answer's OWN current
--      answer_misconception_baselines.source_version, then recomputes question
--      and answer consensus through the existing recompute_* functions. It is
--      atomic and idempotent: an already-deleted / missing Question Review is
--      not an error, and rows that are already inactive (including
--      inactive_reason = 'source_updated') are never touched or rewritten.
--      p_source_version is validated only against the QUESTION baseline; each
--      Answer Review is matched against its own answer baseline version.
--
--   2. One-time, generic, predicate-based reconciliation of the historical
--      partial-delete defect: any reviewer/question whose question_reviews row
--      is inactive with inactive_reason = 'deleted', who has NO active Question
--      Review for that question, yet still has an active Answer Review for it at
--      the answer's current baseline version. Those still-active Answer Reviews
--      are soft-deleted (inactive_reason = 'deleted') and their consensus is
--      recomputed. The "no active Question Review" guard keeps a reviewer who
--      legitimately re-reviewed the question at a newer source version (leaving
--      an older generation's Question Review row deleted) from having their new
--      Answer Reviews reset. No reviewer / question / lecturer identifiers are
--      referenced or logged; only aggregate NOTICE counts are emitted. Clean
--      no-op when nothing matches.
--
--   3. Makes the lecturer-facing "current" read paths lifecycle-aware so
--      deleted or source-invalidated reviews can no longer inflate current
--      reviewer counts or "reviewed by me" status:
--        - get_question_review_counts: only is_active rows at the question's
--          current baseline source_version.
--        - get_answer_review_counts: only is_active rows at the answer's
--          current baseline source_version.
--        - get_my_review_status: only is_active rows (a deleted or
--          source_updated review is is_active = false, so the single filter
--          excludes both). Stays SECURITY INVOKER; RLS still scopes to the
--          caller.
--
--   4. Adds get_admin_review_lifecycle(): an admin-only, read-only projection
--      of review_audit_log that reports, per review row, the last lifecycle
--      event, whether it was edited after its latest creation/reactivation, and
--      the before-image + timestamp of its most recent deletion. It lets
--      Admin -> Hasil Review Dosen show "Aktif / Dibuat", "Aktif / Diedit" and
--      historical "Dihapus / Dihapus" generations (including a generation that
--      was later reactivated) without exploding edit revisions into rows and
--      without any deleted/stale row participating in current counts.
--
-- Admin consensus (get_admin_review_consensus) and the publish_* override RPCs
-- are deliberately NOT changed here; that active/current filtering is PR2.
--
-- Signatures/volatility/SECURITY/search_path/ACLs of the three changed read
-- functions are unchanged, and no table, column, constraint, index, trigger or
-- policy is touched, so the Review-v3 epoch guard contract is unaffected.

begin;

-- ===========================================================================
-- 1. Whole-question review workflow reset
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.delete_question_review_workflow_v3(p_question_id text, p_source_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  target_id text := pg_catalog.btrim(coalesce(p_question_id, ''));
  question_current_version uuid;
  question_review_id uuid;
  question_review_reset boolean := false;
  deactivated_answers jsonb;
  answer_generation jsonb := pg_catalog.jsonb_build_array();
  answer_row record;
  question_consensus jsonb;
begin
  if caller_id is null then
    raise exception using message = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.lecturer_profiles profile
    where profile.user_id = caller_id
      and profile.active = true
  ) then
    raise exception using message = 'LECTURER_INACTIVE', errcode = 'P0001';
  end if;

  -- Serialise against sync_master_relation_baselines_v2 so no answer can be
  -- flipped to 'source_updated' between the version snapshot and the writes.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  select baseline.source_version
  into question_current_version
  from public.question_misconception_baselines baseline
  where baseline.question_id = target_id
  for update;

  if not found then
    raise exception using message = 'QUESTION_NOT_FOUND', errcode = 'P0001';
  end if;

  if question_current_version is distinct from p_source_version then
    raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
  end if;

  -- Question Review: deactivate the caller's active current-version row if it
  -- exists. Idempotent -- an already-deleted or absent row is not an error, the
  -- workflow still cleans up any caller-owned current active Answer Reviews.
  update public.question_reviews review
  set
    is_active = false,
    inactive_reason = 'deleted',
    inactive_at = pg_catalog.now()
  where review.reviewer_id = caller_id
    and review.question_id = target_id
    and review.source_version = question_current_version
    and review.is_active = true
  returning review.id into question_review_id;

  if found then
    question_review_reset := true;
  end if;

  -- Answer Reviews: each answer carries its OWN current source_version. Only the
  -- caller's active Answer Reviews that still match their answer's current
  -- baseline version take part in the reset. Rows that are already inactive
  -- (inactive_reason 'source_updated' or an earlier 'deleted') are excluded by
  -- is_active = true and are never rewritten to a lecturer 'deleted'.
  with deactivated as (
    update public.answer_reviews review
    set
      is_active = false,
      inactive_reason = 'deleted',
      inactive_at = pg_catalog.now()
    from public.answer_misconception_baselines baseline
    where review.reviewer_id = caller_id
      and review.question_id = target_id
      and review.answer_id = baseline.answer_id
      and review.is_active = true
      and review.source_version = baseline.source_version
    returning review.id as review_id, review.answer_id, review.source_version
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'review_id', deactivated.review_id,
        'answer_id', deactivated.answer_id,
        'source_version', deactivated.source_version
      )
      order by deactivated.answer_id
    ),
    pg_catalog.jsonb_build_array()
  )
  into deactivated_answers
  from deactivated;

  for answer_row in
    select
      element ->> 'answer_id' as answer_id,
      (element ->> 'source_version')::uuid as source_version
    from pg_catalog.jsonb_array_elements(deactivated_answers) as element
  loop
    answer_generation := answer_generation || pg_catalog.jsonb_build_object(
      'answer_id', answer_row.answer_id,
      'source_version', answer_row.source_version,
      'consensus', public.recompute_answer_review_consensus_v3(
        answer_row.answer_id,
        answer_row.source_version
      )
    );
  end loop;

  question_consensus := public.recompute_question_review_consensus_v3(
    target_id,
    question_current_version
  );

  return pg_catalog.jsonb_build_object(
    'question_id', target_id,
    'source_version', question_current_version,
    'question_review_id', question_review_id,
    'question_review_reset', question_review_reset,
    'deactivated_answer_reviews', deactivated_answers,
    'question_consensus', question_consensus,
    'answer_consensus', answer_generation
  );
end;
$function$;

revoke all on function public.delete_question_review_workflow_v3(p_question_id text, p_source_version uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_question_review_workflow_v3(p_question_id text, p_source_version uuid) to authenticated, service_role;

-- ===========================================================================
-- 2. One-time generic reconciliation of the historical partial-delete defect
-- ===========================================================================
do $reconcile_orphaned_question_workflows$
declare
  answer_rows integer := 0;
  orphan_pairs integer := 0;
  affected_answers integer := 0;
  affected_answer record;
begin
  create temporary table _review_v3_orphan_answer_reviews on commit drop as
  select
    ar.id as review_id,
    ar.reviewer_id,
    ar.question_id,
    ar.answer_id,
    amb.source_version
  from public.answer_reviews ar
  join public.answer_misconception_baselines amb
    on amb.answer_id = ar.answer_id
  where ar.is_active = true
    and ar.source_version = amb.source_version
    -- The reviewer intentionally deleted a Question Review for this question ...
    and exists (
      select 1
      from public.question_reviews qr
      where qr.reviewer_id = ar.reviewer_id
        and qr.question_id = ar.question_id
        and qr.is_active = false
        and qr.inactive_reason = 'deleted'
    )
    -- ... and has NOT since started a new active Question Review for it. Without
    -- this guard, a reviewer who re-reviewed the question at a newer source
    -- version (leaving the old generation's Question Review row deleted) would
    -- have their new, legitimate Answer Reviews wrongly reset by this backfill.
    and not exists (
      select 1
      from public.question_reviews qr2
      where qr2.reviewer_id = ar.reviewer_id
        and qr2.question_id = ar.question_id
        and qr2.is_active = true
    );

  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct (reviewer_id, question_id))::integer,
    pg_catalog.count(distinct answer_id)::integer
  into answer_rows, orphan_pairs, affected_answers
  from _review_v3_orphan_answer_reviews;

  if answer_rows = 0 then
    raise notice 'Review-v3 orphan reconciliation: no orphaned answer reviews; no-op.';
    return;
  end if;

  raise notice 'Review-v3 orphan reconciliation: deactivating % orphaned answer review row(s) across % reviewer/question pair(s), % answer(s).',
    answer_rows, orphan_pairs, affected_answers;

  update public.answer_reviews ar
  set
    is_active = false,
    inactive_reason = 'deleted',
    inactive_at = pg_catalog.now()
  from _review_v3_orphan_answer_reviews orphan
  where orphan.review_id = ar.id;

  for affected_answer in
    select distinct answer_id, source_version
    from _review_v3_orphan_answer_reviews
  loop
    perform public.recompute_answer_review_consensus_v3(
      affected_answer.answer_id,
      affected_answer.source_version
    );
  end loop;

  raise notice 'Review-v3 orphan reconciliation: recomputed consensus for % answer(s).',
    affected_answers;
end;
$reconcile_orphaned_question_workflows$;

-- ===========================================================================
-- 3. Lifecycle-aware "current" read paths
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_question_review_counts()
 RETURNS TABLE(question_id text, review_count integer, latest_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    review.question_id,
    pg_catalog.count(distinct review.reviewer_id)::integer as review_count,
    pg_catalog.max(review.updated_at) as latest_updated_at
  from public.question_reviews review
  join public.question_misconception_baselines baseline
    on baseline.question_id = review.question_id
   and baseline.source_version = review.source_version
  where review.is_active = true
    and exists (
      select 1
      from public.lecturer_profiles profile
      where profile.user_id = (select auth.uid())
        and profile.active = true
    )
  group by review.question_id;
$function$;

revoke all on function public.get_question_review_counts() from public, anon, authenticated, service_role;
grant execute on function public.get_question_review_counts() to authenticated;

CREATE OR REPLACE FUNCTION public.get_answer_review_counts()
 RETURNS TABLE(answer_id text, review_count integer, latest_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select
    review.answer_id,
    pg_catalog.count(distinct review.reviewer_id)::integer,
    pg_catalog.max(review.updated_at)
  from public.answer_reviews review
  join public.answer_misconception_baselines baseline
    on baseline.answer_id = review.answer_id
   and baseline.source_version = review.source_version
  where review.is_active = true
    and exists (
      select 1
      from public.lecturer_profiles profile
      where profile.user_id = (select auth.uid())
        and profile.active = true
    )
  group by review.answer_id;
$function$;

revoke all on function public.get_answer_review_counts() from public, anon, authenticated, service_role;
grant execute on function public.get_answer_review_counts() to authenticated;

CREATE OR REPLACE FUNCTION public.get_my_review_status()
 RETURNS TABLE(question_ids text[], answer_ids text[], question_review_count integer, answer_review_count integer, latest_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  with question_status as (
    select
      coalesce(
        array_agg(distinct question_id order by question_id),
        '{}'::text[]
      ) as question_ids,
      count(distinct question_id)::integer as review_count,
      max(updated_at) as latest_updated_at
    from public.question_reviews
    where reviewer_id = (select auth.uid())
      and is_active = true
  ),
  answer_status as (
    select
      coalesce(
        array_agg(distinct answer_id order by answer_id),
        '{}'::text[]
      ) as answer_ids,
      count(distinct answer_id)::integer as review_count,
      max(updated_at) as latest_updated_at
    from public.answer_reviews
    where reviewer_id = (select auth.uid())
      and is_active = true
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
$function$;

revoke all on function public.get_my_review_status() from public, anon, authenticated, service_role;
grant execute on function public.get_my_review_status() to authenticated;

-- ===========================================================================
-- 4. Admin-only lifecycle projection of review_audit_log
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_admin_review_lifecycle()
 RETURNS TABLE(review_type text, review_id uuid, last_event_type text, last_event_at timestamp with time zone, edited boolean, last_deleted_at timestamp with time zone, last_deleted_before jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  with events as (
    select
      log.review_type,
      log.review_id,
      log.event_type,
      log.occurred_at,
      log.before_data
    from public.review_audit_log log
    where (select public.current_user_is_admin())
  ),
  last_start as (
    select
      events.review_id,
      pg_catalog.max(events.occurred_at) as started_at
    from events
    where events.event_type in ('created', 'reactivated')
    group by events.review_id
  ),
  last_event as (
    select distinct on (events.review_id)
      events.review_id,
      events.review_type,
      events.event_type,
      events.occurred_at
    from events
    order by events.review_id, events.occurred_at desc, events.event_type
  ),
  last_deleted as (
    select distinct on (events.review_id)
      events.review_id,
      events.occurred_at as deleted_at,
      events.before_data as deleted_before
    from events
    where events.event_type = 'deleted'
    order by events.review_id, events.occurred_at desc
  )
  select
    last_event.review_type,
    last_event.review_id,
    last_event.event_type as last_event_type,
    last_event.occurred_at as last_event_at,
    exists (
      select 1
      from events edit_event
      where edit_event.review_id = last_event.review_id
        and edit_event.event_type = 'edited'
        and edit_event.occurred_at >= coalesce(last_start.started_at, edit_event.occurred_at)
    ) as edited,
    last_deleted.deleted_at as last_deleted_at,
    last_deleted.deleted_before as last_deleted_before
  from last_event
  left join last_start on last_start.review_id = last_event.review_id
  left join last_deleted on last_deleted.review_id = last_event.review_id;
$function$;

revoke all on function public.get_admin_review_lifecycle() from public, anon, authenticated, service_role;
grant execute on function public.get_admin_review_lifecycle() to authenticated;

commit;
