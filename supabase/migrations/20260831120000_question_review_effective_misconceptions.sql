-- Review-v3 forward migration.
--
-- Fix: save_question_review_v3 validated the reviewer's removal / addition
-- proposals against the DIRECT question misconception baseline only
-- (question_misconception_baselines.misconception_ids). The Review Soal UI,
-- however, presents the EFFECTIVE set -- direct question relations UNION the
-- misconceptions derived from the question's multiple-choice answer options --
-- and lets a lecturer propose removing any of them. Selecting an answer-derived
-- misconception for removal therefore failed with REMOVAL_NOT_IN_BASELINE
-- ("Miskonsepsi yang akan dilepas tidak ada pada data sumber saat ini."),
-- blocking the review workflow.
--
-- This migration recomputes the effective set (direct baseline UNION the
-- answer_misconception_baselines rows for the same question) purely for input
-- validation. It does NOT merge answer relations into the question baseline and
-- does NOT change what is stored or how consensus is recomputed: an
-- answer-derived id placed in removed_misconception_ids simply never matches a
-- direct baseline id in recompute_question_review_consensus_v3, so the existing
-- "answer-derived removal stays soft until the answer relation is also removed"
-- behaviour in Admin Finalization is preserved.
--
-- Signature, volatility, SECURITY DEFINER, search_path and ACLs are unchanged,
-- so the Review-v3 epoch guard contract is unaffected.

begin;

