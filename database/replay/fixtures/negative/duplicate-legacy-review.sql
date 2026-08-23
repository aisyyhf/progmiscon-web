begin;
alter table public.question_reviews
  drop constraint question_reviews_reviewer_id_question_id_key;
set local session_replication_role = replica;
insert into public.question_reviews
  (id, reviewer_id, question_id, has_incorrect_misconceptions,
   has_additional_misconceptions, note, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000005',
   '00000000-0000-4000-8000-000000000001',
   'Q-SYN-001', false, false, 'Duplicate reviewer target', now(), now());
commit;
