begin;

set local session_replication_role = replica;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values (
  '30000000-0000-4000-8000-000000000001',
  'epoch-invalid-source@example.invalid',
  '{}'::jsonb,
  '{}'::jsonb,
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

insert into public.lecturer_profiles
  (user_id, email, full_name, active, created_at, updated_at)
values (
  '30000000-0000-4000-8000-000000000001',
  'epoch-invalid-source@example.invalid',
  'Epoch Invalid Source',
  true,
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

insert into public.question_misconception_baselines
  (question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values (
  'Q-EPOCH-INVALID-SOURCE',
  '{}',
  null,
  '2026-01-01 00:00:00+00',
  '30000000-0000-4000-8000-000000000101',
  null
);

insert into public.question_reviews
  (reviewer_id, question_id, has_incorrect_misconceptions, removed_misconception_ids,
   has_additional_misconceptions, additional_misconception_ids, source_version,
   is_active, created_at, updated_at)
values (
  '30000000-0000-4000-8000-000000000001',
  'Q-EPOCH-INVALID-SOURCE',
  false,
  '{}',
  false,
  '{}',
  '30000000-0000-4000-8000-000000000102',
  true,
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

commit;
