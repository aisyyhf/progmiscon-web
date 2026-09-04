-- Review-v3 forward migration: ADMIN — targeted Question Review reset.
--
-- Context. Week 2 lecturer reviews are complete (3/3) and the product no longer
-- wants a canonical question edit to force a broad review reset. Instead an
-- admin gets one deliberate, narrowly scoped action: reset the Question Reviews
-- of exactly ONE question. Editing a question stays a normal edit; it does not
-- reset reviews. This migration adds only that admin action.
--
-- reset_question_reviews_v3(p_question_id, p_source_version):
--
--   * validates a non-blank question id and requires an active lecturer who is
--     also an admin (current_user_is_admin()), else ADMIN_ACCESS_REQUIRED --
--     an unauthorised or non-admin lecturer can never reset;
--   * takes the same sync_master_relation_baselines_v2 advisory lock every
--     Review-v3 write uses, then resolves the question baseline row FOR UPDATE;
--   * QUESTION_NOT_FOUND if the baseline is absent;
--   * DATA_VERSION_CHANGED if the supplied source_version is not the current
--     baseline source_version -- a stale caller fails closed and mutates nothing;
--   * deactivates EVERY reviewer's active, current-version Question Review for
--     that one question:
--         is_active        = false
--         inactive_reason  = 'deleted'   (the existing lifecycle enum value)
--         inactive_at      = now()
--     The predicate is `question_id = target AND source_version = current
--     AND is_active = true`. It is NEVER filtered by auth.uid(): this is an
--     admin reset of the whole panel, not a self-service delete. Rows that are
--     already inactive (an earlier 'deleted' or a 'source_updated' generation,
--     current or older) are excluded by is_active = true and never rewritten.
--     Other question ids are never touched.
--   * NEVER reads or writes answer_reviews, NEVER calls
--     recompute_answer_review_consensus_v3, NEVER deletes or mutates
--     answer_misconception_overrides;
--   * recomputes ONLY question consensus via
--     recompute_question_review_consensus_v3. With the active reviewer count now
--     below three it deletes any published question_misconception_overrides row
--     (the effective mapping reverts to the master baseline); it touches only
--     question_misconception_overrides.
--   * does NOT bump the question baseline source_version and does NOT change the
--     source_version stored on the review rows -- a reset is not a content edit.
--   * is idempotent: a repeat call deactivates 0 rows, the recompute is a
--     no-op, and no audit rows are written; a reset of a question with zero
--     active reviews returns reviews_reset = 0 without error.
--   * returns jsonb:
--       { question_id, source_version, reviews_reset, reviewers_reset,
--         override_removed, question_consensus }
--
-- The existing question_reviews_audit trigger records one 'deleted' event per
-- deactivated review with the full before-image, so history is preserved.
--
-- AUDIT CAVEAT (documented, deliberately out of scope here): review_audit_log
-- has no actor column, so this admin reset is recorded but is indistinguishable
-- from the reviewer deleting their own review. Adding an actor_id is separate
-- future work and is NOT done in this migration.
--
-- This is a function-only migration: no table, column, constraint, index,
-- trigger or policy is created or altered. The function is EXECUTE-granted to
-- `authenticated` only (never anon, never public, never service_role); the
-- internal admin gate is the real authorisation. No direct table-write grant is
-- added. The Review-v3 epoch guard contract is unaffected.

begin;

CREATE OR REPLACE FUNCTION public.reset_question_reviews_v3(p_question_id text, p_source_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  target_id text := pg_catalog.btrim(coalesce(p_question_id, ''));
  question_current_version uuid;
  reviews_reset integer := 0;
  reviewers_reset integer := 0;
  override_existed boolean := false;
  override_removed boolean := false;
  question_consensus jsonb;
begin
  if caller_id is null then
    raise exception using message = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(target_id) = 0 then
    raise exception using message = 'INVALID_TARGET_ID', errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.lecturer_profiles profile
    where profile.user_id = caller_id
      and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  -- Serialise against sync_master_relation_baselines_v2 so the question baseline
  -- version cannot change between the snapshot and the writes.
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

  select exists (
    select 1
    from public.question_misconception_overrides override_row
    where override_row.question_id = target_id
  )
  into override_existed;

  -- Deactivate every reviewer's active current-version Question Review for this
  -- one question. Never filtered by auth.uid(). Already-inactive rows and other
  -- question ids are untouched. Legacy Answer Reviews and answer overrides are
  -- deliberately never read or written.
  with reset_rows as (
    update public.question_reviews review
    set
      is_active = false,
      inactive_reason = 'deleted',
      inactive_at = pg_catalog.now()
    where review.question_id = target_id
      and review.source_version = question_current_version
      and review.is_active = true
    returning review.reviewer_id
  )
  select
    pg_catalog.count(*)::integer,
    pg_catalog.count(distinct reset_rows.reviewer_id)::integer
  into reviews_reset, reviewers_reset
  from reset_rows;

  -- Recompute ONLY question consensus. With the active reviewer count now below
  -- three, recompute_question_review_consensus_v3 removes any published
  -- question_misconception_overrides row and the effective mapping reverts to
  -- the master baseline. It never touches answer consensus or answer overrides.
  question_consensus := public.recompute_question_review_consensus_v3(
    target_id,
    question_current_version
  );

  override_removed := override_existed and not exists (
    select 1
    from public.question_misconception_overrides override_row
    where override_row.question_id = target_id
  );

  return pg_catalog.jsonb_build_object(
    'question_id', target_id,
    'source_version', question_current_version,
    'reviews_reset', reviews_reset,
    'reviewers_reset', reviewers_reset,
    'override_removed', override_removed,
    'question_consensus', question_consensus
  );
end;
$function$;

revoke all on function public.reset_question_reviews_v3(p_question_id text, p_source_version uuid) from public, anon, authenticated, service_role;
grant execute on function public.reset_question_reviews_v3(p_question_id text, p_source_version uuid) to authenticated;

commit;
