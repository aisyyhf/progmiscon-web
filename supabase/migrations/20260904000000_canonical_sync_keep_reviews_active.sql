-- Review-v3 forward migration: canonical content updates no longer reset reviews.
--
-- Context. public.sync_master_relation_baselines_v2 is the single write the
-- operator canonical Master Data sync makes. Until now, when a question's or an
-- answer's canonical content changed (its source_fingerprint moved) or its
-- direct misconception_ids changed, the function treated that as a review
-- lifecycle event:
--
--     canonical content changes
--       -> source_fingerprint changes
--       -> source_version rotates to a fresh uuid
--       -> every active lecturer review at the old version is set
--          is_active = false, inactive_reason = 'source_updated'
--       -> the review-consensus override row is deleted
--
-- The product no longer wants that. An ordinary content or wording change to a
-- question (or answer) must not disturb the reviews attached to it. Resetting
-- Question Reviews is a separate, deliberate admin action
-- (public.reset_question_reviews_v3, added in
-- 20260903000000_review_v3_targeted_question_review_reset.sql), and that action
-- is unchanged by this migration.
--
-- This migration redefines sync_master_relation_baselines_v2 so that, for an
-- EXISTING target whose parent is unchanged:
--
--   * source_fingerprint and (direct) misconception_ids are refreshed on the
--     baseline row, and synced_at / synced_by are updated, exactly as before;
--   * source_version is NOT rotated - it stays byte-stable;
--   * NO question_reviews / answer_reviews row is touched (no 'source_updated'
--     write, so review_audit_log gets no lifecycle event either);
--   * NO question_misconception_overrides / answer_misconception_overrides row
--     is deleted.
--
-- Behaviour that is deliberately UNCHANGED:
--
--   * a brand-new target is still inserted with a fresh source_version;
--   * a target that has DISAPPEARED from the canonical snapshot still has its
--     active reviews deactivated ('source_updated'), its override deleted and
--     its baseline row removed - its subject no longer exists;
--   * an answer whose parent question_id changes (re-parenting) still rotates
--     source_version, deactivates its active Answer Reviews ('source_updated')
--     and drops its override - re-parenting changes what an Answer Review is
--     about. Re-parenting semantics are preserved exactly, not redesigned.
--
-- source_version itself is retained everywhere. It is still the
-- concurrency / version guard every Review-v3 write checks
-- (DATA_VERSION_CHANGED), still the key half of
-- (reviewer_id, target_id, source_version), and still what
-- reset_question_reviews_v3 validates FOR UPDATE. Existing historical
-- inactive_reason = 'source_updated' rows and the check constraint that allows
-- that value stay valid.
--
-- The RETURN shape is unchanged. question_versions_changed /
-- answer_versions_changed now count only genuine source_version lifecycle
-- events (new target, removed target, answer re-parent); ordinary content /
-- misconception drift no longer increments them, because it no longer changes a
-- version.
--
-- This is a function-only CREATE OR REPLACE. No table, column, constraint,
-- index, trigger or policy is created or altered. The signature, owner,
-- SECURITY DEFINER attribute, volatility, search_path and the service_role-only
-- EXECUTE grant are all preserved, so the Review-v3 epoch guard
-- (20260823000000) contract is unaffected. Already-applied migrations are not
-- modified; this is a new forward migration.

begin;

