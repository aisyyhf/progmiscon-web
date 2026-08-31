begin;

set local session_replication_role = replica;
insert into auth.users
  (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000011', 'behavior1@example.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000012', 'behavior2@example.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000013', 'behavior3@example.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000014', 'behavior4@example.invalid', '{}', '{}', now(), now());
insert into public.lecturer_profiles
  (user_id, email, full_name, active, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000011', 'behavior1@example.invalid', 'Behavior Reviewer One', true, now(), now()),
  ('00000000-0000-4000-8000-000000000012', 'behavior2@example.invalid', 'Behavior Reviewer Two', true, now(), now()),
  ('00000000-0000-4000-8000-000000000013', 'behavior3@example.invalid', 'Behavior Reviewer Three', true, now(), now()),
  ('00000000-0000-4000-8000-000000000014', 'behavior4@example.invalid', 'Behavior Reviewer Four', true, now(), now());
set local session_replication_role = origin;

insert into public.master_misconception_catalog
  (misconception_id, synced_by, synced_at)
values
  ('M-BEH-001', null, now()),
  ('M-BEH-002', null, now());
insert into public.question_misconception_baselines
  (question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values
  ('Q-BEH-001', array['M-BEH-001'], null, now(),
   '40000000-0000-4000-8000-000000000001', null);
insert into public.answer_misconception_baselines
  (answer_id, question_id, misconception_ids, synced_by, synced_at,
   source_version, source_fingerprint)
values
  ('A-BEH-001', 'Q-BEH-001', array['M-BEH-001'], null, now(),
   '40000000-0000-4000-8000-000000000002', null);

select set_config('request.jwt.claim.role', 'authenticated', false);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', false);
set role authenticated;
select public.save_question_review_v3(
  'Q-BEH-001', '40000000-0000-4000-8000-000000000001',
  false, '{}', null, false, '{}', null, 'question-created'
);
select public.save_question_review_v3(
  'Q-BEH-001', '40000000-0000-4000-8000-000000000001',
  false, '{}', null, false, '{}', null, 'question-edited'
);
select public.save_answer_review_v3(
  'A-BEH-001', '40000000-0000-4000-8000-000000000002',
  false, '{}', null, false, '{}', null, 'answer-created'
);
select public.save_answer_review_v3(
  'A-BEH-001', '40000000-0000-4000-8000-000000000002',
  false, '{}', null, false, '{}', null, 'answer-edited'
);
reset role;

do $version_change$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', false);
  begin
    perform public.save_question_review_v3(
      'Q-BEH-001', '40000000-0000-4000-8000-000000000099',
      false, '{}', null, false, '{}', null, null
    );
    raise exception 'EXPECTED_DATA_VERSION_CHANGED';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'DATA_VERSION_CHANGED' then raise; end if;
  end;
  begin
    perform public.save_answer_review_v3(
      'A-BEH-001', '40000000-0000-4000-8000-000000000099',
      false, '{}', null, false, '{}', null, null
    );
    raise exception 'EXPECTED_ANSWER_DATA_VERSION_CHANGED';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'DATA_VERSION_CHANGED' then raise; end if;
  end;
end;
$version_change$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', false);
set role authenticated;
select public.save_question_review_v3(
  'Q-BEH-001', '40000000-0000-4000-8000-000000000001',
  false, '{}', null, false, '{}', null, 'question-two'
);
select public.save_answer_review_v3(
  'A-BEH-001', '40000000-0000-4000-8000-000000000002',
  false, '{}', null, false, '{}', null, 'answer-two'
);
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000013', false);
set role authenticated;
select public.save_question_review_v3(
  'Q-BEH-001', '40000000-0000-4000-8000-000000000001',
  false, '{}', null, false, '{}', null, 'question-three'
);
select public.save_answer_review_v3(
  'A-BEH-001', '40000000-0000-4000-8000-000000000002',
  false, '{}', null, false, '{}', null, 'answer-three'
);
reset role;

do $cap$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000014', false);
  begin
    perform public.save_question_review_v3(
      'Q-BEH-001', '40000000-0000-4000-8000-000000000001',
      false, '{}', null, false, '{}', null, 'question-four'
    );
    raise exception 'EXPECTED_REVIEWER_CAP_REACHED';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'REVIEWER_CAP_REACHED' then raise; end if;
  end;
  begin
    perform public.save_answer_review_v3(
      'A-BEH-001', '40000000-0000-4000-8000-000000000002',
      false, '{}', null, false, '{}', null, 'answer-four'
    );
    raise exception 'EXPECTED_ANSWER_REVIEWER_CAP_REACHED';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'REVIEWER_CAP_REACHED' then raise; end if;
  end;
end;
$cap$;

do $consensus$
begin
  if (select count(*) from public.question_reviews
      where question_id = 'Q-BEH-001'
        and source_version = '40000000-0000-4000-8000-000000000001'
        and is_active) <> 3
    or not exists (
      select 1 from public.question_misconception_overrides
      where question_id = 'Q-BEH-001'
        and source_version = '40000000-0000-4000-8000-000000000001'
        and source_review_count = 3
    )
    or (select count(*) from public.answer_reviews
      where answer_id = 'A-BEH-001'
        and source_version = '40000000-0000-4000-8000-000000000002'
        and is_active) <> 3
    or not exists (
      select 1 from public.answer_misconception_overrides
      where answer_id = 'A-BEH-001'
        and source_version = '40000000-0000-4000-8000-000000000002'
        and source_review_count = 3
    )
  then
    raise exception 'CURRENT_VERSION_CONSENSUS_FAILED';
  end if;
end;
$consensus$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', false);
set role authenticated;
select public.delete_question_review_v3(
  'Q-BEH-001', '40000000-0000-4000-8000-000000000001'
);
select public.save_question_review_v3(
  'Q-BEH-001', '40000000-0000-4000-8000-000000000001',
  false, '{}', null, false, '{}', null, 'question-reactivated'
);
select public.delete_answer_review_v3(
  'A-BEH-001', '40000000-0000-4000-8000-000000000002'
);
select public.save_answer_review_v3(
  'A-BEH-001', '40000000-0000-4000-8000-000000000002',
  false, '{}', null, false, '{}', null, 'answer-reactivated'
);
reset role;

update public.question_reviews
set is_active = false, inactive_reason = 'source_updated', inactive_at = now()
where reviewer_id = '00000000-0000-4000-8000-000000000011'
  and question_id = 'Q-BEH-001'
  and source_version = '40000000-0000-4000-8000-000000000001';

update public.answer_reviews
set is_active = false, inactive_reason = 'source_updated', inactive_at = now()
where reviewer_id = '00000000-0000-4000-8000-000000000011'
  and answer_id = 'A-BEH-001'
  and source_version = '40000000-0000-4000-8000-000000000002';

do $source_updated$
begin
  perform set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', false);
  begin
    perform public.save_question_review_v3(
      'Q-BEH-001', '40000000-0000-4000-8000-000000000001',
      false, '{}', null, false, '{}', null, 'must-not-reactivate'
    );
    raise exception 'EXPECTED_SOURCE_UPDATED_REJECTION';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'DATA_VERSION_CHANGED' then raise; end if;
  end;
  begin
    perform public.save_answer_review_v3(
      'A-BEH-001', '40000000-0000-4000-8000-000000000002',
      false, '{}', null, false, '{}', null, 'must-not-reactivate'
    );
    raise exception 'EXPECTED_ANSWER_SOURCE_UPDATED_REJECTION';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'DATA_VERSION_CHANGED' then raise; end if;
  end;
end;
$source_updated$;

insert into public.question_reviews
  (reviewer_id, question_id, has_incorrect_misconceptions,
   has_additional_misconceptions, note, source_version, is_active)
values
  ('00000000-0000-4000-8000-000000000014', 'Q-BEH-001',
   false, false, 'old-version-active',
   '40000000-0000-4000-8000-000000000010', true);

insert into public.answer_reviews
  (reviewer_id, answer_id, question_id, has_mismatched_misconceptions,
   has_additional_misconceptions, note, source_version, is_active)
values
  ('00000000-0000-4000-8000-000000000014', 'A-BEH-001', 'Q-BEH-001',
   false, false, 'old-version-active',
   '40000000-0000-4000-8000-000000000020', true);

select public.recompute_question_review_consensus_v3(
  'Q-BEH-001', '40000000-0000-4000-8000-000000000001'
);
select public.recompute_answer_review_consensus_v3(
  'A-BEH-001', '40000000-0000-4000-8000-000000000002'
);

do $final_assertions$
begin
  if exists (
    select 1 from public.question_misconception_overrides
    where question_id = 'Q-BEH-001'
  ) or exists (
    select 1 from public.answer_misconception_overrides
    where answer_id = 'A-BEH-001'
  ) then
    raise exception 'CONSENSUS_INCLUDED_INACTIVE_OR_OLD_VERSION';
  end if;

  if not exists (
    select 1 from public.question_reviews
    where reviewer_id = '00000000-0000-4000-8000-000000000011'
      and question_id = 'Q-BEH-001'
      and is_active = false
      and inactive_reason = 'source_updated'
      and inactive_at is not null
  ) or not exists (
    select 1 from public.answer_reviews
    where reviewer_id = '00000000-0000-4000-8000-000000000011'
      and answer_id = 'A-BEH-001'
      and is_active = false
      and inactive_reason = 'source_updated'
      and inactive_at is not null
  ) then
    raise exception 'SOURCE_UPDATED_LIFECYCLE_FAILED';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger trigger_object
    join pg_catalog.pg_class relation on relation.oid = trigger_object.tgrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('question_reviews', 'answer_reviews')
      and not trigger_object.tgisinternal
      and trigger_object.tgname in (
        'question_reviews_enforce_cap',
        'answer_reviews_enforce_cap',
        'question_reviews_prevent_repeat_lecturer_update',
        'answer_reviews_prevent_repeat_lecturer_update'
      )
  ) then
    raise exception 'LEGACY_TRIGGER_INTERFERED';
  end if;

  if not coalesce((
    select array_agg(distinct event_type order by event_type)
      @> array['created', 'deleted', 'edited', 'reactivated', 'source_updated']
    from public.review_audit_log
    where review_type = 'question'
      and target_id = 'Q-BEH-001'
  ), false) then
    raise exception 'AUDIT_EVENT_BEHAVIOR_FAILED';
  end if;

  if not coalesce((
    select array_agg(distinct event_type order by event_type)
      @> array['created', 'deleted', 'edited', 'reactivated', 'source_updated']
    from public.review_audit_log
    where review_type = 'answer'
      and target_id = 'A-BEH-001'
  ), false) then
    raise exception 'ANSWER_AUDIT_EVENT_BEHAVIOR_FAILED';
  end if;
end;
$final_assertions$;

-- ===========================================================================
-- Effective question misconception set (direct UNION answer-derived).
-- save_question_review_v3 must accept a removal / reject an addition for any
-- misconception in the effective set the Review Soal UI exposes, not only the
-- direct question baseline.
-- ===========================================================================
insert into public.master_misconception_catalog
  (misconception_id, synced_by, synced_at)
values
  ('M-EFF-DIRECT', null, now()),
  ('M-EFF-ANSWER', null, now()),
  ('M-EFF-MULTI', null, now());

insert into public.question_misconception_baselines
  (question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values
  ('Q-EFF-001', array['M-EFF-DIRECT'], null, now(),
   '41000000-0000-4000-8000-000000000001', null),
  ('Q-EFF-002', array['M-EFF-DIRECT'], null, now(),
   '41000000-0000-4000-8000-000000000004', null);

-- Q-EFF-001 derives M-EFF-ANSWER from two answer options (CASE E: the effective
-- set must stay unique and deterministic) plus M-EFF-MULTI from one of them.
insert into public.answer_misconception_baselines
  (answer_id, question_id, misconception_ids, synced_by, synced_at,
   source_version, source_fingerprint)
values
  ('A-EFF-001', 'Q-EFF-001', array['M-EFF-ANSWER'], null, now(),
   '41000000-0000-4000-8000-000000000002', null),
  ('A-EFF-002', 'Q-EFF-001', array['M-EFF-ANSWER', 'M-EFF-MULTI'], null, now(),
   '41000000-0000-4000-8000-000000000003', null);

do $effective_set$
declare
  removed_now text[];
begin
  perform set_config('request.jwt.claim.role', 'authenticated', false);
  perform set_config('request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000012', false);

  -- CASE A: remove an answer-derived misconception -> allowed, stored verbatim.
  perform public.save_question_review_v3(
    'Q-EFF-001', '41000000-0000-4000-8000-000000000001',
    true, array['M-EFF-ANSWER'], 'answer-derived removal proposal',
    false, '{}', null, null
  );
  select removed_misconception_ids into removed_now
  from public.question_reviews
  where reviewer_id = '00000000-0000-4000-8000-000000000012'
    and question_id = 'Q-EFF-001'
    and source_version = '41000000-0000-4000-8000-000000000001';
  if removed_now is distinct from array['M-EFF-ANSWER'] then
    raise exception 'CASE_A_ANSWER_DERIVED_REMOVAL_NOT_STORED: %', removed_now;
  end if;

  -- CASE B: remove a direct misconception -> still allowed.
  perform public.save_question_review_v3(
    'Q-EFF-001', '41000000-0000-4000-8000-000000000001',
    true, array['M-EFF-DIRECT'], 'direct removal proposal',
    false, '{}', null, null
  );

  -- CASE E/F: remove several effective ids at once (direct + answer-derived,
  -- the answer-derived id resolved from two answers) -> allowed and unique.
  perform public.save_question_review_v3(
    'Q-EFF-001', '41000000-0000-4000-8000-000000000001',
    true, array['M-EFF-ANSWER', 'M-EFF-MULTI'], 'multi removal proposal',
    false, '{}', null, null
  );

  -- CASE C: a misconception in neither the direct nor any answer-derived
  -- relation is still rejected.
  begin
    perform public.save_question_review_v3(
      'Q-EFF-001', '41000000-0000-4000-8000-000000000001',
      true, array['M-EFF-UNKNOWN'], 'should be rejected',
      false, '{}', null, null
    );
    raise exception 'CASE_C_EXPECTED_REMOVAL_NOT_IN_BASELINE';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'REMOVAL_NOT_IN_BASELINE' then raise; end if;
  end;

  -- CASE D: proposing to ADD a misconception that already belongs to the
  -- effective set through an answer relation is rejected.
  begin
    perform public.save_question_review_v3(
      'Q-EFF-001', '41000000-0000-4000-8000-000000000001',
      false, '{}', null,
      true, array['M-EFF-ANSWER'], 'already effective via answer', null
    );
    raise exception 'CASE_D_EXPECTED_ADDITION_ALREADY_IN_BASELINE';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'ADDITION_ALREADY_IN_BASELINE' then raise; end if;
  end;

  -- CASE G: a question with no answer-derived misconceptions keeps the
  -- direct-only behaviour -- direct removal allowed, answer-derived id rejected.
  perform public.save_question_review_v3(
    'Q-EFF-002', '41000000-0000-4000-8000-000000000004',
    true, array['M-EFF-DIRECT'], 'direct only question',
    false, '{}', null, null
  );
  begin
    perform public.save_question_review_v3(
      'Q-EFF-002', '41000000-0000-4000-8000-000000000004',
      true, array['M-EFF-ANSWER'], 'no answer relation here',
      false, '{}', null, null
    );
    raise exception 'CASE_G_EXPECTED_REMOVAL_NOT_IN_BASELINE';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'REMOVAL_NOT_IN_BASELINE' then raise; end if;
  end;

  -- Answer-derived removal votes must not leak into the question consensus
  -- snapshot: with a single reviewer no override row is created.
  if exists (
    select 1 from public.question_misconception_overrides
    where question_id in ('Q-EFF-001', 'Q-EFF-002')
  ) then
    raise exception 'EFFECTIVE_SET_REMOVAL_LEAKED_INTO_CONSENSUS';
  end if;
end;
$effective_set$;

-- ===========================================================================
-- Whole-question review workflow reset (delete_question_review_workflow_v3).
-- Deleting a lecturer's Question Review must also deactivate that lecturer's
-- current active Answer Reviews for the same question -- each matched against
-- the answer's OWN source_version -- atomically and idempotently, while
-- leaving other reviewers and 'source_updated' rows untouched.
-- ===========================================================================
insert into public.master_misconception_catalog (misconception_id, synced_by, synced_at)
values ('M-WFR-001', null, now());

insert into public.question_misconception_baselines
  (question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values
  ('Q-WFR-001', array['M-WFR-001'], null, now(),
   '42000000-0000-4000-8000-000000000001', null);

-- Two answers with DISTINCT source versions from the question and each other.
insert into public.answer_misconception_baselines
  (answer_id, question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values
  ('A-WFR-A', 'Q-WFR-001', array['M-WFR-001'], null, now(),
   '42000000-0000-4000-8000-0000000000a1', null),
  ('A-WFR-B', 'Q-WFR-001', array['M-WFR-001'], null, now(),
   '42000000-0000-4000-8000-0000000000b1', null);

select set_config('request.jwt.claim.role', 'authenticated', false);

-- Three reviewers complete the whole workflow so consensus publishes an override.
do $wfr_seed$
declare
  reviewer_ids uuid[] := array[
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000013'
  ];
  reviewer_id uuid;
begin
  foreach reviewer_id in array reviewer_ids loop
    perform set_config('request.jwt.claim.sub', reviewer_id::text, false);
    perform public.save_question_review_v3(
      'Q-WFR-001', '42000000-0000-4000-8000-000000000001',
      false, '{}', null, false, '{}', null, 'wfr question'
    );
    perform public.save_answer_review_v3(
      'A-WFR-A', '42000000-0000-4000-8000-0000000000a1',
      false, '{}', null, false, '{}', null, 'wfr answer a'
    );
    perform public.save_answer_review_v3(
      'A-WFR-B', '42000000-0000-4000-8000-0000000000b1',
      false, '{}', null, false, '{}', null, 'wfr answer b'
    );
  end loop;
end;
$wfr_seed$;

do $wfr_reset$
declare
  reviewer_one uuid := '00000000-0000-4000-8000-000000000011';
  reviewer_two uuid := '00000000-0000-4000-8000-000000000012';
  result jsonb;
begin
  if not exists (
    select 1 from public.question_misconception_overrides
    where question_id = 'Q-WFR-001'
      and source_version = '42000000-0000-4000-8000-000000000001'
      and source_review_count = 3
  ) then
    raise exception 'WFR_SEED_CONSENSUS_MISSING';
  end if;

  -- Reviewer two: one answer is invalidated by a source change before the reset.
  update public.answer_reviews
  set is_active = false, inactive_reason = 'source_updated', inactive_at = now()
  where reviewer_id = reviewer_two
    and answer_id = 'A-WFR-B'
    and source_version = '42000000-0000-4000-8000-0000000000b1';

  -- Reviewer one resets their whole workflow for Q-WFR-001.
  perform set_config('request.jwt.claim.sub', reviewer_one::text, false);
  result := public.delete_question_review_workflow_v3(
    'Q-WFR-001', '42000000-0000-4000-8000-000000000001'
  );

  if (result ->> 'question_review_reset') <> 'true'
    or pg_catalog.jsonb_array_length(result -> 'deactivated_answer_reviews') <> 2
  then
    raise exception 'WFR_RESET_RESULT_UNEXPECTED: %', result;
  end if;

  -- Reviewer one: question review + BOTH answer reviews are now deleted.
  if exists (
    select 1 from public.question_reviews
    where reviewer_id = reviewer_one and question_id = 'Q-WFR-001' and is_active
  ) or exists (
    select 1 from public.answer_reviews
    where reviewer_id = reviewer_one and question_id = 'Q-WFR-001' and is_active
  ) or not exists (
    select 1 from public.question_reviews
    where reviewer_id = reviewer_one and question_id = 'Q-WFR-001'
      and is_active = false and inactive_reason = 'deleted'
  ) or (
    select count(*) from public.answer_reviews
    where reviewer_id = reviewer_one and question_id = 'Q-WFR-001'
      and is_active = false and inactive_reason = 'deleted'
  ) <> 2 then
    raise exception 'WFR_RESET_LIFECYCLE_FAILED';
  end if;

  -- Reviewer two: the 'source_updated' answer review must NOT become 'deleted';
  -- their still-current rows are untouched by reviewer one's reset.
  if not exists (
    select 1 from public.answer_reviews
    where reviewer_id = reviewer_two and answer_id = 'A-WFR-B'
      and is_active = false and inactive_reason = 'source_updated'
  ) or not exists (
    select 1 from public.question_reviews
    where reviewer_id = reviewer_two and question_id = 'Q-WFR-001' and is_active
  ) or not exists (
    select 1 from public.answer_reviews
    where reviewer_id = reviewer_two and answer_id = 'A-WFR-A' and is_active
  ) then
    raise exception 'WFR_RESET_TOUCHED_OTHER_REVIEWER';
  end if;

  -- Consensus recomputed: 3 -> 2 active reviewers, override dropped.
  if exists (
    select 1 from public.question_misconception_overrides where question_id = 'Q-WFR-001'
  ) or exists (
    select 1 from public.answer_misconception_overrides where answer_id in ('A-WFR-A', 'A-WFR-B')
  ) then
    raise exception 'WFR_RESET_CONSENSUS_NOT_RECOMPUTED';
  end if;

  -- Idempotent: a second reset by reviewer one is a clean no-op.
  result := public.delete_question_review_workflow_v3(
    'Q-WFR-001', '42000000-0000-4000-8000-000000000001'
  );
  if (result ->> 'question_review_reset') <> 'false'
    or pg_catalog.jsonb_array_length(result -> 'deactivated_answer_reviews') <> 0
  then
    raise exception 'WFR_RESET_NOT_IDEMPOTENT: %', result;
  end if;

  -- Re-review at the same source version reactivates reviewer one's row.
  perform public.save_question_review_v3(
    'Q-WFR-001', '42000000-0000-4000-8000-000000000001',
    false, '{}', null, false, '{}', null, 're-review after reset'
  );
  if not exists (
    select 1 from public.question_reviews
    where reviewer_id = reviewer_one and question_id = 'Q-WFR-001' and is_active
  ) then
    raise exception 'WFR_RE_REVIEW_DID_NOT_REACTIVATE';
  end if;

  -- The audit log retains the full lifecycle trail of the deleted generation
  -- so Admin can reconstruct it even though the row is now active again.
  if not coalesce((
    select array_agg(distinct event_type order by event_type)
      @> array['created', 'deleted', 'reactivated']
    from public.review_audit_log
    where review_type = 'question' and target_id = 'Q-WFR-001'
      and reviewer_id = reviewer_one
  ), false) then
    raise exception 'WFR_AUDIT_TRAIL_INCOMPLETE';
  end if;
end;
$wfr_reset$;

-- Lifecycle-aware current read paths: deleted / source-invalidated rows never
-- inflate the reviewer count. After the reset above Q-WFR-001 keeps exactly the
-- two reviewers who did not reset (reviewer one just re-reviewed -> back to 3
-- for the question, still 2 for A-WFR-A because reviewer one has not re-done it).
do $wfr_counts$
declare
  q_count integer;
  a_count integer;
begin
  perform set_config('request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000012', false);

  select review_count into q_count
  from public.get_question_review_counts() where question_id = 'Q-WFR-001';
  select review_count into a_count
  from public.get_answer_review_counts() where answer_id = 'A-WFR-A';

  if coalesce(q_count, 0) <> 3 then
    raise exception 'WFR_QUESTION_COUNT_WRONG: %', q_count;
  end if;
  if coalesce(a_count, 0) <> 2 then
    raise exception 'WFR_ANSWER_COUNT_WRONG: %', a_count;
  end if;

  -- get_my_review_status for reviewer two excludes their 'source_updated' answer.
  perform set_config('request.jwt.claim.sub',
    '00000000-0000-4000-8000-000000000012', false);
  if exists (
    select 1
    from public.get_my_review_status()
    where 'A-WFR-B' = any(answer_ids)
  ) then
    raise exception 'WFR_MY_STATUS_INCLUDES_INACTIVE';
  end if;
end;
$wfr_counts$;

-- ===========================================================================
-- Generic orphan reconciliation predicate: a pre-fix partial delete leaves a
-- deleted Question Review beside still-active current Answer Reviews for the
-- same reviewer + question. The reconciliation predicate must repair ONLY those
-- rows. (Simulated here as post-migration data, then the predicate is re-run.)
-- ===========================================================================
do $orphan_repair$
declare
  reviewer_three uuid := '00000000-0000-4000-8000-000000000013';
  repaired integer;
begin
  -- Manufacture the historical orphan: delete reviewer three's Q-WFR-001
  -- question review directly (old single-row delete path) while their answer
  -- reviews stay active.
  update public.question_reviews
  set is_active = false, inactive_reason = 'deleted', inactive_at = now()
  where reviewer_id = reviewer_three and question_id = 'Q-WFR-001' and is_active;

  if not exists (
    select 1 from public.answer_reviews
    where reviewer_id = reviewer_three and question_id = 'Q-WFR-001' and is_active
  ) then
    raise exception 'ORPHAN_SETUP_FAILED';
  end if;

  -- Re-run the exact reconciliation predicate from the migration.
  with orphan as (
    select ar.id, amb.answer_id, amb.source_version
    from public.answer_reviews ar
    join public.answer_misconception_baselines amb on amb.answer_id = ar.answer_id
    where ar.is_active = true
      and ar.source_version = amb.source_version
      and exists (
        select 1 from public.question_reviews qr
        where qr.reviewer_id = ar.reviewer_id
          and qr.question_id = ar.question_id
          and qr.is_active = false
          and qr.inactive_reason = 'deleted'
      )
      and not exists (
        select 1 from public.question_reviews qr2
        where qr2.reviewer_id = ar.reviewer_id
          and qr2.question_id = ar.question_id
          and qr2.is_active = true
      )
  )
  update public.answer_reviews ar
  set is_active = false, inactive_reason = 'deleted', inactive_at = now()
  from orphan where orphan.id = ar.id;
  get diagnostics repaired = row_count;

  -- Exactly reviewer three's two still-active current answer reviews, and
  -- nothing else (reviewer one re-reviewed the question; reviewer two never
  -- partially deleted; reviewer two's A-WFR-B is 'source_updated', not current).
  if repaired <> 2 then
    raise exception 'ORPHAN_REPAIR_WRONG_SCOPE: %', repaired;
  end if;

  -- Reviewer two (never partially deleted) keeps their active answer review.
  if not exists (
    select 1 from public.answer_reviews
    where reviewer_id = '00000000-0000-4000-8000-000000000012'
      and answer_id = 'A-WFR-A' and is_active
  ) then
    raise exception 'ORPHAN_REPAIR_OVER_REACHED';
  end if;

  -- Idempotent: the predicate now matches nothing.
  with orphan as (
    select ar.id
    from public.answer_reviews ar
    join public.answer_misconception_baselines amb on amb.answer_id = ar.answer_id
    where ar.is_active = true
      and ar.source_version = amb.source_version
      and exists (
        select 1 from public.question_reviews qr
        where qr.reviewer_id = ar.reviewer_id
          and qr.question_id = ar.question_id
          and qr.is_active = false
          and qr.inactive_reason = 'deleted'
      )
      and not exists (
        select 1 from public.question_reviews qr2
        where qr2.reviewer_id = ar.reviewer_id
          and qr2.question_id = ar.question_id
          and qr2.is_active = true
      )
  )
  select count(*) into repaired from orphan;
  if repaired <> 0 then
    raise exception 'ORPHAN_REPAIR_NOT_IDEMPOTENT: %', repaired;
  end if;
end;
$orphan_repair$;

-- ===========================================================================
-- Negative: orphan reconciliation must NOT touch a reviewer who has already
-- started a fresh, legitimate review generation for that question. An old
-- 'deleted' Question Review row (from a previous generation) beside new active
-- current-version reviews must not be misread as a partial-delete orphan.
-- ===========================================================================
insert into public.master_misconception_catalog (misconception_id, synced_by, synced_at)
values ('M-ORR-001', null, now());

-- Q-ORR-001 and A-ORR-A currently exist at their v2 source versions. The v1
-- versions ('...01' / '...a1') were superseded by a master change and have no
-- baseline rows any more.
insert into public.question_misconception_baselines
  (question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values
  ('Q-ORR-001', array['M-ORR-001'], null, now(),
   '43000000-0000-4000-8000-000000000002', null);

insert into public.answer_misconception_baselines
  (answer_id, question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values
  ('A-ORR-A', 'Q-ORR-001', array['M-ORR-001'], null, now(),
   '43000000-0000-4000-8000-0000000000a2', null);

-- Reviewer four's PRIOR generation: a Question Review that was deleted while it
-- was still at the old question source version. Kept only as history.
insert into public.question_reviews
  (reviewer_id, question_id, has_incorrect_misconceptions,
   has_additional_misconceptions, note, source_version,
   is_active, inactive_reason, inactive_at)
values
  ('00000000-0000-4000-8000-000000000014', 'Q-ORR-001',
   false, false, 'orr prior deleted generation',
   '43000000-0000-4000-8000-000000000001',
   false, 'deleted', now());

do $orphan_re_review_untouched$
declare
  reviewer_four uuid := '00000000-0000-4000-8000-000000000014';
  seed_reviewers uuid[] := array[
    '00000000-0000-4000-8000-000000000014',
    '00000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000012'
  ];
  seed_reviewer uuid;
  repaired integer;
begin
  -- All three review Q-ORR-001 + A-ORR-A at the CURRENT (v2) source versions.
  -- Reviewer four is doing a legitimate fresh review after their prior
  -- generation was deleted.
  foreach seed_reviewer in array seed_reviewers loop
    perform set_config('request.jwt.claim.sub', seed_reviewer::text, false);
    perform public.save_question_review_v3(
      'Q-ORR-001', '43000000-0000-4000-8000-000000000002',
      false, '{}', null, false, '{}', null, 'orr current generation'
    );
    perform public.save_answer_review_v3(
      'A-ORR-A', '43000000-0000-4000-8000-0000000000a2',
      false, '{}', null, false, '{}', null, 'orr current answer'
    );
  end loop;

  -- Three active reviewers -> A-ORR-A consensus override exists.
  if not exists (
    select 1 from public.answer_misconception_overrides
    where answer_id = 'A-ORR-A'
      and source_version = '43000000-0000-4000-8000-0000000000a2'
      and source_review_count = 3
  ) then
    raise exception 'ORR_SEED_CONSENSUS_MISSING';
  end if;

  -- Reviewer four now has BOTH a deleted Question Review (old generation) and an
  -- active Question Review (current generation) for Q-ORR-001.
  if not exists (
    select 1 from public.question_reviews
    where reviewer_id = reviewer_four and question_id = 'Q-ORR-001'
      and is_active = false and inactive_reason = 'deleted'
  ) or not exists (
    select 1 from public.question_reviews
    where reviewer_id = reviewer_four and question_id = 'Q-ORR-001'
      and is_active = true
  ) then
    raise exception 'ORR_SETUP_FAILED';
  end if;

  -- Run the exact tightened reconciliation predicate from the migration.
  with orphan as (
    select ar.id, amb.answer_id, amb.source_version
    from public.answer_reviews ar
    join public.answer_misconception_baselines amb on amb.answer_id = ar.answer_id
    where ar.is_active = true
      and ar.source_version = amb.source_version
      and exists (
        select 1 from public.question_reviews qr
        where qr.reviewer_id = ar.reviewer_id
          and qr.question_id = ar.question_id
          and qr.is_active = false
          and qr.inactive_reason = 'deleted'
      )
      and not exists (
        select 1 from public.question_reviews qr2
        where qr2.reviewer_id = ar.reviewer_id
          and qr2.question_id = ar.question_id
          and qr2.is_active = true
      )
  ),
  affected as (
    update public.answer_reviews ar
    set is_active = false, inactive_reason = 'deleted', inactive_at = now()
    from orphan where orphan.id = ar.id
    returning ar.answer_id, ar.source_version
  )
  select count(*) into repaired from affected;

  -- The predicate must not have matched reviewer four's fresh Answer Review
  -- (they have an active current Question Review for Q-ORR-001).
  if repaired <> 0 then
    raise exception 'ORR_REPAIR_TOUCHED_RE_REVIEW: % row(s)', repaired;
  end if;

  if not exists (
    select 1 from public.answer_reviews
    where reviewer_id = reviewer_four and answer_id = 'A-ORR-A' and is_active = true
  ) then
    raise exception 'ORR_RE_REVIEW_ANSWER_DEACTIVATED';
  end if;

  -- Consensus / override for the current generation is untouched.
  if not exists (
    select 1 from public.answer_misconception_overrides
    where answer_id = 'A-ORR-A'
      and source_version = '43000000-0000-4000-8000-0000000000a2'
      and source_review_count = 3
  ) then
    raise exception 'ORR_CONSENSUS_INCORRECTLY_REMOVED';
  end if;

  -- The prior deleted generation stays exactly as it was (history only).
  if not exists (
    select 1 from public.question_reviews
    where reviewer_id = reviewer_four and question_id = 'Q-ORR-001'
      and source_version = '43000000-0000-4000-8000-000000000001'
      and is_active = false and inactive_reason = 'deleted'
  ) then
    raise exception 'ORR_PRIOR_GENERATION_MUTATED';
  end if;
end;
$orphan_re_review_untouched$;

reset role;

-- ===========================================================================
-- PR2: Admin Finalization / publish path obeys the PR1 lifecycle definition.
--
-- get_admin_review_consensus and publish_{question,answer}_misconception_override
-- must treat a review as a CURRENT reviewer / CURRENT vote only when
-- is_active = true AND its source_version equals the target's OWN current
-- baseline source_version. Question and answer baseline versions are
-- independent. A 'deleted', 'source_updated' or old-version review must never
-- inflate the reviewer count, contribute a vote, satisfy the three-reviewer
-- publish gate or feed a published override.
-- ===========================================================================
insert into public.lecturer_allowlist (email, full_name, active, is_admin)
values ('behavior-admin@example.invalid', 'Behavior Admin', true, true);

set local session_replication_role = replica;
insert into auth.users
  (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', 'behavior-admin@example.invalid', '{}', '{}', now(), now());
insert into public.lecturer_profiles
  (user_id, email, full_name, active, created_at, updated_at)
values
  ('00000000-0000-4000-8000-0000000000a1', 'behavior-admin@example.invalid', 'Behavior Admin', true, now(), now());
set local session_replication_role = origin;

insert into public.master_misconception_catalog (misconception_id, synced_by, synced_at)
values ('M-PUB-001', null, now()), ('M-PUB-EXTRA', null, now());

insert into public.question_misconception_baselines
  (question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values
  ('Q-PUB-001', array['M-PUB-001'], null, now(),
   '44000000-0000-4000-8000-000000000001', null);

-- Two answers, each with its OWN source version, both distinct from the
-- question's and from each other (Scenario F).
insert into public.answer_misconception_baselines
  (answer_id, question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values
  ('A-PUB-A', 'Q-PUB-001', array['M-PUB-001'], null, now(),
   '44000000-0000-4000-8000-0000000000a1', null),
  ('A-PUB-B', 'Q-PUB-001', array['M-PUB-001'], null, now(),
   '44000000-0000-4000-8000-0000000000b1', null);

select set_config('request.jwt.claim.role', 'authenticated', false);

-- Scenario A: three current, active reviewers on the question and each answer.
-- Reviewer three carries a removal vote and an addition vote so their later
-- disappearance is observable.
do $pub_scenario_a$
declare
  reviewer_one uuid := '00000000-0000-4000-8000-000000000011';
  reviewer_two uuid := '00000000-0000-4000-8000-000000000012';
  reviewer_three uuid := '00000000-0000-4000-8000-000000000013';
  admin_id uuid := '00000000-0000-4000-8000-0000000000a1';
  reviewer_id uuid;
  q_count integer;
  a_count integer;
  q_override_version uuid;
  a_override_version uuid;
  b_override_version uuid;
begin
  foreach reviewer_id in array array[reviewer_one, reviewer_two] loop
    perform set_config('request.jwt.claim.sub', reviewer_id::text, false);
    perform public.save_question_review_v3(
      'Q-PUB-001', '44000000-0000-4000-8000-000000000001',
      false, '{}', null, false, '{}', null, 'pub question');
    perform public.save_answer_review_v3(
      'A-PUB-A', '44000000-0000-4000-8000-0000000000a1',
      false, '{}', null, false, '{}', null, 'pub answer a');
    perform public.save_answer_review_v3(
      'A-PUB-B', '44000000-0000-4000-8000-0000000000b1',
      false, '{}', null, false, '{}', null, 'pub answer b');
  end loop;

  perform set_config('request.jwt.claim.sub', reviewer_three::text, false);
  perform public.save_question_review_v3(
    'Q-PUB-001', '44000000-0000-4000-8000-000000000001',
    true, array['M-PUB-001'], 'reviewer three removal',
    true, array['M-PUB-EXTRA'], 'reviewer three addition', null);
  perform public.save_answer_review_v3(
    'A-PUB-A', '44000000-0000-4000-8000-0000000000a1',
    false, '{}', null, false, '{}', null, 'pub answer a');
  perform public.save_answer_review_v3(
    'A-PUB-B', '44000000-0000-4000-8000-0000000000b1',
    false, '{}', null, false, '{}', null, 'pub answer b');

  -- Admin consensus sees exactly three reviewers on every target.
  perform set_config('request.jwt.claim.sub', admin_id::text, false);
  select review_count into q_count
  from public.get_admin_review_consensus()
  where target_type = 'question' and target_id = 'Q-PUB-001';
  select review_count into a_count
  from public.get_admin_review_consensus()
  where target_type = 'answer' and target_id = 'A-PUB-A';
  if coalesce(q_count, 0) <> 3 or coalesce(a_count, 0) <> 3 then
    raise exception 'PUB_A_CONSENSUS_NOT_THREE: q=% a=%', q_count, a_count;
  end if;

  -- Manual publish succeeds for every target and each override records that
  -- target's OWN baseline source_version (Scenario A + F).
  perform public.publish_question_misconception_override('Q-PUB-001');
  perform public.publish_answer_misconception_override('A-PUB-A');
  perform public.publish_answer_misconception_override('A-PUB-B');

  select source_version into q_override_version
  from public.question_misconception_overrides where question_id = 'Q-PUB-001';
  select source_version into a_override_version
  from public.answer_misconception_overrides where answer_id = 'A-PUB-A';
  select source_version into b_override_version
  from public.answer_misconception_overrides where answer_id = 'A-PUB-B';

  if q_override_version <> '44000000-0000-4000-8000-000000000001'
    or a_override_version <> '44000000-0000-4000-8000-0000000000a1'
    or b_override_version <> '44000000-0000-4000-8000-0000000000b1'
    or q_override_version = a_override_version
    or a_override_version = b_override_version then
    raise exception 'PUB_F_OVERRIDE_VERSIONS_WRONG: q=% a=% b=%',
      q_override_version, a_override_version, b_override_version;
  end if;

  -- The single removal / addition votes stay below the >=2 threshold, so the
  -- published snapshot is still the untouched baseline -- publish math unchanged.
  if (select misconception_ids from public.question_misconception_overrides
      where question_id = 'Q-PUB-001') is distinct from array['M-PUB-001'] then
    raise exception 'PUB_A_PUBLISH_MATH_CHANGED';
  end if;
end;
$pub_scenario_a$;

-- Scenario B: reviewer three resets their whole review of Q-PUB-001. The
-- question and both answers fall to two current reviewers; reviewer three's
-- votes vanish from consensus; every publish path now rejects.
do $pub_scenario_b$
declare
  reviewer_three uuid := '00000000-0000-4000-8000-000000000013';
  admin_id uuid := '00000000-0000-4000-8000-0000000000a1';
  q_count integer;
  a_count integer;
  b_count integer;
  q_removed jsonb;
  q_added jsonb;
begin
  perform set_config('request.jwt.claim.sub', reviewer_three::text, false);
  perform public.delete_question_review_workflow_v3(
    'Q-PUB-001', '44000000-0000-4000-8000-000000000001');

  perform set_config('request.jwt.claim.sub', admin_id::text, false);
  select consensus.review_count, consensus.removed_votes, consensus.additional_votes
    into q_count, q_removed, q_added
  from public.get_admin_review_consensus() as consensus
  where consensus.target_type = 'question' and consensus.target_id = 'Q-PUB-001';
  select review_count into a_count
  from public.get_admin_review_consensus()
  where target_type = 'answer' and target_id = 'A-PUB-A';
  select review_count into b_count
  from public.get_admin_review_consensus()
  where target_type = 'answer' and target_id = 'A-PUB-B';

  if coalesce(q_count, 0) <> 2 or coalesce(a_count, 0) <> 2
    or coalesce(b_count, 0) <> 2 then
    raise exception 'PUB_B_CONSENSUS_NOT_TWO: q=% a=% b=%', q_count, a_count, b_count;
  end if;
  if q_removed <> '{}'::jsonb or q_added <> '{}'::jsonb then
    raise exception 'PUB_B_STALE_VOTES_STILL_COUNTED: removed=% added=%',
      q_removed, q_added;
  end if;

  begin
    perform public.publish_question_misconception_override('Q-PUB-001');
    raise exception 'PUB_B_EXPECTED_QUESTION_PUBLISH_REJECTION';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CONSENSUS_REQUIRES_THREE_REVIEWERS' then raise; end if;
  end;
  begin
    perform public.publish_answer_misconception_override('A-PUB-A');
    raise exception 'PUB_B_EXPECTED_ANSWER_A_PUBLISH_REJECTION';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CONSENSUS_REQUIRES_THREE_REVIEWERS' then raise; end if;
  end;
  begin
    perform public.publish_answer_misconception_override('A-PUB-B');
    raise exception 'PUB_B_EXPECTED_ANSWER_B_PUBLISH_REJECTION';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CONSENSUS_REQUIRES_THREE_REVIEWERS' then raise; end if;
  end;

  -- recompute_*_v3 already tore the now-understaffed overrides down; no stale
  -- >=3 override survives.
  if exists (select 1 from public.question_misconception_overrides
             where question_id = 'Q-PUB-001')
    or exists (select 1 from public.answer_misconception_overrides
               where answer_id in ('A-PUB-A', 'A-PUB-B')) then
    raise exception 'PUB_B_STALE_OVERRIDE_SURVIVED';
  end if;
end;
$pub_scenario_b$;

-- Scenario C: reviewer three re-reviews the current version. The question and
-- A-PUB-A return to three current reviewers; A-PUB-B stays at two. Only the
-- re-review's refreshed votes count: the new addition vote participates, while
-- the removal proposal the earlier (deleted) review carried no longer does.
do $pub_scenario_c$
declare
  reviewer_three uuid := '00000000-0000-4000-8000-000000000013';
  admin_id uuid := '00000000-0000-4000-8000-0000000000a1';
  q_count integer;
  a_count integer;
  b_count integer;
  q_removed jsonb;
  q_added jsonb;
begin
  perform set_config('request.jwt.claim.sub', reviewer_three::text, false);
  perform public.save_question_review_v3(
    'Q-PUB-001', '44000000-0000-4000-8000-000000000001',
    false, '{}', null,
    true, array['M-PUB-EXTRA'], 'reviewer three re-review addition', null);
  perform public.save_answer_review_v3(
    'A-PUB-A', '44000000-0000-4000-8000-0000000000a1',
    false, '{}', null, false, '{}', null, 'pub answer a re-review');

  perform set_config('request.jwt.claim.sub', admin_id::text, false);
  select consensus.review_count, consensus.removed_votes, consensus.additional_votes
    into q_count, q_removed, q_added
  from public.get_admin_review_consensus() as consensus
  where consensus.target_type = 'question' and consensus.target_id = 'Q-PUB-001';
  select review_count into a_count
  from public.get_admin_review_consensus()
  where target_type = 'answer' and target_id = 'A-PUB-A';
  select review_count into b_count
  from public.get_admin_review_consensus()
  where target_type = 'answer' and target_id = 'A-PUB-B';

  if coalesce(q_count, 0) <> 3 or coalesce(a_count, 0) <> 3
    or coalesce(b_count, 0) <> 2 then
    raise exception 'PUB_C_CONSENSUS_WRONG: q=% a=% b=%', q_count, a_count, b_count;
  end if;
  -- The prior deleted generation's removal vote for M-PUB-001 is gone; only the
  -- new active addition vote is counted.
  if q_removed <> '{}'::jsonb
    or (q_added -> 'M-PUB-EXTRA') is distinct from to_jsonb(1) then
    raise exception 'PUB_C_VOTE_GENERATION_WRONG: removed=% added=%',
      q_removed, q_added;
  end if;

  perform public.publish_question_misconception_override('Q-PUB-001');
  perform public.publish_answer_misconception_override('A-PUB-A');
  begin
    perform public.publish_answer_misconception_override('A-PUB-B');
    raise exception 'PUB_C_EXPECTED_ANSWER_B_PUBLISH_REJECTION';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CONSENSUS_REQUIRES_THREE_REVIEWERS' then raise; end if;
  end;
end;
$pub_scenario_c$;

-- Scenario E: a synthetic active review row at an OLD (superseded) source
-- version must never count, even though is_active = true.
do $pub_scenario_e$
declare
  reviewer_four uuid := '00000000-0000-4000-8000-000000000014';
  admin_id uuid := '00000000-0000-4000-8000-0000000000a1';
  q_count integer;
  a_count integer;
begin
  insert into public.question_reviews
    (reviewer_id, question_id, has_incorrect_misconceptions,
     has_additional_misconceptions, note, source_version, is_active)
  values
    (reviewer_four, 'Q-PUB-001', false, false, 'old version active',
     '44000000-0000-4000-8000-0000000000ff', true);
  insert into public.answer_reviews
    (reviewer_id, answer_id, question_id, has_mismatched_misconceptions,
     has_additional_misconceptions, note, source_version, is_active)
  values
    (reviewer_four, 'A-PUB-A', 'Q-PUB-001', false, false, 'old version active',
     '44000000-0000-4000-8000-0000000000fe', true);

  perform set_config('request.jwt.claim.sub', admin_id::text, false);
  select review_count into q_count
  from public.get_admin_review_consensus()
  where target_type = 'question' and target_id = 'Q-PUB-001';
  select review_count into a_count
  from public.get_admin_review_consensus()
  where target_type = 'answer' and target_id = 'A-PUB-A';
  if coalesce(q_count, 0) <> 3 or coalesce(a_count, 0) <> 3 then
    raise exception 'PUB_E_OLD_VERSION_COUNTED: q=% a=%', q_count, a_count;
  end if;

  -- Still exactly three current reviewers -> publish still succeeds, not "4".
  perform public.publish_question_misconception_override('Q-PUB-001');

  delete from public.question_reviews
  where reviewer_id = reviewer_four and question_id = 'Q-PUB-001'
    and source_version = '44000000-0000-4000-8000-0000000000ff';
  delete from public.answer_reviews
  where reviewer_id = reviewer_four and answer_id = 'A-PUB-A'
    and source_version = '44000000-0000-4000-8000-0000000000fe';
end;
$pub_scenario_e$;

-- Scenario D: a 'source_updated' review is historical only. Flipping reviewer
-- two's Q-PUB-001 review drops the current count to two and the question
-- publish gate rejects; A-PUB-A (independent lifecycle) is unaffected.
do $pub_scenario_d$
declare
  reviewer_two uuid := '00000000-0000-4000-8000-000000000012';
  admin_id uuid := '00000000-0000-4000-8000-0000000000a1';
  q_count integer;
  a_count integer;
begin
  update public.question_reviews
  set is_active = false, inactive_reason = 'source_updated', inactive_at = now()
  where reviewer_id = reviewer_two and question_id = 'Q-PUB-001'
    and source_version = '44000000-0000-4000-8000-000000000001';

  perform set_config('request.jwt.claim.sub', admin_id::text, false);
  select review_count into q_count
  from public.get_admin_review_consensus()
  where target_type = 'question' and target_id = 'Q-PUB-001';
  select review_count into a_count
  from public.get_admin_review_consensus()
  where target_type = 'answer' and target_id = 'A-PUB-A';
  if coalesce(q_count, 0) <> 2 then
    raise exception 'PUB_D_SOURCE_UPDATED_STILL_COUNTED: q=%', q_count;
  end if;
  if coalesce(a_count, 0) <> 3 then
    raise exception 'PUB_D_ANSWER_LIFECYCLE_LEAKED: a=%', a_count;
  end if;

  begin
    perform public.publish_question_misconception_override('Q-PUB-001');
    raise exception 'PUB_D_EXPECTED_QUESTION_PUBLISH_REJECTION';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'CONSENSUS_REQUIRES_THREE_REVIEWERS' then raise; end if;
  end;
  -- A-PUB-A keeps its own three current reviewers and still publishes.
  perform public.publish_answer_misconception_override('A-PUB-A');

  -- The Scenario C question override (source_review_count = 3) was left behind
  -- by the raw source_updated flip -- exactly the historical situation the
  -- read-only production preflight looks for. Any lifecycle transition that
  -- routes through recompute_*_v3 tears it down; stale rows self-heal.
  if not exists (select 1 from public.question_misconception_overrides
                 where question_id = 'Q-PUB-001') then
    raise exception 'PUB_D_PRECONDITION_NO_STALE_OVERRIDE';
  end if;
  perform public.recompute_question_review_consensus_v3(
    'Q-PUB-001', '44000000-0000-4000-8000-000000000001');
  if exists (select 1 from public.question_misconception_overrides
             where question_id = 'Q-PUB-001') then
    raise exception 'PUB_D_STALE_OVERRIDE_NOT_RECONCILED';
  end if;
end;
$pub_scenario_d$;

reset role;

commit;
