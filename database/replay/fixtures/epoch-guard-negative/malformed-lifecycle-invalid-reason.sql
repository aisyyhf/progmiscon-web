begin;

set local session_replication_role = replica;

alter table public.question_reviews
  drop constraint question_reviews_inactive_state_check;

insert into public.question_reviews
  (reviewer_id, question_id, has_incorrect_misconceptions, removed_misconception_ids,
   has_additional_misconceptions, additional_misconception_ids, source_version,
   is_active, inactive_reason, inactive_at, created_at, updated_at)
values (
  '51000000-0000-4000-8000-000000000001',
  'Q-EPOCH-INVALID-REASON',
  false,
  '{}',
  false,
  '{}',
  '51000000-0000-4000-8000-000000000101',
  false,
  'unexpected',
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00',
  '2026-01-01 00:00:00+00'
);

commit;
