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

commit;
