do $assertions$
begin
  if exists (
    select 1
    from public.question_reviews review
    join public.question_misconception_baselines baseline
      on baseline.question_id = review.question_id
    where review.source_version is distinct from baseline.source_version
      or review.is_active is distinct from true
      or review.inactive_reason is not null
      or review.inactive_at is not null
  ) then
    raise exception 'LEGACY_QUESTION_REVIEW_MAPPING_FAILED';
  end if;

  if exists (
    select 1
    from public.answer_reviews review
    join public.answer_misconception_baselines baseline
      on baseline.answer_id = review.answer_id
    where review.question_id is distinct from baseline.question_id
      or review.source_version is distinct from baseline.source_version
      or review.is_active is distinct from true
      or review.inactive_reason is not null
      or review.inactive_at is not null
  ) then
    raise exception 'LEGACY_ANSWER_REVIEW_MAPPING_FAILED';
  end if;

  if exists (
    select 1
    from public.question_misconception_overrides override_row
    join public.question_misconception_baselines baseline
      on baseline.question_id = override_row.question_id
    where override_row.source_version is distinct from baseline.source_version
  ) or exists (
    select 1
    from public.answer_misconception_overrides override_row
    join public.answer_misconception_baselines baseline
      on baseline.answer_id = override_row.answer_id
    where override_row.source_version is distinct from baseline.source_version
      or override_row.question_id is distinct from baseline.question_id
  ) then
    raise exception 'LEGACY_OVERRIDE_MAPPING_FAILED';
  end if;

  if (select count(*) from public.question_reviews) <> 2
    or (select count(*) from public.answer_reviews) <> 2
    or (select count(*) from public.review_audit_log) <> 0
  then
    raise exception 'LEGACY_REVIEW_MEANING_OR_AUDIT_FAILED';
  end if;

  if not exists (
    select 1 from public.question_reviews
    where id = '10000000-0000-4000-8000-000000000001'
      and note = 'Legacy question review'
      and created_at = '2026-01-04 01:00:00+00'::timestamptz
      and updated_at = '2026-01-04 02:00:00+00'::timestamptz
  ) or not exists (
    select 1 from public.question_reviews
    where id = '10000000-0000-4000-8000-000000000002'
      and note = 'Legacy question review two'
      and created_at = '2026-01-04 03:00:00+00'::timestamptz
      and updated_at = '2026-01-04 04:00:00+00'::timestamptz
  ) or not exists (
    select 1 from public.answer_reviews
    where id = '20000000-0000-4000-8000-000000000001'
      and note = 'Legacy answer review'
      and created_at = '2026-01-05 01:00:00+00'::timestamptz
      and updated_at = '2026-01-05 02:00:00+00'::timestamptz
  ) or not exists (
    select 1 from public.answer_reviews
    where id = '20000000-0000-4000-8000-000000000002'
      and note = 'Legacy answer review two'
      and created_at = '2026-01-05 03:00:00+00'::timestamptz
      and updated_at = '2026-01-05 04:00:00+00'::timestamptz
  ) or not exists (
    select 1 from public.question_misconception_overrides
    where question_id = 'Q-SYN-001'
      and published_at = '2026-01-03 01:00:00+00'::timestamptz
      and updated_at = '2026-01-03 02:00:00+00'::timestamptz
  ) or not exists (
    select 1 from public.answer_misconception_overrides
    where answer_id = 'A-SYN-001'
      and published_at = '2026-01-03 03:00:00+00'::timestamptz
      and updated_at = '2026-01-03 04:00:00+00'::timestamptz
  ) then
    raise exception 'LEGACY_TIMESTAMP_PRESERVATION_FAILED';
  end if;

  if exists (
    select 1
    from public.question_misconception_baselines
    where source_version is null or source_fingerprint is not null
  ) or exists (
    select 1
    from public.answer_misconception_baselines
    where source_version is null or source_fingerprint is not null
  ) then
    raise exception 'LEGACY_BASELINE_VERSION_ALLOCATION_FAILED';
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
    raise exception 'LEGACY_REVIEW_TRIGGER_REMAINED_ATTACHED';
  end if;
end;
$assertions$;
