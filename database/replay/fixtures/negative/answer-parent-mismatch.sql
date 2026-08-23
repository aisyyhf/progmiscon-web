begin;
insert into public.answer_misconception_baselines
  (answer_id, question_id, misconception_ids, synced_by, synced_at)
values
  ('A-SYN-MISMATCH', 'Q-SYN-001', array['M-SYN-001'],
   '00000000-0000-4000-8000-000000000001', now());
set local session_replication_role = replica;
insert into public.answer_reviews
  (id, reviewer_id, answer_id, question_id,
   has_mismatched_misconceptions, has_additional_misconceptions,
   note, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000002',
   '00000000-0000-4000-8000-000000000001',
   'A-SYN-MISMATCH', 'Q-SYN-WRONG', false, false,
   'Parent mismatch', now(), now());
commit;