CREATE OR REPLACE FUNCTION public.sync_master_relation_baselines_v2(input_question_baselines jsonb, input_answer_baselines jsonb, input_misconception_ids text[])
 RETURNS TABLE(question_count integer, answer_count integer, misconception_count integer, question_versions_changed integer, answer_versions_changed integer, synced_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sync_time timestamptz := pg_catalog.now();

  valid_misconception_ids text[] :=
    public.normalize_text_id_array(input_misconception_ids);

  item jsonb;

  target_question_id text;
  target_answer_id text;
  target_parent_question_id text;
  incoming_fingerprint text;
  incoming_ids text[];

  previous_version uuid;
  next_version uuid;
  previous_fingerprint text;
  previous_ids text[];
  previous_question_id text;

  -- source_version lifecycle events only: a brand-new target, a target that has
  -- disappeared from the canonical snapshot, or an answer re-parented to a
  -- different question. Ordinary canonical content / misconception drift for an
  -- existing target does NOT rotate source_version and is NOT counted here.
  changed_questions integer := 0;
  changed_answers integer := 0;

  removed_question record;
  removed_answer record;
begin
  -- Hanya backend/Edge Function terpercaya yang boleh menjalankan sync.
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using
      message = 'SERVICE_ROLE_REQUIRED',
      errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(input_question_baselines) is distinct from 'array'
    or pg_catalog.jsonb_typeof(input_answer_baselines) is distinct from 'array'
  then
    raise exception using
      message = 'INVALID_BASELINE_INPUT',
      errcode = '22023';
  end if;

  -- =======================================================
  -- Validasi question snapshot
  -- =======================================================

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_question_baselines) q(value)
    where pg_catalog.jsonb_typeof(q.value) is distinct from 'object'
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(q.value ->> 'question_id', ''))
       ) = 0
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(q.value ->> 'source_fingerprint', ''))
       ) = 0
       or pg_catalog.jsonb_typeof(
         q.value -> 'misconception_ids'
       ) is distinct from 'array'
  ) then
    raise exception using
      message = 'INVALID_QUESTION_BASELINE_INPUT',
      errcode = '22023';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(input_question_baselines)
  ) <> (
    select pg_catalog.count(
      distinct pg_catalog.btrim(q.value ->> 'question_id')
    )
    from pg_catalog.jsonb_array_elements(input_question_baselines) q(value)
  ) then
    raise exception using
      message = 'DUPLICATE_QUESTION_ID',
      errcode = '22023';
  end if;

  -- =======================================================
  -- Validasi answer snapshot
  -- =======================================================

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_answer_baselines) a(value)
    where pg_catalog.jsonb_typeof(a.value) is distinct from 'object'
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(a.value ->> 'answer_id', ''))
       ) = 0
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(a.value ->> 'question_id', ''))
       ) = 0
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(a.value ->> 'source_fingerprint', ''))
       ) = 0
       or pg_catalog.jsonb_typeof(
         a.value -> 'misconception_ids'
       ) is distinct from 'array'
  ) then
    raise exception using
      message = 'INVALID_ANSWER_BASELINE_INPUT',
      errcode = '22023';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(input_answer_baselines)
  ) <> (
    select pg_catalog.count(
      distinct pg_catalog.btrim(a.value ->> 'answer_id')
    )
    from pg_catalog.jsonb_array_elements(input_answer_baselines) a(value)
  ) then
    raise exception using
      message = 'DUPLICATE_ANSWER_ID',
      errcode = '22023';
  end if;

  -- Jawaban harus mengarah ke soal yang ada di snapshot yang sama.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_answer_baselines) a(value)
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(input_question_baselines) q(value)
      where pg_catalog.btrim(q.value ->> 'question_id')
        = pg_catalog.btrim(a.value ->> 'question_id')
    )
  ) then
    raise exception using
      message = 'ANSWER_QUESTION_MISMATCH',
      errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  -- =======================================================
  -- Target jawaban yang hilang dari master terbaru
  -- =======================================================

  for removed_answer in
    select
      baseline.answer_id,
      baseline.source_version
    from public.answer_misconception_baselines baseline
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(input_answer_baselines) a(value)
      where pg_catalog.btrim(a.value ->> 'answer_id')
        = baseline.answer_id
    )
  loop
    update public.answer_reviews
    set
      is_active = false,
      inactive_reason = 'source_updated',
      inactive_at = sync_time
    where answer_id = removed_answer.answer_id
      and is_active = true;

    delete from public.answer_misconception_overrides
    where answer_id = removed_answer.answer_id;

    delete from public.answer_misconception_baselines
    where answer_id = removed_answer.answer_id;

    changed_answers := changed_answers + 1;
  end loop;

  -- =======================================================
  -- Target soal yang hilang dari master terbaru
  -- =======================================================

  for removed_question in
    select
      baseline.question_id,
      baseline.source_version
    from public.question_misconception_baselines baseline
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(input_question_baselines) q(value)
      where pg_catalog.btrim(q.value ->> 'question_id')
        = baseline.question_id
    )
  loop
    update public.question_reviews
    set
      is_active = false,
      inactive_reason = 'source_updated',
      inactive_at = sync_time
    where question_id = removed_question.question_id
      and is_active = true;

    delete from public.question_misconception_overrides
    where question_id = removed_question.question_id;

    delete from public.question_misconception_baselines
    where question_id = removed_question.question_id;

    changed_questions := changed_questions + 1;
  end loop;

  -- =======================================================
  -- Upsert question baseline + version
  -- =======================================================

  for item in
    select value
    from pg_catalog.jsonb_array_elements(input_question_baselines)
  loop
    target_question_id :=
      pg_catalog.btrim(item ->> 'question_id');

    incoming_fingerprint :=
      pg_catalog.btrim(item ->> 'source_fingerprint');

    incoming_ids :=
      public.normalize_text_id_array(
        array(
          select relation.value #>> '{}'
          from pg_catalog.jsonb_array_elements(
            item -> 'misconception_ids'
          ) relation(value)
        )
      );

    if exists (
      select 1
      from pg_catalog.unnest(incoming_ids) relation(id)
      where pg_catalog.length(pg_catalog.btrim(relation.id)) = 0
         or not (relation.id = any(valid_misconception_ids))
    ) then
      raise exception using
        message = 'INVALID_MISCONCEPTION_ID',
        errcode = '22023';
    end if;

    previous_version := null;
    previous_fingerprint := null;
    previous_ids := null;

    select
      baseline.source_version,
      baseline.source_fingerprint,
      baseline.misconception_ids
    into
      previous_version,
      previous_fingerprint,
      previous_ids
    from public.question_misconception_baselines baseline
    where baseline.question_id = target_question_id;

    if not found then
      next_version := gen_random_uuid();

      insert into public.question_misconception_baselines (
        question_id,
        misconception_ids,
        synced_by,
        synced_at,
        source_version,
        source_fingerprint
      )
      values (
        target_question_id,
        incoming_ids,
        null,
        sync_time,
        next_version,
        incoming_fingerprint
      );

      changed_questions := changed_questions + 1;

    elsif previous_fingerprint is distinct from incoming_fingerprint
       or previous_ids is distinct from incoming_ids
    then
      -- Ordinary canonical content / misconception drift for an existing
      -- question. The effective content and fingerprint are refreshed, but this
      -- is NOT a review lifecycle event: source_version stays stable, active
      -- Question Reviews stay active, and any review-consensus override is left
      -- in place. Question Reviews are reset only by the explicit admin
      -- reset_question_reviews_v3 action.
      update public.question_misconception_baselines
      set
        misconception_ids = incoming_ids,
        synced_by = null,
        synced_at = sync_time,
        source_fingerprint = incoming_fingerprint
      where question_id = target_question_id;

    else
      -- Tidak berubah: version tetap.
      update public.question_misconception_baselines
      set
        synced_by = null,
        synced_at = sync_time
      where question_id = target_question_id;
    end if;
  end loop;

  -- =======================================================
  -- Upsert answer baseline + version
  -- =======================================================

  for item in
    select value
    from pg_catalog.jsonb_array_elements(input_answer_baselines)
  loop
    target_answer_id :=
      pg_catalog.btrim(item ->> 'answer_id');

    target_parent_question_id :=
      pg_catalog.btrim(item ->> 'question_id');

    incoming_fingerprint :=
      pg_catalog.btrim(item ->> 'source_fingerprint');

    incoming_ids :=
      public.normalize_text_id_array(
        array(
          select relation.value #>> '{}'
          from pg_catalog.jsonb_array_elements(
            item -> 'misconception_ids'
          ) relation(value)
        )
      );

    if exists (
      select 1
      from pg_catalog.unnest(incoming_ids) relation(id)
      where pg_catalog.length(pg_catalog.btrim(relation.id)) = 0
         or not (relation.id = any(valid_misconception_ids))
    ) then
      raise exception using
        message = 'INVALID_MISCONCEPTION_ID',
        errcode = '22023';
    end if;

    previous_version := null;
    previous_fingerprint := null;
    previous_ids := null;
    previous_question_id := null;

    select
      baseline.source_version,
      baseline.source_fingerprint,
      baseline.misconception_ids,
      baseline.question_id
    into
      previous_version,
      previous_fingerprint,
      previous_ids,
      previous_question_id
    from public.answer_misconception_baselines baseline
    where baseline.answer_id = target_answer_id;

    if not found then
      next_version := gen_random_uuid();

      insert into public.answer_misconception_baselines (
        answer_id,
        question_id,
        misconception_ids,
        synced_by,
        synced_at,
        source_version,
        source_fingerprint
      )
      values (
        target_answer_id,
        target_parent_question_id,
        incoming_ids,
        null,
        sync_time,
        next_version,
        incoming_fingerprint
      );

      changed_answers := changed_answers + 1;

    elsif previous_question_id is distinct from target_parent_question_id then
      -- The answer moved to a different parent question. Re-parenting changes
      -- what an Answer Review is about, so the previous lifecycle is preserved
      -- exactly: rotate source_version, deactivate active Answer Reviews as
      -- 'source_updated', and drop the review-consensus override.
      next_version := gen_random_uuid();

      update public.answer_reviews
      set
        is_active = false,
        inactive_reason = 'source_updated',
        inactive_at = sync_time
      where answer_id = target_answer_id
        and is_active = true;

      delete from public.answer_misconception_overrides
      where answer_id = target_answer_id;

      update public.answer_misconception_baselines
      set
        question_id = target_parent_question_id,
        misconception_ids = incoming_ids,
        synced_by = null,
        synced_at = sync_time,
        source_version = next_version,
        source_fingerprint = incoming_fingerprint
      where answer_id = target_answer_id;

      changed_answers := changed_answers + 1;

    elsif previous_fingerprint is distinct from incoming_fingerprint
       or previous_ids is distinct from incoming_ids
    then
      -- Ordinary canonical content / misconception drift for an existing answer
      -- whose parent question is unchanged. Not a review lifecycle event:
      -- source_version stays stable, active Answer Reviews stay active, and any
      -- review-consensus override is left in place.
      update public.answer_misconception_baselines
      set
        misconception_ids = incoming_ids,
        synced_by = null,
        synced_at = sync_time,
        source_fingerprint = incoming_fingerprint
      where answer_id = target_answer_id;

    else
      update public.answer_misconception_baselines
      set
        synced_by = null,
        synced_at = sync_time
      where answer_id = target_answer_id;
    end if;
  end loop;

  -- =======================================================
  -- Refresh misconception catalog
  -- =======================================================

  delete from public.master_misconception_catalog where misconception_id is not null;

  insert into public.master_misconception_catalog (
    misconception_id,
    synced_by,
    synced_at
  )
  select
    misconception_id,
    null,
    sync_time
  from pg_catalog.unnest(valid_misconception_ids)
    misconception(misconception_id);

  return query
  select
    (
      select pg_catalog.count(*)::integer
      from public.question_misconception_baselines
    ),
    (
      select pg_catalog.count(*)::integer
      from public.answer_misconception_baselines
    ),
    (
      select pg_catalog.count(*)::integer
      from public.master_misconception_catalog
    ),
    changed_questions,
    changed_answers,
    sync_time;
end;
$function$;

-- Preserve the exact production exposure: service_role only. CREATE OR REPLACE
-- keeps existing grants, but restate them so this migration is self-contained
-- and matches the Review-v3 epoch guard's asserted end state.
revoke all on function public.sync_master_relation_baselines_v2(input_question_baselines jsonb, input_answer_baselines jsonb, input_misconception_ids text[]) from public, anon, authenticated, service_role;
grant execute on function public.sync_master_relation_baselines_v2(input_question_baselines jsonb, input_answer_baselines jsonb, input_misconception_ids text[]) to service_role;

commit;
