begin;
set local session_replication_role = replica;
insert into public.question_reviews
  (id, reviewer_id, question_id, has_incorrect_misconceptions,
   has_additional_misconceptions, note, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000001',
   '00000000-0000-4000-8000-000000000001',
   'Q-SYN-MISSING', false, false, 'Missing target', now(), now());
commit;
