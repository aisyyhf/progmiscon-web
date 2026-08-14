-- Progmiscon
-- Expose only the source versions needed to build a consistent Review workspace.

begin;

create or replace function public.get_review_source_versions()
returns table (
  target_type text,
  target_id text,
  parent_question_id text,
  source_version text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    'question'::text as target_type,
    baseline.question_id as target_id,
    null::text as parent_question_id,
    baseline.source_version
  from public.question_misconception_baselines as baseline
  where exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )

  union all

  select
    'answer'::text as target_type,
    baseline.answer_id as target_id,
    baseline.question_id as parent_question_id,
    baseline.source_version
  from public.answer_misconception_baselines as baseline
  where exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  );
$$;

revoke all on function public.get_review_source_versions() from public;
revoke all on function public.get_review_source_versions() from anon, service_role;
grant execute on function public.get_review_source_versions() to authenticated;

commit;
