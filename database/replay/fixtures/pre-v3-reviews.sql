-- Deterministic synthetic fixture for the legacy-data replay scenario only.
begin;

set local session_replication_role = replica;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'reviewer1@example.invalid', '{}'::jsonb, '{}'::jsonb, '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-000000000002', 'reviewer2@example.invalid', '{}'::jsonb, '{}'::jsonb, '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00');

insert into public.lecturer_profiles (user_id, email, full_name, active, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000001', 'reviewer1@example.invalid', 'Synthetic Reviewer One', true, '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00'),
  ('00000000-0000-4000-8000-000000000002', 'reviewer2@example.invalid', 'Synthetic Reviewer Two', true, '2026-01-01 00:00:00+00', '2026-01-01 00:00:00+00');

set local session_replication_role = origin;

insert into public.master_misconception_catalog (misconception_id, synced_by, synced_at)
values
  ('M-SYN-001', '00000000-0000-4000-8000-000000000001', '2026-01-02 00:00:00+00'),
  ('M-SYN-002', '00000000-0000-4000-8000-000000000001', '2026-01-02 00:00:00+00');

insert into public.question_misconception_baselines (question_id, misconception_ids, synced_by, synced_at)
values ('Q-SYN-001', array['M-SYN-001'], '00000000-0000-4000-8000-000000000001', '2026-01-02 01:00:00+00');

insert into public.answer_misconception_baselines (answer_id, question_id, misconception_ids, synced_by, synced_at)
values ('A-SYN-001', 'Q-SYN-001', array['M-SYN-002'], '00000000-0000-4000-8000-000000000001', '2026-01-02 02:00:00+00');

insert into public.question_misconception_overrides
  (question_id, misconception_ids, source_review_count, published_by, published_at, updated_at)
values
  ('Q-SYN-001', array['M-SYN-002'], 3, '00000000-0000-4000-8000-000000000001', '2026-01-03 01:00:00+00', '2026-01-03 02:00:00+00');

insert into public.answer_misconception_overrides
  (answer_id, question_id, misconception_ids, source_review_count, published_by, published_at, updated_at)
values
  ('A-SYN-001', 'Q-SYN-001', array['M-SYN-001'], 3, '00000000-0000-4000-8000-000000000001', '2026-01-03 03:00:00+00', '2026-01-03 04:00:00+00');

insert into public.question_reviews
  (id, reviewer_id, question_id, has_incorrect_misconceptions, removed_misconception_ids, removal_reason,
   has_additional_misconceptions, additional_misconception_ids, addition_reason, note, created_at, updated_at)
values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'Q-SYN-001', false, '{}', null, true, array['M-SYN-002'], 'Synthetic addition', 'Legacy question review', '2026-01-04 01:00:00+00', '2026-01-04 02:00:00+00'),
  ('10000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'Q-SYN-001', false, '{}', null, true, array['M-SYN-002'], 'Synthetic addition', 'Legacy question review two', '2026-01-04 03:00:00+00', '2026-01-04 04:00:00+00');

insert into public.answer_reviews
  (id, reviewer_id, answer_id, question_id, has_mismatched_misconceptions, removed_misconception_ids, removal_reason,
   has_additional_misconceptions, additional_misconception_ids, addition_reason, note, created_at, updated_at)
values
  ('20000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'A-SYN-001', 'Q-SYN-001', false, '{}', null, true, array['M-SYN-001'], 'Synthetic addition', 'Legacy answer review', '2026-01-05 01:00:00+00', '2026-01-05 02:00:00+00'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'A-SYN-001', 'Q-SYN-001', false, '{}', null, true, array['M-SYN-001'], 'Synthetic addition', 'Legacy answer review two', '2026-01-05 03:00:00+00', '2026-01-05 04:00:00+00');

commit;
