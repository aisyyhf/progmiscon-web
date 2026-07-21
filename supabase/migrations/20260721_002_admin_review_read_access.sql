-- Progmiscon
-- Read-only access for the Admin review history.
-- Run this file once in Supabase Dashboard > SQL Editor after 20260721_001.

begin;

drop policy if exists "Admins can read reviewer profiles"
  on public.lecturer_profiles;

create or replace function public.get_admin_reviewer_profiles(
  input_reviewer_ids uuid[]
)
returns table (
  user_id uuid,
  full_name text,
  email text
)
language sql
stable
security definer
set search_path = ''
as $$
  select profile.user_id, profile.full_name, profile.email
  from public.lecturer_profiles as profile
  where (select public.current_user_is_admin())
    and profile.user_id = any(input_reviewer_ids)
    and (
      exists (
        select 1
        from public.question_reviews as question_review
        where question_review.reviewer_id = profile.user_id
      )
      or exists (
        select 1
        from public.answer_reviews as answer_review
        where answer_review.reviewer_id = profile.user_id
      )
    );
$$;

revoke all on function public.get_admin_reviewer_profiles(uuid[]) from public;
grant execute on function public.get_admin_reviewer_profiles(uuid[]) to authenticated;

drop policy if exists "Admins can read all question reviews"
  on public.question_reviews;
create policy "Admins can read all question reviews"
on public.question_reviews
for select
to authenticated
using ((select public.current_user_is_admin()));

drop policy if exists "Admins can read all answer reviews"
  on public.answer_reviews;
create policy "Admins can read all answer reviews"
on public.answer_reviews
for select
to authenticated
using ((select public.current_user_is_admin()));

commit;
