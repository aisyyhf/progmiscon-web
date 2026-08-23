begin;
alter table public.question_reviews
  add column is_active boolean default true,
  add column inactive_reason text,
  add column inactive_at timestamptz;
alter table public.question_reviews disable trigger question_reviews_set_updated_at;
update public.question_reviews
set is_active = false, inactive_reason = null, inactive_at = null
where id = '10000000-0000-4000-8000-000000000001';
alter table public.question_reviews enable trigger question_reviews_set_updated_at;
commit;
