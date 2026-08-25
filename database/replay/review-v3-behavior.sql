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
insert into public.lecturer_allowlist (email, full_name, active, is_admin)
values
  ('behavior1@example.invalid', 'Behavior Reviewer One', true, true),
  ('behavior2@example.invalid', 'Behavior Reviewer Two', true, false),
  ('behavior3@example.invalid', 'Behavior Reviewer Three', true, true),
  ('behavior4@example.invalid', 'Behavior Reviewer Four', false, true);
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

insert into public.question_content_overrides (
  question_id,
  question_ind,
  question_en,
  question_code,
  updated_by
)
values (
  'Q-BEH-001',
  'Original Indonesian wording',
  'Original English wording',
  'DO NOT CHANGE',
  '00000000-0000-4000-8000-000000000011'
);

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

do $wording_permissions$
declare
  browser_role text;
  protected_table text;
  mutation text;
begin
  if pg_catalog.has_function_privilege(
      'authenticated',
      'public.admin_save_question_wording_override_v1(uuid,text,uuid,text,text,text,text,text,text)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.admin_question_wording_actor_is_authorized_v1(uuid)',
      'EXECUTE'
    )
    or not pg_catalog.has_function_privilege(
      'service_role',
      'public.admin_save_question_wording_override_v1(uuid,text,uuid,text,text,text,text,text,text)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.save_question_content_override(text,text,text,text)',
      'EXECUTE'
    )
    or pg_catalog.has_function_privilege(
      'authenticated',
      'public.reset_question_content_override(text)',
      'EXECUTE'
    )
    or pg_catalog.has_table_privilege(
      'service_role',
      'public.question_wording_revisions',
      'SELECT'
    )
  then
    raise exception 'QUESTION_WORDING_PRIVILEGE_FAILED';
  end if;

  foreach browser_role in array array['anon', 'authenticated'] loop
    foreach protected_table in array array[
      'public.question_content_overrides',
      'public.question_wording_revisions'
    ] loop
      foreach mutation in array array['INSERT', 'UPDATE', 'DELETE'] loop
        if pg_catalog.has_table_privilege(
          browser_role,
          protected_table,
          mutation
        ) then
          raise exception 'QUESTION_WORDING_DIRECT_DML_EXPOSED';
        end if;
      end loop;
    end loop;
  end loop;
end;
$wording_permissions$;

do $wording_authorization_states$
begin
  update public.lecturer_profiles
  set active = false
  where user_id = '00000000-0000-4000-8000-000000000013';

  if not public.admin_question_wording_actor_is_authorized_v1(
      '00000000-0000-4000-8000-000000000011'
    )
    or public.admin_question_wording_actor_is_authorized_v1(
      '00000000-0000-4000-8000-000000000012'
    )
    or public.admin_question_wording_actor_is_authorized_v1(
      '00000000-0000-4000-8000-000000000013'
    )
    or public.admin_question_wording_actor_is_authorized_v1(
      '00000000-0000-4000-8000-000000000014'
    )
  then
    raise exception 'QUESTION_WORDING_AUTHORIZATION_STATES_FAILED';
  end if;

  update public.lecturer_profiles
  set active = true
  where user_id = '00000000-0000-4000-8000-000000000013';
end;
$wording_authorization_states$;

set role service_role;
do $wording_non_admin$
declare
  current_version uuid;
begin
  select content_version into current_version
  from public.question_content_overrides
  where question_id = 'Q-BEH-001';
  begin
    perform public.admin_save_question_wording_override_v1(
      '00000000-0000-4000-8000-000000000012',
      'Q-BEH-001',
      current_version,
      repeat('a', 64),
      '169',
      'Trusted Indonesian wording',
      'Trusted English wording',
      'Forged Indonesian wording',
      'Forged English wording'
    );
    raise exception 'EXPECTED_ADMIN_ACCESS_REQUIRED';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'ADMIN_ACCESS_REQUIRED' then raise; end if;
  end;
end;
$wording_non_admin$;

do $wording_admin$
declare
  original_version uuid;
  edited_version uuid;
begin
  select content_version into original_version
  from public.question_content_overrides
  where question_id = 'Q-BEH-001';

  perform public.admin_save_question_wording_override_v1(
    '00000000-0000-4000-8000-000000000011',
    'Q-BEH-001',
    original_version,
    repeat('b', 64),
    '169',
    'Trusted Indonesian wording',
    'Trusted English wording',
    'Edited Indonesian wording',
    'Edited English wording'
  );

  select content_version into edited_version
  from public.question_content_overrides
  where question_id = 'Q-BEH-001';
  if edited_version = original_version then
    raise exception 'CONTENT_VERSION_DID_NOT_ROTATE';
  end if;

  begin
    perform public.admin_save_question_wording_override_v1(
      '00000000-0000-4000-8000-000000000011',
      'Q-BEH-001',
      original_version,
      repeat('b', 64),
      '169',
      'Trusted Indonesian wording',
      'Trusted English wording',
      'Stale Indonesian wording',
      'Stale English wording'
    );
    raise exception 'EXPECTED_QUESTION_OVERRIDE_STALE';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'QUESTION_OVERRIDE_STALE' then raise; end if;
  end;

  begin
    perform public.admin_save_question_wording_override_v1(
      '00000000-0000-4000-8000-000000000011',
      'Q-BEH-001',
      edited_version,
      repeat('b', 64),
      '169',
      'Trusted Indonesian wording',
      'Trusted English wording',
      'Edited Indonesian wording',
      'Edited English wording'
    );
    raise exception 'EXPECTED_QUESTION_WORDING_UNCHANGED';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'QUESTION_WORDING_UNCHANGED' then raise; end if;
  end;

  begin
    perform public.admin_save_question_wording_override_v1(
      '00000000-0000-4000-8000-000000000011',
      'Q-BEH-001',
      edited_version,
      repeat('b', 64),
      '169',
      'Trusted Indonesian wording',
      'Trusted English wording',
      '',
      'English only'
    );
    raise exception 'EXPECTED_INVALID_QUESTION_WORDING';
  exception
    when sqlstate '22023' then
      if sqlerrm <> 'INVALID_QUESTION_WORDING' then raise; end if;
  end;
