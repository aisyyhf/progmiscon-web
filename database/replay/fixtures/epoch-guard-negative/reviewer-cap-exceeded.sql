begin;

set local session_replication_role = replica;

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
select
  ('40000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
  'epoch-cap-' || value::text || '@example.invalid',
  '{}'::jsonb,
  '{}'::jsonb,
  '2026-01-01 00:00:00+00'::timestamptz,
  '2026-01-01 00:00:00+00'::timestamptz
from pg_catalog.generate_series(1, 4) as item(value);

insert into public.lecturer_profiles
  (user_id, email, full_name, active, created_at, updated_at)
select
  ('40000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
  'epoch-cap-' || value::text || '@example.invalid',
  'Epoch Cap Reviewer ' || value::text,
  true,
  '2026-01-01 00:00:00+00'::timestamptz,
  '2026-01-01 00:00:00+00'::timestamptz
from pg_catalog.generate_series(1, 4) as item(value);

insert into public.question_misconception_baselines
  (question_id, misconception_ids, synced_by, synced_at, source_version, source_fingerprint)
values (
  'Q-EPOCH-CAP',
  '{}',
  null,
  '2026-01-01 00:00:00+00',
  '40000000-0000-4000-8000-000000000101',
  null
);

insert into public.question_reviews
  (reviewer_id, question_id, has_incorrect_misconceptions, removed_misconception_ids,
   has_additional_misconceptions, additional_misconception_ids, source_version,
   is_active, created_at, updated_at)
select
  ('40000000-0000-4000-8000-' || pg_catalog.lpad(value::text, 12, '0'))::uuid,
  'Q-EPOCH-CAP',
  false,
  '{}',
  false,
  '{}',
  '40000000-0000-4000-8000-000000000101',
  true,
  '2026-01-01 00:00:00+00'::timestamptz,
  '2026-01-01 00:00:00+00'::timestamptz
from pg_catalog.generate_series(1, 4) as item(value);

commit;
