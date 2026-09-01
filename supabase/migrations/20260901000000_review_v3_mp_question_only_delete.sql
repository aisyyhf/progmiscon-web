-- Review-v3 forward migration: MP lecturer review is now a one-page Question
-- Review. The separate A/B/C/D Answer Review workflow is retired from the active
-- product; legacy answer_reviews rows and answer_misconception_overrides stay
-- stored and dormant for audit / backward compatibility.
--
-- Context. PR #57
-- (20260831130000_review_v3_workflow_reset_and_lifecycle_reads.sql) introduced
-- delete_question_review_workflow_v3(p_question_id, p_source_version). Under the
-- old contract, deleting an MP Question Review also had to reset the same
-- lecturer's A/B/C/D Answer Reviews, so the RPC deactivates the caller's active
-- Answer Reviews for the question and then calls
-- recompute_answer_review_consensus_v3 per affected answer.
--
-- That coupling is now dangerous. recompute_answer_review_consensus_v3 deletes
-- the answer_misconception_overrides row whenever the answer's active review
-- count drops below three. So, with three active legacy Answer Reviews and a
-- published answer override, a lecturer deleting their Question Review would
-- drop one Answer Review, fall to two, and permanently delete the answer
-- override -- the effective option -> misconception mapping silently reverts to
-- master baseline and can never be rebuilt through the product (no new Answer
-- Review is ever created, and the manual publish_answer_misconception_override
-- RPC is revoked).
--
-- This migration redefines delete_question_review_workflow_v3 to touch ONLY the
-- Question Review:
--
--   * validates caller / lecturer-active / question / source_version exactly as
--     before (same errors: AUTH_REQUIRED, LECTURER_INACTIVE, QUESTION_NOT_FOUND,
--     DATA_VERSION_CHANGED), and keeps the sync_master_relation_baselines_v2
--     advisory lock;
--   * deactivates the caller's active current-version question_reviews row
--     (inactive_reason = 'deleted'), idempotent -- an already-deleted / absent
--     row is not an error;
--   * recomputes ONLY question consensus via
--     recompute_question_review_consensus_v3 (which touches only
--     question_misconception_overrides);
--   * NEVER reads or writes answer_reviews, NEVER calls
--     recompute_answer_review_consensus_v3, NEVER deletes or mutates
--     answer_misconception_overrides;
--   * keeps the same signature, SECURITY DEFINER, search_path and grants, and
--     returns the same JSON shape (deactivated_answer_reviews and
--     answer_consensus are always empty arrays now).
--
-- Under the new question-only contract it is deliberately valid for a lecturer
-- to have an inactive Question Review while a frozen legacy Answer Review for
-- the same question stays is_active = true. That is preserved, not corruption:
-- freezing legacy answer state is exactly how existing answer consensus /
-- overrides are protected. The one-time historical reconciliation that already
-- ran in 20260831130000 is NOT re-run and NOT rewritten.
--
-- Nothing else changes: no table / column / constraint / index / trigger /
-- policy is touched; consensus thresholds, RLS/Auth, source_version guards,
-- save_question_review_v3, save_answer_review_v3 and the publish-answer path are
-- all untouched. The Review-v3 epoch guard contract is unaffected.

begin;

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

  -- Serialise against sync_master_relation_baselines_v2 so the question baseline
  -- version cannot change between the snapshot and the write.
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

  -- Question Review only: deactivate the caller's active current-version row if
  -- it exists. Idempotent -- an already-deleted or absent row is not an error.
  -- Legacy Answer Reviews and answer_misconception_overrides are deliberately
  -- left untouched.
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

  question_consensus := public.recompute_question_review_consensus_v3(
    target_id,
    question_current_version
  );

  return pg_catalog.jsonb_build_object(
    'question_id', target_id,
    'source_version', question_current_version,
    'question_review_id', question_review_id,
    'question_review_reset', question_review_reset,
    'deactivated_answer_reviews', pg_catalog.jsonb_build_array(),
    'question_consensus', question_consensus,
    'answer_consensus', pg_catalog.jsonb_build_array()
  );
end;
$function$;

revoke all on function public.delete_question_review_workflow_v3(p_question_id text, p_source_version uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_question_review_workflow_v3(p_question_id text, p_source_version uuid) to authenticated, service_role;

commit;