CREATE OR REPLACE FUNCTION public.save_question_review_v3(p_question_id text, p_source_version uuid, p_has_incorrect_misconceptions boolean, p_removed_misconception_ids text[], p_removal_reason text, p_has_additional_misconceptions boolean, p_additional_misconception_ids text[], p_addition_reason text, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  caller_id uuid := auth.uid();
  target_id text := pg_catalog.btrim(coalesce(p_question_id, ''));
  current_version uuid;
  baseline_ids text[];
  effective_ids text[];
  removed_ids text[];
  added_ids text[];
  existing_review public.question_reviews%rowtype;
  review_id uuid;
  active_count integer;
  consensus jsonb;
begin
  if caller_id is null then
    raise exception using message = 'AUTH_REQUIRED', errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.lecturer_profiles profile
    where profile.user_id = caller_id
      and profile.active = true
  ) then
    raise exception using message = 'LECTURER_INACTIVE', errcode = 'P0001';
  end if;

  if target_id = '' or p_source_version is null
    or p_has_incorrect_misconceptions is null
    or p_has_additional_misconceptions is null
  then
    raise exception using message = 'INVALID_REVIEW_INPUT', errcode = '22023';
  end if;

  select baseline.source_version, baseline.misconception_ids
  into current_version, baseline_ids
  from public.question_misconception_baselines baseline
  where baseline.question_id = target_id
  for update;

  if not found then
    raise exception using message = 'QUESTION_NOT_FOUND', errcode = 'P0001';
  end if;

  if current_version is distinct from p_source_version then
    raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
  end if;

  baseline_ids := public.normalize_text_id_array(baseline_ids);

  -- Effective question misconceptions = direct question relations UNION the
  -- misconceptions derived from this question's answer-option relations. The
  -- Review Soal UI offers this same union for removal, so the save path must
  -- validate against it (direct-only rejected legitimate answer-derived
  -- proposals). Answer relations are not merged into the question baseline;
  -- the union is recomputed here only for input validation.
  effective_ids := public.normalize_text_id_array(
    baseline_ids || array(
      select derived.misconception_id
      from public.answer_misconception_baselines answer_baseline
      cross join lateral pg_catalog.unnest(answer_baseline.misconception_ids)
        as derived(misconception_id)
      where answer_baseline.question_id = target_id
    )
  );

  removed_ids := case
    when p_has_incorrect_misconceptions then
      public.normalize_text_id_array(p_removed_misconception_ids)
    else array[]::text[]
  end;
  added_ids := case
    when p_has_additional_misconceptions then
      public.normalize_text_id_array(p_additional_misconception_ids)
    else array[]::text[]
  end;

  if p_has_incorrect_misconceptions
    and (
      pg_catalog.cardinality(removed_ids) = 0
      or pg_catalog.length(pg_catalog.btrim(coalesce(p_removal_reason, ''))) = 0
    )
  then
    raise exception using message = 'REMOVAL_DETAILS_REQUIRED', errcode = '22023';
  end if;

  if p_has_additional_misconceptions
    and (
      pg_catalog.cardinality(added_ids) = 0
      or pg_catalog.length(pg_catalog.btrim(coalesce(p_addition_reason, ''))) = 0
    )
  then
    raise exception using message = 'ADDITION_DETAILS_REQUIRED', errcode = '22023';
  end if;

  if removed_ids && added_ids then
    raise exception using message = 'REVIEW_SELECTION_OVERLAP', errcode = '22023';
  end if;

  if not (removed_ids <@ effective_ids) then
    raise exception using message = 'REMOVAL_NOT_IN_BASELINE', errcode = '22023';
  end if;

  if added_ids && effective_ids then
    raise exception using message = 'ADDITION_ALREADY_IN_BASELINE', errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.unnest(removed_ids || added_ids) candidate(candidate_id)
    where not exists (
      select 1
      from public.master_misconception_catalog catalog
      where catalog.misconception_id = candidate_id
    )
  ) then
    raise exception using message = 'INVALID_MISCONCEPTION_ID', errcode = '22023';
  end if;

  select review.*
  into existing_review
  from public.question_reviews review
  where review.reviewer_id = caller_id
    and review.question_id = target_id
    and review.source_version = current_version
  for update;

  if found then
    if existing_review.is_active = false then
      if existing_review.inactive_reason = 'source_updated' then
        raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
      end if;

      select pg_catalog.count(*)::integer
      into active_count
      from public.question_reviews review
      where review.question_id = target_id
        and review.source_version = current_version
        and review.is_active = true;

      if active_count >= 3 then
        raise exception using message = 'REVIEWER_CAP_REACHED', errcode = 'P0001';
      end if;
    end if;

    update public.question_reviews
    set
      has_incorrect_misconceptions = p_has_incorrect_misconceptions,
      removed_misconception_ids = removed_ids,
      removal_reason = case
        when p_has_incorrect_misconceptions then nullif(pg_catalog.btrim(p_removal_reason), '')
        else null
      end,
      has_additional_misconceptions = p_has_additional_misconceptions,
      additional_misconception_ids = added_ids,
      addition_reason = case
        when p_has_additional_misconceptions then nullif(pg_catalog.btrim(p_addition_reason), '')
        else null
      end,
      note = nullif(pg_catalog.btrim(p_note), ''),
      is_active = true,
      inactive_reason = null,
      inactive_at = null
    where id = existing_review.id
    returning id into review_id;
  else
    select pg_catalog.count(*)::integer
    into active_count
    from public.question_reviews review
    where review.question_id = target_id
      and review.source_version = current_version
      and review.is_active = true;

    if active_count >= 3 then
      raise exception using message = 'REVIEWER_CAP_REACHED', errcode = 'P0001';
    end if;

    insert into public.question_reviews (
      reviewer_id,
      question_id,
      has_incorrect_misconceptions,
      removed_misconception_ids,
      removal_reason,
      has_additional_misconceptions,
      additional_misconception_ids,
      addition_reason,
      note,
      source_version,
      is_active,
      inactive_reason,
      inactive_at
    )
    values (
      caller_id,
      target_id,
      p_has_incorrect_misconceptions,
      removed_ids,
      case
        when p_has_incorrect_misconceptions then nullif(pg_catalog.btrim(p_removal_reason), '')
        else null
      end,
      p_has_additional_misconceptions,
      added_ids,
      case
        when p_has_additional_misconceptions then nullif(pg_catalog.btrim(p_addition_reason), '')
        else null
      end,
      nullif(pg_catalog.btrim(p_note), ''),
      current_version,
      true,
      null,
      null
    )
    returning id into review_id;
  end if;

  consensus := public.recompute_question_review_consensus_v3(
    target_id,
    current_version
  );

  return pg_catalog.jsonb_build_object(
    'review_id', review_id,
    'question_id', target_id,
    'source_version', current_version,
    'is_active', true,
    'consensus', consensus
  );
end;
$function$;

revoke all on function public.save_question_review_v3(p_question_id text, p_source_version uuid, p_has_incorrect_misconceptions boolean, p_removed_misconception_ids text[], p_removal_reason text, p_has_additional_misconceptions boolean, p_additional_misconception_ids text[], p_addition_reason text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.save_question_review_v3(p_question_id text, p_source_version uuid, p_has_incorrect_misconceptions boolean, p_removed_misconception_ids text[], p_removal_reason text, p_has_additional_misconceptions boolean, p_additional_misconception_ids text[], p_addition_reason text, p_note text) to authenticated, service_role;

commit;
