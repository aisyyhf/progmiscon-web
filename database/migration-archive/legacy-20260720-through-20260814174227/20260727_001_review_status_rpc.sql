-- Progmiscon
-- Aggregate review status for the currently authenticated reviewer.

begin;

create or replace function public.get_my_review_status()
returns table (
  question_ids text[],
  answer_ids text[],
  question_review_count integer,
  answer_review_count integer,
  latest_updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  with question_status as (
    select
      coalesce(
        array_agg(distinct question_id order by question_id),
        '{}'::text[]
      ) as question_ids,
      count(distinct question_id)::integer as review_count,
      max(updated_at) as latest_updated_at
    from public.question_reviews
    where reviewer_id = (select auth.uid())
  ),
  answer_status as (
    select
      coalesce(
        array_agg(distinct answer_id order by answer_id),
        '{}'::text[]
      ) as answer_ids,
      count(distinct answer_id)::integer as review_count,
      max(updated_at) as latest_updated_at
    from public.answer_reviews
    where reviewer_id = (select auth.uid())
  )
  select
    question_status.question_ids,
    answer_status.answer_ids,
    question_status.review_count,
    answer_status.review_count,
    greatest(
      question_status.latest_updated_at,
      answer_status.latest_updated_at
    )
  from question_status
  cross join answer_status;
$$;

revoke all on function public.get_my_review_status() from public;
revoke all on function public.get_my_review_status() from anon, service_role;
grant execute on function public.get_my_review_status() to authenticated;

commit;