end;
$wording_admin$;
reset role;

set role service_role;
do $wording_first_override$
declare
  first_version uuid;
begin
  perform public.admin_save_question_wording_override_v1(
    '00000000-0000-4000-8000-000000000011',
    'Q-BEH-FIRST',
    null,
    repeat('d', 64),
    '169',
    'Trusted baseline Indonesian',
    'Trusted baseline English',
    'First override Indonesian',
    'First override English'
  );

  select content_version into first_version
  from public.question_content_overrides
  where question_id = 'Q-BEH-FIRST';

  begin
    perform public.admin_save_question_wording_override_v1(
      '00000000-0000-4000-8000-000000000011',
      'Q-BEH-FIRST',
      null,
      repeat('d', 64),
      '169',
      'Trusted baseline Indonesian',
      'Trusted baseline English',
      'Competing Indonesian',
      'Competing English'
    );
    raise exception 'EXPECTED_COMPETING_FIRST_SAVE_STALE';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'QUESTION_OVERRIDE_STALE' then raise; end if;
  end;

  perform public.admin_save_question_wording_override_v1(
    '00000000-0000-4000-8000-000000000011',
    'Q-BEH-FIRST',
    first_version,
    repeat('e', 64),
    '170',
    'Ignored newer trusted Indonesian',
    'Ignored newer trusted English',
    'Second override Indonesian',
    'Second override English'
  );

end;
$wording_first_override$;
reset role;

do $wording_first_override_audit$
begin
  if not exists (
      select 1 from public.question_wording_revisions
      where question_id = 'Q-BEH-FIRST'
        and previous_question_ind = 'Trusted baseline Indonesian'
        and previous_question_en = 'Trusted baseline English'
        and new_question_ind = 'First override Indonesian'
        and new_question_en = 'First override English'
    )
    or not exists (
      select 1 from public.question_wording_revisions
      where question_id = 'Q-BEH-FIRST'
        and previous_question_ind = 'First override Indonesian'
        and previous_question_en = 'First override English'
        and new_question_ind = 'Second override Indonesian'
        and new_question_en = 'Second override English'
    )
    or (select count(*) from public.question_wording_revisions
        where question_id = 'Q-BEH-FIRST') <> 2
  then
    raise exception 'QUESTION_WORDING_FIRST_OVERRIDE_AUDIT_FAILED';
  end if;
end;
$wording_first_override_audit$;

create function pg_temp.reject_behavior_revision_insert()
returns trigger
language plpgsql
as $$
begin
  if new.new_question_ind = 'ROLLBACK TEST' then
    raise exception 'BEHAVIOR_REVISION_INSERT_FAILED';
  end if;
  return new;
end;
$$;

create trigger behavior_revision_insert_failure
before insert on public.question_wording_revisions
for each row execute function pg_temp.reject_behavior_revision_insert();

set role service_role;
do $wording_revision_rollback$
declare
  expected_version uuid;
begin
  select content_version into expected_version
  from public.question_content_overrides
  where question_id = 'Q-BEH-001';
  begin
    perform public.admin_save_question_wording_override_v1(
      '00000000-0000-4000-8000-000000000011',
      'Q-BEH-001',
      expected_version,
      repeat('c', 64),
      '169',
      'Trusted Indonesian wording',
      'Trusted English wording',
      'ROLLBACK TEST',
      'ROLLBACK TEST'
    );
    raise exception 'EXPECTED_REVISION_INSERT_FAILURE';
  exception
    when others then
      if sqlerrm <> 'BEHAVIOR_REVISION_INSERT_FAILED' then raise; end if;
  end;
end;
$wording_revision_rollback$;
reset role;

drop trigger behavior_revision_insert_failure on public.question_wording_revisions;

do $wording_revision_immutable$
begin
  begin
    update public.question_wording_revisions
    set new_question_ind = 'Mutated audit';
    raise exception 'EXPECTED_REVISION_IMMUTABLE';
  exception
    when sqlstate '55000' then
      if sqlerrm <> 'QUESTION_WORDING_REVISION_IMMUTABLE' then raise; end if;
  end;
end;
$wording_revision_immutable$;

do $wording_invariants$
begin
  if (select source_version from public.question_misconception_baselines
      where question_id = 'Q-BEH-001')
      is distinct from '40000000-0000-4000-8000-000000000001'::uuid
    or (select count(*) from public.question_reviews
      where question_id = 'Q-BEH-001'
        and source_version = '40000000-0000-4000-8000-000000000001'
        and is_active) <> 3
    or not exists (
      select 1
      from public.question_content_overrides
      where question_id = 'Q-BEH-001'
        and question_ind = 'Edited Indonesian wording'
        and question_en = 'Edited English wording'
        and question_code = 'DO NOT CHANGE'
    )
    or (select count(*) from public.question_wording_revisions
      where question_id = 'Q-BEH-001'
        and authority_sha256 = repeat('b', 64)
        and google_drive_version = '169') <> 1
  then
    raise exception 'QUESTION_WORDING_INVARIANT_FAILED';
  end if;
end;
$wording_invariants$;

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
