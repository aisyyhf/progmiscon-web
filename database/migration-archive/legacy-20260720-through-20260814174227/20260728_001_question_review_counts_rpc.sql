-- Progmiscon
-- Aggregate question review counts for active lecturers.

begin;

create or replace function public.get_question_review_counts()
returns table (
  question_id text,
  review_count integer,
  latest_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.question_reviews.question_id,
    count(distinct public.question_reviews.reviewer_id)::integer as review_count,
    max(public.question_reviews.updated_at) as latest_updated_at
  from public.question_reviews
  where exists (
    select 1
    from public.lecturer_profiles
    where public.lecturer_profiles.user_id = (select auth.uid())
      and public.lecturer_profiles.active = true
  )
  group by public.question_reviews.question_id;
$$;

revoke all on function public.get_question_review_counts() from public;
revoke all on function public.get_question_review_counts() from anon, service_role;
grant execute on function public.get_question_review_counts() to authenticated;

commit;
