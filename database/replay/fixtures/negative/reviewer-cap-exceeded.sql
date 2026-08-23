begin;
set local session_replication_role = replica;
insert into auth.users
  (id, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000003', 'reviewer3@example.invalid', '{}', '{}', now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'reviewer4@example.invalid', '{}', '{}', now(), now());
insert into public.lecturer_profiles
  (user_id, email, full_name, active, created_at, updated_at)
values
  ('00000000-0000-4000-8000-000000000003', 'reviewer3@example.invalid', 'Synthetic Reviewer Three', true, now(), now()),
  ('00000000-0000-4000-8000-000000000004', 'reviewer4@example.invalid', 'Synthetic Reviewer Four', true, now(), now());
insert into public.question_reviews
  (id, reviewer_id, question_id, has_incorrect_misconceptions,
   has_additional_misconceptions, note, created_at, updated_at)
values
  ('30000000-0000-4000-8000-000000000003',
   '00000000-0000-4000-8000-000000000003',
   'Q-SYN-001', false, false, 'Third reviewer', now(), now()),
  ('30000000-0000-4000-8000-000000000004',
   '00000000-0000-4000-8000-000000000004',
   'Q-SYN-001', false, false, 'Fourth reviewer', now(), now());
commit;
