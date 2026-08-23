begin;
insert into public.question_misconception_overrides
  (question_id, misconception_ids, source_review_count, published_by)
values
  ('Q-SYN-NO-BASELINE', array['M-SYN-001'], 3,
   '00000000-0000-4000-8000-000000000001');
commit;
