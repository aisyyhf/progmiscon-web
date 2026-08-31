-- Review-v3 PR2 -- read-only production preflight.
--
-- PURPOSE
-- Before (or after) rolling out 20260831140000_review_v3_publish_lifecycle.sql,
-- confirm how many ALREADY-published misconception overrides no longer have
-- three distinct current reviewers under the PR1/PR2 lifecycle definition:
--   * a question review counts only when is_active = true AND its source_version
--     equals question_misconception_baselines.source_version for that question;
--   * an answer review counts only when is_active = true AND its source_version
--     equals answer_misconception_baselines.source_version for THAT answer.
--
-- Such rows can exist historically because, before PR2, publish_* and the Admin
-- Finalization panel counted every review row regardless of lifecycle, and a
-- reviewer could later be deleted / go stale / move to a new source version
-- without the override being recomputed.
--
-- SAFETY
--   * SELECT-only. No writes, no locks, no function calls with side effects.
--   * Emits AGGREGATE / ANONYMISED figures only: counts and (optionally) the
--     opaque target ids already present in the override tables. No reviewer
--     UUIDs, names, emails or review contents. No reviewer identity is
--     hard-coded or required.
--   * Safe to run against production read replicas.
--
-- INTERPRETATION
--   * "stale_version"   -- the override's recorded source_version differs from
--                          the target's current baseline source_version. These
--                          are unambiguously superseded; every review write and
--                          every baseline sync already routes through
--                          recompute_*_v3, which deletes such an override, so a
--                          non-zero count here means no lifecycle transition has
--                          touched that target since the version bump.
--   * "under_three_now" -- the override still matches the current baseline
--                          version but fewer than three distinct reviewers now
--                          have an active, current review for the target.
--
-- REMEDIATION (do NOT run blindly -- see the PR2 report)
--   For any flagged target, the correct, already-reviewed and audited fix is a
--   single call to the matching recompute function, which rebuilds or removes
--   the override from the current active/current review set:
--       select public.recompute_question_review_consensus_v3(
--         '<question_id>', (select source_version
--                           from public.question_misconception_baselines
--                           where question_id = '<question_id>'));
--       select public.recompute_answer_review_consensus_v3(
--         '<answer_id>',   (select source_version
--                           from public.answer_misconception_baselines
--                           where answer_id = '<answer_id>'));
--   A blanket / unconditional cleanup is NOT recommended.

\echo '== Question overrides: current distinct active + current-version reviewers =='
with current_reviewers as (
  select
    override_row.question_id,
    override_row.source_version as override_version,
    baseline.source_version    as baseline_version,
    (
      select count(distinct review.reviewer_id)
      from public.question_reviews review
      where review.question_id = override_row.question_id
        and review.is_active = true
        and review.source_version = baseline.source_version
    )::int as current_reviewer_count
  from public.question_misconception_overrides override_row
  left join public.question_misconception_baselines baseline
    on baseline.question_id = override_row.question_id
)
select
  count(*)                                                   as published_question_overrides,
  count(*) filter (
    where override_version is distinct from baseline_version
  )                                                          as stale_version,
  count(*) filter (
    where override_version is not distinct from baseline_version
      and current_reviewer_count < 3
  )                                                          as under_three_now,
  count(*) filter (
    where override_version is distinct from baseline_version
       or current_reviewer_count < 3
  )                                                          as flagged_total
from current_reviewers;

\echo '== Answer overrides: current distinct active + current-version reviewers =='
with current_reviewers as (
  select
    override_row.answer_id,
    override_row.source_version as override_version,
    baseline.source_version    as baseline_version,
    (
      select count(distinct review.reviewer_id)
      from public.answer_reviews review
      where review.answer_id = override_row.answer_id
        and review.is_active = true
        and review.source_version = baseline.source_version
    )::int as current_reviewer_count
  from public.answer_misconception_overrides override_row
  left join public.answer_misconception_baselines baseline
    on baseline.answer_id = override_row.answer_id
)
select
  count(*)                                                   as published_answer_overrides,
  count(*) filter (
    where override_version is distinct from baseline_version
  )                                                          as stale_version,
  count(*) filter (
    where override_version is not distinct from baseline_version
      and current_reviewer_count < 3
  )                                                          as under_three_now,
  count(*) filter (
    where override_version is distinct from baseline_version
       or current_reviewer_count < 3
  )                                                          as flagged_total
from current_reviewers;

\echo '== Flagged target ids (opaque ids already in the override tables) =='
select 'question'::text as target_type, override_row.question_id as target_id
from public.question_misconception_overrides override_row
left join public.question_misconception_baselines baseline
  on baseline.question_id = override_row.question_id
where override_row.source_version is distinct from baseline.source_version
   or (
     select count(distinct review.reviewer_id)
     from public.question_reviews review
     where review.question_id = override_row.question_id
       and review.is_active = true
       and review.source_version = baseline.source_version
   ) < 3
union all
select 'answer'::text as target_type, override_row.answer_id as target_id
from public.answer_misconception_overrides override_row
left join public.answer_misconception_baselines baseline
  on baseline.answer_id = override_row.answer_id
where override_row.source_version is distinct from baseline.source_version
   or (
     select count(distinct review.reviewer_id)
     from public.answer_reviews review
     where review.answer_id = override_row.answer_id
       and review.is_active = true
       and review.source_version = baseline.source_version
   ) < 3
order by target_type, target_id;
