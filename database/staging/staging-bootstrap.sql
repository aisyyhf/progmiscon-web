-- Progmiscon - Supabase STAGING bootstrap (Review-v3 epoch).
--
-- PURPOSE
--   Initialize the "public" application schema on a BRAND-NEW, EMPTY Supabase
--   staging/test project so Vercel Preview deployments get an isolated backend
--   that matches the current production Review-v3 contract.
--
-- SCOPE / SAFETY
--   * NOT a production migration. Never place under supabase/migrations/ and
--     never run against a linked production project. Lives under database/staging/.
--   * Assumes a fresh Supabase project: platform roles (postgres, anon,
--     authenticated, service_role, ...), the auth schema + auth.users, and
--     auth.uid()/auth.role() already exist. Apply it as the "postgres" role.
--   * Creates ONLY application objects in schema "public", plus one trigger on
--     auth.users required by lecturer provisioning.
--
-- PROVENANCE
--   Object DDL (tables, constraints, indexes, functions, triggers, policies) is
--   taken verbatim from a pre-epoch production schema-only dump so function
--   bodies are byte-identical to the production contract. Grants are rewritten
--   as explicit REVOKE + GRANT so the resulting ACLs do not depend on a
--   project's ALTER DEFAULT PRIVILEGES configuration. Cross-checked against
--   checks/fixtures/review-v3/.
--
-- EXTENSIONS
--   pgcrypto ............ required: gen_random_uuid() default on several PKs.
--   uuid-ossp .......... omitted: no uuid_generate_* call exists here.
--   pg_stat_statements . omitted: platform observability, not an app dependency.
--   supabase_vault ..... omitted: platform-managed secrets, not an app dependency.
--
-- VALIDATION
--   After applying this file, run the existing assertion-only guard as the
--   final check (do NOT copy it here):
--     supabase/migrations/20260823000000_review_v3_epoch_guard.sql

begin;

-- Create functions before the tables they reference (mirrors the production
-- schema-dump restore order).
set check_function_bodies = false;
set local client_min_messages = warning;

create extension if not exists "pgcrypto" with schema "extensions";

-- ---------------------------------------------------------------------------
-- Functions (bodies are verbatim from the production Review-v3 contract)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "public"."current_user_is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1
    from public.lecturer_profiles as profile
    inner join public.lecturer_allowlist as allowed
      on lower(btrim(allowed.email)) = lower(btrim(profile.email))
    where profile.user_id = (select auth.uid())
      and profile.active = true
      and allowed.active = true
      and allowed.is_admin = true
  );
$$;


ALTER FUNCTION "public"."current_user_is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_answer_review_v3"("p_answer_id" "text", "p_source_version" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := auth.uid();
  target_id text := pg_catalog.btrim(coalesce(p_answer_id, ''));
  current_version uuid;
  target_review public.answer_reviews%rowtype;
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

  select baseline.source_version
  into current_version
  from public.answer_misconception_baselines baseline
  where baseline.answer_id = target_id
  for update;

  if not found then
    raise exception using message = 'ANSWER_NOT_FOUND', errcode = 'P0001';
  end if;

  if current_version is distinct from p_source_version then
    raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
  end if;

  select review.*
  into target_review
  from public.answer_reviews review
  where review.reviewer_id = caller_id
    and review.answer_id = target_id
    and review.source_version = current_version
  for update;

  if not found then
    raise exception using message = 'REVIEW_NOT_FOUND', errcode = 'P0001';
  end if;

  if target_review.is_active = true then
    update public.answer_reviews
    set
      is_active = false,
      inactive_reason = 'deleted',
      inactive_at = pg_catalog.now()
    where id = target_review.id;
  end if;

  consensus := public.recompute_answer_review_consensus_v3(
    target_id,
    current_version
  );

  return pg_catalog.jsonb_build_object(
    'review_id', target_review.id,
    'answer_id', target_id,
    'source_version', current_version,
    'is_active', false,
    'inactive_reason', 'deleted',
    'consensus', consensus
  );
end;
$$;


ALTER FUNCTION "public"."delete_answer_review_v3"("p_answer_id" "text", "p_source_version" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_question_review_v3"("p_question_id" "text", "p_source_version" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := auth.uid();
  target_id text := pg_catalog.btrim(coalesce(p_question_id, ''));
  current_version uuid;
  target_review public.question_reviews%rowtype;
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

  select baseline.source_version
  into current_version
  from public.question_misconception_baselines baseline
  where baseline.question_id = target_id
  for update;

  if not found then
    raise exception using message = 'QUESTION_NOT_FOUND', errcode = 'P0001';
  end if;

  if current_version is distinct from p_source_version then
    raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
  end if;

  select review.*
  into target_review
  from public.question_reviews review
  where review.reviewer_id = caller_id
    and review.question_id = target_id
    and review.source_version = current_version
  for update;

  if not found then
    raise exception using message = 'REVIEW_NOT_FOUND', errcode = 'P0001';
  end if;

  if target_review.is_active = true then
    update public.question_reviews
    set
      is_active = false,
      inactive_reason = 'deleted',
      inactive_at = pg_catalog.now()
    where id = target_review.id;
  end if;

  consensus := public.recompute_question_review_consensus_v3(
    target_id,
    current_version
  );

  return pg_catalog.jsonb_build_object(
    'review_id', target_review.id,
    'question_id', target_id,
    'source_version', current_version,
    'is_active', false,
    'inactive_reason', 'deleted',
    'consensus', consensus
  );
end;
$$;


ALTER FUNCTION "public"."delete_question_review_v3"("p_question_id" "text", "p_source_version" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_question_review_workflow_v3"("p_question_id" "text", "p_source_version" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := auth.uid();
  target_id text := pg_catalog.btrim(coalesce(p_question_id, ''));
  question_current_version uuid;
  question_review_id uuid;
  question_review_reset boolean := false;
  deactivated_answers jsonb;
  answer_generation jsonb := pg_catalog.jsonb_build_array();
  answer_row record;
  question_consensus jsonb;
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

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  select baseline.source_version
  into question_current_version
  from public.question_misconception_baselines baseline
  where baseline.question_id = target_id
  for update;

  if not found then
    raise exception using message = 'QUESTION_NOT_FOUND', errcode = 'P0001';
  end if;

  if question_current_version is distinct from p_source_version then
    raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
  end if;

  update public.question_reviews review
  set
    is_active = false,
    inactive_reason = 'deleted',
    inactive_at = pg_catalog.now()
  where review.reviewer_id = caller_id
    and review.question_id = target_id
    and review.source_version = question_current_version
    and review.is_active = true
  returning review.id into question_review_id;

  if found then
    question_review_reset := true;
  end if;

  with deactivated as (
    update public.answer_reviews review
    set
      is_active = false,
      inactive_reason = 'deleted',
      inactive_at = pg_catalog.now()
    from public.answer_misconception_baselines baseline
    where review.reviewer_id = caller_id
      and review.question_id = target_id
      and review.answer_id = baseline.answer_id
      and review.is_active = true
      and review.source_version = baseline.source_version
    returning review.id as review_id, review.answer_id, review.source_version
  )
  select coalesce(
    pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'review_id', deactivated.review_id,
        'answer_id', deactivated.answer_id,
        'source_version', deactivated.source_version
      )
      order by deactivated.answer_id
    ),
    pg_catalog.jsonb_build_array()
  )
  into deactivated_answers
  from deactivated;

  for answer_row in
    select
      element ->> 'answer_id' as answer_id,
      (element ->> 'source_version')::uuid as source_version
    from pg_catalog.jsonb_array_elements(deactivated_answers) as element
  loop
    answer_generation := answer_generation || pg_catalog.jsonb_build_object(
      'answer_id', answer_row.answer_id,
      'source_version', answer_row.source_version,
      'consensus', public.recompute_answer_review_consensus_v3(
        answer_row.answer_id,
        answer_row.source_version
      )
    );
  end loop;

  question_consensus := public.recompute_question_review_consensus_v3(
    target_id,
    question_current_version
  );

  return pg_catalog.jsonb_build_object(
    'question_id', target_id,
    'source_version', question_current_version,
    'question_review_id', question_review_id,
    'question_review_reset', question_review_reset,
    'deactivated_answer_reviews', deactivated_answers,
    'question_consensus', question_consensus,
    'answer_consensus', answer_generation
  );
end;
$$;


ALTER FUNCTION "public"."delete_question_review_workflow_v3"("p_question_id" "text", "p_source_version" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_answer_review_cap"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  new.answer_id := pg_catalog.btrim(new.answer_id);
  new.question_id := pg_catalog.btrim(new.question_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('answer_review:' || new.answer_id, 0)
  );

  if (
    select pg_catalog.count(distinct review.reviewer_id)
    from public.answer_reviews as review
    where review.answer_id = new.answer_id
      and review.reviewer_id <> new.reviewer_id
  ) >= 3 then
    raise exception using message = 'REVIEW_CAP_REACHED', errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_answer_review_cap"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_question_review_cap"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  new.question_id := pg_catalog.btrim(new.question_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('question_review:' || new.question_id, 0)
  );

  if (
    select pg_catalog.count(distinct review.reviewer_id)
    from public.question_reviews as review
    where review.question_id = new.question_id
      and review.reviewer_id <> new.reviewer_id
  ) >= 3 then
    raise exception using message = 'REVIEW_CAP_REACHED', errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_question_review_cap"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_verified_telkom_lecturer_profile"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  -- Keep an unchanged legacy profile valid, including an older non-Telkom one.
  if tg_op = 'UPDATE'
    and new.user_id = old.user_id
    and lower(btrim(new.email)) = lower(btrim(old.email)) then
    return new;
  end if;

  if not public.is_telkom_lecturer_email(new.email) then
    raise exception 'LECTURER_EMAIL_DOMAIN_NOT_ALLOWED';
  end if;

  if not exists (
    select 1
    from auth.users as auth_user
    where auth_user.id = new.user_id
      and auth_user.email_confirmed_at is not null
      and lower(btrim(coalesce(auth_user.email, '')))
        = lower(btrim(new.email))
      and public.is_telkom_lecturer_email(auth_user.email)
  ) then
    raise exception 'LECTURER_EMAIL_NOT_VERIFIED';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_verified_telkom_lecturer_profile"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_review_consensus"() RETURNS TABLE("target_type" "text", "target_id" "text", "question_id" "text", "review_count" integer, "removed_votes" "jsonb", "additional_votes" "jsonb", "published_misconception_ids" "text"[], "published_at" timestamp with time zone, "baseline_misconception_ids" "text"[], "baseline_synced_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with question_targets as (
    select
      'question'::text as target_type,
      review.question_id as target_id,
      review.question_id,
      pg_catalog.count(distinct review.reviewer_id)::integer as review_count
    from public.question_reviews as review
    group by review.question_id
  ),
  question_removed as (
    select
      review.question_id as target_id,
      pg_catalog.btrim(value.id) as id,
      pg_catalog.count(distinct review.reviewer_id)::integer as votes
    from public.question_reviews as review
    cross join lateral pg_catalog.unnest(review.removed_misconception_ids) as value(id)
    where review.has_incorrect_misconceptions
      and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
    group by review.question_id, pg_catalog.btrim(value.id)
  ),
  question_added as (
    select
      review.question_id as target_id,
      pg_catalog.btrim(value.id) as id,
      pg_catalog.count(distinct review.reviewer_id)::integer as votes
    from public.question_reviews as review
    cross join lateral pg_catalog.unnest(review.additional_misconception_ids) as value(id)
    where review.has_additional_misconceptions
      and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
    group by review.question_id, pg_catalog.btrim(value.id)
  ),
  answer_targets as (
    select
      'answer'::text as target_type,
      review.answer_id as target_id,
      pg_catalog.min(review.question_id) as question_id,
      pg_catalog.count(distinct review.reviewer_id)::integer as review_count
    from public.answer_reviews as review
    group by review.answer_id
  ),
  answer_removed as (
    select
      review.answer_id as target_id,
      pg_catalog.btrim(value.id) as id,
      pg_catalog.count(distinct review.reviewer_id)::integer as votes
    from public.answer_reviews as review
    cross join lateral pg_catalog.unnest(review.removed_misconception_ids) as value(id)
    where review.has_mismatched_misconceptions
      and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
    group by review.answer_id, pg_catalog.btrim(value.id)
  ),
  answer_added as (
    select
      review.answer_id as target_id,
      pg_catalog.btrim(value.id) as id,
      pg_catalog.count(distinct review.reviewer_id)::integer as votes
    from public.answer_reviews as review
    cross join lateral pg_catalog.unnest(review.additional_misconception_ids) as value(id)
    where review.has_additional_misconceptions
      and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
    group by review.answer_id, pg_catalog.btrim(value.id)
  )
  select
    target.target_type,
    target.target_id,
    target.question_id,
    target.review_count,
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(vote.id, vote.votes order by vote.id)
        from question_removed as vote
        where vote.target_id = target.target_id
      ),
      '{}'::jsonb
    ),
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(vote.id, vote.votes order by vote.id)
        from question_added as vote
        where vote.target_id = target.target_id
      ),
      '{}'::jsonb
    ),
    published.misconception_ids,
    published.published_at,
    baseline.misconception_ids,
    baseline.synced_at
  from question_targets as target
  left join public.question_misconception_overrides as published
    on published.question_id = target.target_id
  left join public.question_misconception_baselines as baseline
    on baseline.question_id = target.target_id
  where (select public.current_user_is_admin())

  union all

  select
    target.target_type,
    target.target_id,
    target.question_id,
    target.review_count,
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(vote.id, vote.votes order by vote.id)
        from answer_removed as vote
        where vote.target_id = target.target_id
      ),
      '{}'::jsonb
    ),
    coalesce(
      (
        select pg_catalog.jsonb_object_agg(vote.id, vote.votes order by vote.id)
        from answer_added as vote
        where vote.target_id = target.target_id
      ),
      '{}'::jsonb
    ),
    published.misconception_ids,
    published.published_at,
    baseline.misconception_ids,
    baseline.synced_at
  from answer_targets as target
  left join public.answer_misconception_overrides as published
    on published.answer_id = target.target_id
  left join public.answer_misconception_baselines as baseline
    on baseline.answer_id = target.target_id
  where (select public.current_user_is_admin());
$$;


ALTER FUNCTION "public"."get_admin_review_consensus"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_review_lifecycle"() RETURNS TABLE("review_type" "text", "review_id" "uuid", "last_event_type" "text", "last_event_at" timestamp with time zone, "edited" boolean, "last_deleted_at" timestamp with time zone, "last_deleted_before" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  with events as (
    select
      log.review_type,
      log.review_id,
      log.event_type,
      log.occurred_at,
      log.before_data
    from public.review_audit_log log
    where (select public.current_user_is_admin())
  ),
  last_start as (
    select
      events.review_id,
      pg_catalog.max(events.occurred_at) as started_at
    from events
    where events.event_type in ('created', 'reactivated')
    group by events.review_id
  ),
  last_event as (
    select distinct on (events.review_id)
      events.review_id,
      events.review_type,
      events.event_type,
      events.occurred_at
    from events
    order by events.review_id, events.occurred_at desc, events.event_type
  ),
  last_deleted as (
    select distinct on (events.review_id)
      events.review_id,
      events.occurred_at as deleted_at,
      events.before_data as deleted_before
    from events
    where events.event_type = 'deleted'
    order by events.review_id, events.occurred_at desc
  )
  select
    last_event.review_type,
    last_event.review_id,
    last_event.event_type as last_event_type,
    last_event.occurred_at as last_event_at,
    exists (
      select 1
      from events edit_event
      where edit_event.review_id = last_event.review_id
        and edit_event.event_type = 'edited'
        and edit_event.occurred_at >= coalesce(last_start.started_at, edit_event.occurred_at)
    ) as edited,
    last_deleted.deleted_at as last_deleted_at,
    last_deleted.deleted_before as last_deleted_before
  from last_event
  left join last_start on last_start.review_id = last_event.review_id
  left join last_deleted on last_deleted.review_id = last_event.review_id;
$$;


ALTER FUNCTION "public"."get_admin_review_lifecycle"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_admin_reviewer_profiles"("input_reviewer_ids" "uuid"[]) RETURNS TABLE("user_id" "uuid", "full_name" "text", "email" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_admin_reviewer_profiles"("input_reviewer_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_answer_review_counts"() RETURNS TABLE("answer_id" "text", "review_count" integer, "latest_updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    review.answer_id,
    pg_catalog.count(distinct review.reviewer_id)::integer,
    pg_catalog.max(review.updated_at)
  from public.answer_reviews review
  join public.answer_misconception_baselines baseline
    on baseline.answer_id = review.answer_id
   and baseline.source_version = review.source_version
  where review.is_active = true
    and exists (
      select 1
      from public.lecturer_profiles profile
      where profile.user_id = (select auth.uid())
        and profile.active = true
    )
  group by review.answer_id;
$$;


ALTER FUNCTION "public"."get_answer_review_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_review_status"() RETURNS TABLE("question_ids" "text"[], "answer_ids" "text"[], "question_review_count" integer, "answer_review_count" integer, "latest_updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE
    SET "search_path" TO ''
    AS $$
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
      and is_active = true
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
      and is_active = true
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


ALTER FUNCTION "public"."get_my_review_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_published_master_overrides"() RETURNS TABLE("question_content_overrides" "jsonb", "answer_content_overrides" "jsonb", "question_misconception_overrides" "jsonb", "answer_misconception_overrides" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'question_id', item.question_id,
            'question_ind', item.question_ind,
            'question_en', item.question_en,
            'question_code', item.question_code,
            'updated_at', item.updated_at
          )
          order by item.question_id
        )
        from public.question_content_overrides as item
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'answer_id', item.answer_id,
            'answer_text', item.answer_text,
            'updated_at', item.updated_at
          )
          order by item.answer_id
        )
        from public.answer_content_overrides as item
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'question_id', item.question_id,
            'misconception_ids', item.misconception_ids,
            'published_at', item.published_at,
            'updated_at', item.updated_at
          )
          order by item.question_id
        )
        from public.question_misconception_overrides as item
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select pg_catalog.jsonb_agg(
          pg_catalog.jsonb_build_object(
            'answer_id', item.answer_id,
            'question_id', item.question_id,
            'misconception_ids', item.misconception_ids,
            'published_at', item.published_at,
            'updated_at', item.updated_at
          )
          order by item.answer_id
        )
        from public.answer_misconception_overrides as item
      ),
      '[]'::jsonb
    );
$$;


ALTER FUNCTION "public"."get_published_master_overrides"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_question_review_counts"() RETURNS TABLE("question_id" "text", "review_count" integer, "latest_updated_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select
    review.question_id,
    pg_catalog.count(distinct review.reviewer_id)::integer as review_count,
    pg_catalog.max(review.updated_at) as latest_updated_at
  from public.question_reviews review
  join public.question_misconception_baselines baseline
    on baseline.question_id = review.question_id
   and baseline.source_version = review.source_version
  where review.is_active = true
    and exists (
      select 1
      from public.lecturer_profiles profile
      where profile.user_id = (select auth.uid())
        and profile.active = true
    )
  group by review.question_id;
$$;


ALTER FUNCTION "public"."get_question_review_counts"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_review_source_versions"() RETURNS TABLE("target_type" "text", "target_id" "text", "parent_question_id" "text", "source_version" "text")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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


ALTER FUNCTION "public"."get_review_source_versions"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_lecturer_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  normalized_email text;
  current_profile_email text;
  allowed_name text;
  allowed_active boolean;
  requested_name text;
begin
  normalized_email := lower(btrim(coalesce(new.email, '')));

  select lower(btrim(profile.email))
    into current_profile_email
  from public.lecturer_profiles as profile
  where profile.user_id = new.id;

  -- Do not rewrite or revoke an unchanged legacy lecturer account.
  if current_profile_email is not null
    and current_profile_email = normalized_email then
    return new;
  end if;

  if not public.is_telkom_lecturer_email(normalized_email) then
    raise exception 'LECTURER_EMAIL_DOMAIN_NOT_ALLOWED';
  end if;

  -- Signup may create auth.users before the confirmation link is opened.
  if new.email_confirmed_at is null then
    return new;
  end if;

  -- A domain-approved account starts as an ordinary lecturer. Existing rows,
  -- including manually assigned admins, win on conflict and are not changed.
  insert into public.lecturer_allowlist (
    email,
    full_name,
    active,
    is_admin
  )
  values (
    normalized_email,
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    true,
    false
  )
  on conflict do nothing;

  select nullif(btrim(item.full_name), ''), item.active
    into allowed_name, allowed_active
  from public.lecturer_allowlist as item
  where lower(btrim(item.email)) = normalized_email
  limit 1;

  -- Preserve an explicit deactivation in the existing allowlist.
  if allowed_active is distinct from true then
    if current_profile_email is not null then
      update public.lecturer_profiles
      set
        email = normalized_email,
        active = false,
        updated_at = now()
      where user_id = new.id;
    end if;

    return new;
  end if;

  requested_name := nullif(
    btrim(new.raw_user_meta_data ->> 'full_name'),
    ''
  );

  insert into public.lecturer_profiles (
    user_id,
    email,
    full_name,
    active
  )
  values (
    new.id,
    normalized_email,
    coalesce(
      requested_name,
      allowed_name,
      split_part(normalized_email, '@', 1)
    ),
    true
  )
  on conflict (user_id) do update
  set
    email = excluded.email,
    active = true,
    updated_at = now();

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_lecturer_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_telkom_lecturer_email"("input_email" "text") RETURNS boolean
    LANGUAGE "sql" IMMUTABLE PARALLEL SAFE
    SET "search_path" TO ''
    AS $_$
  select lower(btrim(coalesce(input_email, '')))
    ~ '^[^@[:space:]]+@telkomuniversity[.]ac[.]id$';
$_$;


ALTER FUNCTION "public"."is_telkom_lecturer_email"("input_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_review_audit"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  audit_event text;
  audit_review_type text;
  audit_review_id uuid;
  audit_reviewer_id uuid;
  audit_target_id text;
  audit_question_id text;
  audit_source_version uuid;
begin
  audit_review_type :=
    case TG_TABLE_NAME
      when 'question_reviews' then 'question'
      when 'answer_reviews' then 'answer'
      else null
    end;

  if audit_review_type is null then
    raise exception 'UNSUPPORTED_REVIEW_AUDIT_TABLE';
  end if;

  if TG_OP = 'INSERT' then
    audit_event := 'created';

    audit_review_id := new.id;
    audit_reviewer_id := new.reviewer_id;

    audit_target_id :=
      case
        when audit_review_type = 'question'
          then new.question_id
        else (pg_catalog.to_jsonb(NEW) ->> 'answer_id')
      end;

    audit_question_id := new.question_id;
    audit_source_version := new.source_version;

    insert into public.review_audit_log (
      review_type,
      review_id,
      reviewer_id,
      target_id,
      question_id,
      source_version,
      event_type,
      before_data,
      after_data
    )
    values (
      audit_review_type,
      audit_review_id,
      audit_reviewer_id,
      audit_target_id,
      audit_question_id,
      audit_source_version,
      audit_event,
      null,
      to_jsonb(new)
    );

    return new;
  end if;


  if TG_OP = 'UPDATE' then
    if old.is_active = true
      and new.is_active = false
      and new.inactive_reason = 'deleted'
    then
      audit_event := 'deleted';

    elsif old.is_active = true
      and new.is_active = false
      and new.inactive_reason = 'source_updated'
    then
      audit_event := 'source_updated';

    elsif old.is_active = false
      and new.is_active = true
    then
      audit_event := 'reactivated';

    else
      audit_event := 'edited';
    end if;

    audit_review_id := new.id;
    audit_reviewer_id := new.reviewer_id;

    audit_target_id :=
      case
        when audit_review_type = 'question'
          then new.question_id
        else (pg_catalog.to_jsonb(NEW) ->> 'answer_id')
      end;

    audit_question_id := new.question_id;
    audit_source_version := new.source_version;

    insert into public.review_audit_log (
      review_type,
      review_id,
      reviewer_id,
      target_id,
      question_id,
      source_version,
      event_type,
      before_data,
      after_data
    )
    values (
      audit_review_type,
      audit_review_id,
      audit_reviewer_id,
      audit_target_id,
      audit_question_id,
      audit_source_version,
      audit_event,
      to_jsonb(old),
      to_jsonb(new)
    );

    return new;
  end if;


  if TG_OP = 'DELETE' then
    audit_event := 'hard_deleted';

    audit_review_id := old.id;
    audit_reviewer_id := old.reviewer_id;

    audit_target_id :=
      case
        when audit_review_type = 'question'
          then old.question_id
        else (pg_catalog.to_jsonb(OLD) ->> 'answer_id')
      end;

    audit_question_id := old.question_id;
    audit_source_version := old.source_version;

    insert into public.review_audit_log (
      review_type,
      review_id,
      reviewer_id,
      target_id,
      question_id,
      source_version,
      event_type,
      before_data,
      after_data
    )
    values (
      audit_review_type,
      audit_review_id,
      audit_reviewer_id,
      audit_target_id,
      audit_question_id,
      audit_source_version,
      audit_event,
      to_jsonb(old),
      null
    );

    return old;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."log_review_audit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_lecturer_email"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.email = lower(btrim(new.email));
  return new;
end;
$$;


ALTER FUNCTION "public"."normalize_lecturer_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_text_id_array"("input_values" "text"[]) RETURNS "text"[]
    LANGUAGE "sql" IMMUTABLE
    SET "search_path" TO ''
    AS $$
  select coalesce(
    array_agg(distinct pg_catalog.btrim(value) order by pg_catalog.btrim(value)),
    '{}'::text[]
  )
  from pg_catalog.unnest(coalesce(input_values, '{}'::text[])) as item(value)
  where pg_catalog.length(pg_catalog.btrim(value)) > 0;
$$;


ALTER FUNCTION "public"."normalize_text_id_array"("input_values" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_repeat_lecturer_review_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  if (select auth.uid()) = old.reviewer_id then
    raise exception using
      message = 'REVIEW_ALREADY_SUBMITTED',
      errcode = 'P0001';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."prevent_repeat_lecturer_review_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_answer_misconception_override"("input_answer_id" "text") RETURNS TABLE("answer_id" "text", "question_id" "text", "misconception_ids" "text"[], "source_review_count" integer, "published_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  normalized_answer_id text := pg_catalog.btrim(input_answer_id);
  normalized_question_id text;
  baseline_ids text[];
  reviewer_count integer;
  reviewed_question_id text;
  reviewed_question_count integer;
  removed_ids text[];
  added_ids text[];
  invalid_added_id text;
  final_ids text[];
begin
  if not exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_answer_id) = 0 then
    raise exception using message = 'INVALID_TARGET_ID', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('answer_review:' || normalized_answer_id, 0)
  );

  select baseline.question_id, baseline.misconception_ids
    into normalized_question_id, baseline_ids
  from public.answer_misconception_baselines as baseline
  where baseline.answer_id = normalized_answer_id;

  if not found then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  select
    pg_catalog.count(distinct review.reviewer_id)::integer,
    pg_catalog.min(review.question_id),
    pg_catalog.count(distinct review.question_id)::integer
    into reviewer_count, reviewed_question_id, reviewed_question_count
  from public.answer_reviews as review
  where review.answer_id = normalized_answer_id;

  if reviewer_count <> 3 then
    raise exception using message = 'CONSENSUS_REQUIRES_THREE_REVIEWERS', errcode = 'P0001';
  end if;

  if reviewed_question_count <> 1
    or reviewed_question_id is distinct from normalized_question_id then
    raise exception using message = 'ANSWER_QUESTION_MISMATCH', errcode = '22023';
  end if;

  select
    public.normalize_text_id_array(
      array(
        select pg_catalog.btrim(value.id)
        from public.answer_reviews as review
        cross join lateral pg_catalog.unnest(
          review.removed_misconception_ids
        ) as value(id)
        where review.answer_id = normalized_answer_id
          and review.has_mismatched_misconceptions
          and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
        group by pg_catalog.btrim(value.id)
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      )
    ),
    public.normalize_text_id_array(
      array(
        select pg_catalog.btrim(value.id)
        from public.answer_reviews as review
        cross join lateral pg_catalog.unnest(
          review.additional_misconception_ids
        ) as value(id)
        where review.answer_id = normalized_answer_id
          and review.has_additional_misconceptions
          and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
        group by pg_catalog.btrim(value.id)
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      )
    )
  into removed_ids, added_ids;

  select added.id
    into invalid_added_id
  from pg_catalog.unnest(added_ids) as added(id)
  where not exists (
    select 1
    from public.master_misconception_catalog as catalog
    where catalog.misconception_id = added.id
  )
  limit 1;

  if invalid_added_id is not null then
    raise exception using message = 'INVALID_MISCONCEPTION_ID', errcode = '22023';
  end if;

  select public.normalize_text_id_array(
    array(
      select baseline.id
      from pg_catalog.unnest(baseline_ids) as baseline(id)
      where not (baseline.id = any(removed_ids))
      union
      select added.id from pg_catalog.unnest(added_ids) as added(id)
    )
  ) into final_ids;

  insert into public.answer_misconception_overrides (
    answer_id,
    question_id,
    misconception_ids,
    source_review_count,
    published_by,
    published_at
  )
  values (
    normalized_answer_id,
    normalized_question_id,
    final_ids,
    reviewer_count,
    (select auth.uid()),
    pg_catalog.now()
  )
  on conflict on constraint answer_misconception_overrides_pkey do update
  set
    question_id = excluded.question_id,
    misconception_ids = excluded.misconception_ids,
    source_review_count = excluded.source_review_count,
    published_by = excluded.published_by,
    published_at = excluded.published_at
  returning
    answer_misconception_overrides.answer_id,
    answer_misconception_overrides.question_id,
    answer_misconception_overrides.misconception_ids,
    answer_misconception_overrides.source_review_count,
    answer_misconception_overrides.published_at,
    answer_misconception_overrides.updated_at
  into answer_id, question_id, misconception_ids, source_review_count, published_at, updated_at;

  return next;
end;
$$;


ALTER FUNCTION "public"."publish_answer_misconception_override"("input_answer_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."publish_question_misconception_override"("input_question_id" "text") RETURNS TABLE("question_id" "text", "misconception_ids" "text"[], "source_review_count" integer, "published_at" timestamp with time zone, "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  normalized_question_id text := pg_catalog.btrim(input_question_id);
  reviewer_count integer;
  baseline_ids text[];
  removed_ids text[];
  added_ids text[];
  invalid_added_id text;
  final_ids text[];
begin
  if not exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_question_id) = 0 then
    raise exception using message = 'INVALID_TARGET_ID', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('question_review:' || normalized_question_id, 0)
  );

  select baseline.misconception_ids
    into baseline_ids
  from public.question_misconception_baselines as baseline
  where baseline.question_id = normalized_question_id;

  if not found then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  select pg_catalog.count(distinct review.reviewer_id)::integer
    into reviewer_count
  from public.question_reviews as review
  where review.question_id = normalized_question_id;

  if reviewer_count <> 3 then
    raise exception using message = 'CONSENSUS_REQUIRES_THREE_REVIEWERS', errcode = 'P0001';
  end if;

  select
    public.normalize_text_id_array(
      array(
        select pg_catalog.btrim(value.id)
        from public.question_reviews as review
        cross join lateral pg_catalog.unnest(
          review.removed_misconception_ids
        ) as value(id)
        where review.question_id = normalized_question_id
          and review.has_incorrect_misconceptions
          and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
        group by pg_catalog.btrim(value.id)
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      )
    ),
    public.normalize_text_id_array(
      array(
        select pg_catalog.btrim(value.id)
        from public.question_reviews as review
        cross join lateral pg_catalog.unnest(
          review.additional_misconception_ids
        ) as value(id)
        where review.question_id = normalized_question_id
          and review.has_additional_misconceptions
          and pg_catalog.length(pg_catalog.btrim(value.id)) > 0
        group by pg_catalog.btrim(value.id)
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      )
    )
  into removed_ids, added_ids;

  select added.id
    into invalid_added_id
  from pg_catalog.unnest(added_ids) as added(id)
  where not exists (
    select 1
    from public.master_misconception_catalog as catalog
    where catalog.misconception_id = added.id
  )
  limit 1;

  if invalid_added_id is not null then
    raise exception using message = 'INVALID_MISCONCEPTION_ID', errcode = '22023';
  end if;

  select public.normalize_text_id_array(
    array(
      select baseline.id
      from pg_catalog.unnest(baseline_ids) as baseline(id)
      where not (baseline.id = any(removed_ids))
      union
      select added.id from pg_catalog.unnest(added_ids) as added(id)
    )
  ) into final_ids;

  insert into public.question_misconception_overrides (
    question_id,
    misconception_ids,
    source_review_count,
    published_by,
    published_at
  )
  values (
    normalized_question_id,
    final_ids,
    reviewer_count,
    (select auth.uid()),
    pg_catalog.now()
  )
  on conflict on constraint question_misconception_overrides_pkey do update
  set
    misconception_ids = excluded.misconception_ids,
    source_review_count = excluded.source_review_count,
    published_by = excluded.published_by,
    published_at = excluded.published_at
  returning
    question_misconception_overrides.question_id,
    question_misconception_overrides.misconception_ids,
    question_misconception_overrides.source_review_count,
    question_misconception_overrides.published_at,
    question_misconception_overrides.updated_at
  into question_id, misconception_ids, source_review_count, published_at, updated_at;

  return next;
end;
$$;


ALTER FUNCTION "public"."publish_question_misconception_override"("input_question_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_answer_review_consensus_v3"("p_answer_id" "text", "p_source_version" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_version uuid;
  parent_question_id text;
  baseline_ids text[];
  active_count integer;
  effective_ids text[];
  now_time timestamptz := pg_catalog.now();
begin
  select
    baseline.source_version,
    baseline.question_id,
    baseline.misconception_ids
  into
    current_version,
    parent_question_id,
    baseline_ids
  from public.answer_misconception_baselines baseline
  where baseline.answer_id = p_answer_id
  for update;

  if not found then
    raise exception using
      message = 'ANSWER_NOT_FOUND',
      errcode = 'P0001';
  end if;

  if current_version is distinct from p_source_version then
    raise exception using
      message = 'DATA_VERSION_CHANGED',
      errcode = 'P0001';
  end if;

  baseline_ids := public.normalize_text_id_array(baseline_ids);

  select pg_catalog.count(*)::integer
  into active_count
  from public.answer_reviews review
  where review.answer_id = p_answer_id
    and review.source_version = current_version
    and review.is_active = true;

  if active_count > 3 then
    raise exception using
      message = 'REVIEW_CAP_INVARIANT_BROKEN',
      errcode = 'P0001';
  end if;

  if active_count < 3 then
    delete from public.answer_misconception_overrides override_row
    where override_row.answer_id = p_answer_id;

    return pg_catalog.jsonb_build_object(
      'active_review_count', active_count,
      'effective_source', 'master',
      'effective_misconception_ids', baseline_ids
    );
  end if;

  select public.normalize_text_id_array(
    array(
      select candidate.misconception_id
      from (
        select baseline_id as misconception_id
        from pg_catalog.unnest(baseline_ids) baseline_id
        where not exists (
          select 1
          from (
            select removed_id
            from public.answer_reviews review
            cross join lateral pg_catalog.unnest(
              review.removed_misconception_ids
            ) removed_id
            where review.answer_id = p_answer_id
              and review.source_version = current_version
              and review.is_active = true
            group by removed_id
            having pg_catalog.count(distinct review.reviewer_id) >= 2
          ) majority_removed
          where majority_removed.removed_id = baseline_id
        )

        union

        select added_id as misconception_id
        from public.answer_reviews review
        cross join lateral pg_catalog.unnest(
          review.additional_misconception_ids
        ) added_id
        where review.answer_id = p_answer_id
          and review.source_version = current_version
          and review.is_active = true
        group by added_id
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      ) candidate
    )
  )
  into effective_ids;

  delete from public.answer_misconception_overrides override_row
  where override_row.answer_id = p_answer_id;

  insert into public.answer_misconception_overrides (
    answer_id,
    question_id,
    misconception_ids,
    source_review_count,
    published_by,
    published_at,
    updated_at,
    source_version
  )
  values (
    p_answer_id,
    parent_question_id,
    effective_ids,
    3,
    null,
    now_time,
    now_time,
    current_version
  );

  return pg_catalog.jsonb_build_object(
    'active_review_count', 3,
    'effective_source', 'review_consensus',
    'effective_misconception_ids', effective_ids
  );
end;
$$;


ALTER FUNCTION "public"."recompute_answer_review_consensus_v3"("p_answer_id" "text", "p_source_version" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recompute_question_review_consensus_v3"("p_question_id" "text", "p_source_version" "uuid") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  current_version uuid;
  baseline_ids text[];
  active_count integer;
  effective_ids text[];
  now_time timestamptz := pg_catalog.now();
begin
  select
    baseline.source_version,
    baseline.misconception_ids
  into
    current_version,
    baseline_ids
  from public.question_misconception_baselines baseline
  where baseline.question_id = p_question_id
  for update;

  if not found then
    raise exception using
      message = 'QUESTION_NOT_FOUND',
      errcode = 'P0001';
  end if;

  if current_version is distinct from p_source_version then
    raise exception using
      message = 'DATA_VERSION_CHANGED',
      errcode = 'P0001';
  end if;

  baseline_ids := public.normalize_text_id_array(baseline_ids);

  select pg_catalog.count(*)::integer
  into active_count
  from public.question_reviews review
  where review.question_id = p_question_id
    and review.source_version = current_version
    and review.is_active = true;

  if active_count > 3 then
    raise exception using
      message = 'REVIEW_CAP_INVARIANT_BROKEN',
      errcode = 'P0001';
  end if;

  if active_count < 3 then
    delete from public.question_misconception_overrides override_row
    where override_row.question_id = p_question_id;

    return pg_catalog.jsonb_build_object(
      'active_review_count', active_count,
      'effective_source', 'master',
      'effective_misconception_ids', baseline_ids
    );
  end if;

  select public.normalize_text_id_array(
    array(
      select candidate.misconception_id
      from (
        -- Keep baseline misconceptions unless at least 2 reviewers remove them.
        select baseline_id as misconception_id
        from pg_catalog.unnest(baseline_ids) baseline_id
        where not exists (
          select 1
          from (
            select removed_id
            from public.question_reviews review
            cross join lateral pg_catalog.unnest(
              review.removed_misconception_ids
            ) removed_id
            where review.question_id = p_question_id
              and review.source_version = current_version
              and review.is_active = true
            group by removed_id
            having pg_catalog.count(distinct review.reviewer_id) >= 2
          ) majority_removed
          where majority_removed.removed_id = baseline_id
        )

        union

        -- Add a non-baseline misconception when at least 2 reviewers add it.
        select added_id as misconception_id
        from public.question_reviews review
        cross join lateral pg_catalog.unnest(
          review.additional_misconception_ids
        ) added_id
        where review.question_id = p_question_id
          and review.source_version = current_version
          and review.is_active = true
        group by added_id
        having pg_catalog.count(distinct review.reviewer_id) >= 2
      ) candidate
    )
  )
  into effective_ids;

  delete from public.question_misconception_overrides override_row
  where override_row.question_id = p_question_id;

  insert into public.question_misconception_overrides (
    question_id,
    misconception_ids,
    source_review_count,
    published_by,
    published_at,
    updated_at,
    source_version
  )
  values (
    p_question_id,
    effective_ids,
    3,
    null,
    now_time,
    now_time,
    current_version
  );

  return pg_catalog.jsonb_build_object(
    'active_review_count', 3,
    'effective_source', 'review_consensus',
    'effective_misconception_ids', effective_ids
  );
end;
$$;


ALTER FUNCTION "public"."recompute_question_review_consensus_v3"("p_question_id" "text", "p_source_version" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_answer_content_override"("input_answer_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid()) and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  delete from public.answer_content_overrides
  where answer_id = pg_catalog.btrim(input_answer_id);
  return found;
end;
$$;


ALTER FUNCTION "public"."reset_answer_content_override"("input_answer_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_answer_misconception_override"("input_answer_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid()) and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  delete from public.answer_misconception_overrides
  where answer_id = pg_catalog.btrim(input_answer_id);
  return found;
end;
$$;


ALTER FUNCTION "public"."reset_answer_misconception_override"("input_answer_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_question_content_override"("input_question_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid()) and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  delete from public.question_content_overrides
  where question_id = pg_catalog.btrim(input_question_id);
  return found;
end;
$$;


ALTER FUNCTION "public"."reset_question_content_override"("input_question_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_question_misconception_override"("input_question_id" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  if not exists (
    select 1 from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid()) and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  delete from public.question_misconception_overrides
  where question_id = pg_catalog.btrim(input_question_id);
  return found;
end;
$$;


ALTER FUNCTION "public"."reset_question_misconception_override"("input_question_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_answer_content_override"("input_answer_id" "text", "input_answer_text" "text") RETURNS TABLE("answer_id" "text", "answer_text" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  normalized_answer_id text := pg_catalog.btrim(input_answer_id);
begin
  if not exists (
    select 1 from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid()) and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_answer_id) = 0
    or pg_catalog.length(pg_catalog.btrim(input_answer_text)) = 0 then
    raise exception using message = 'INVALID_ANSWER_CONTENT', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  if not exists (
    select 1
    from public.answer_misconception_baselines as baseline
    where baseline.answer_id = normalized_answer_id
  ) then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  insert into public.answer_content_overrides (
    answer_id, answer_text, updated_by
  )
  values (
    normalized_answer_id,
    input_answer_text,
    (select auth.uid())
  )
  on conflict on constraint answer_content_overrides_pkey do update
  set answer_text = excluded.answer_text, updated_by = excluded.updated_by
  returning
    answer_content_overrides.answer_id,
    answer_content_overrides.answer_text,
    answer_content_overrides.updated_at
  into answer_id, answer_text, updated_at;

  return next;
end;
$$;


ALTER FUNCTION "public"."save_answer_content_override"("input_answer_id" "text", "input_answer_text" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_answer_review_v3"("p_answer_id" "text", "p_source_version" "uuid", "p_has_mismatched_misconceptions" boolean, "p_removed_misconception_ids" "text"[], "p_removal_reason" "text", "p_has_additional_misconceptions" boolean, "p_additional_misconception_ids" "text"[], "p_addition_reason" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  caller_id uuid := auth.uid();
  target_id text := pg_catalog.btrim(coalesce(p_answer_id, ''));
  current_version uuid;
  parent_question_id text;
  baseline_ids text[];
  removed_ids text[];
  added_ids text[];
  existing_review public.answer_reviews%rowtype;
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
    or p_has_mismatched_misconceptions is null
    or p_has_additional_misconceptions is null
  then
    raise exception using message = 'INVALID_REVIEW_INPUT', errcode = '22023';
  end if;

  select
    baseline.source_version,
    baseline.question_id,
    baseline.misconception_ids
  into
    current_version,
    parent_question_id,
    baseline_ids
  from public.answer_misconception_baselines baseline
  where baseline.answer_id = target_id
  for update;

  if not found then
    raise exception using message = 'ANSWER_NOT_FOUND', errcode = 'P0001';
  end if;

  if current_version is distinct from p_source_version then
    raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
  end if;

  baseline_ids := public.normalize_text_id_array(baseline_ids);
  removed_ids := case
    when p_has_mismatched_misconceptions then
      public.normalize_text_id_array(p_removed_misconception_ids)
    else array[]::text[]
  end;
  added_ids := case
    when p_has_additional_misconceptions then
      public.normalize_text_id_array(p_additional_misconception_ids)
    else array[]::text[]
  end;

  if p_has_mismatched_misconceptions
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

  if not (removed_ids <@ baseline_ids) then
    raise exception using message = 'REMOVAL_NOT_IN_BASELINE', errcode = '22023';
  end if;

  if added_ids && baseline_ids then
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
  from public.answer_reviews review
  where review.reviewer_id = caller_id
    and review.answer_id = target_id
    and review.source_version = current_version
  for update;

  if found then
    if existing_review.is_active = false then
      if existing_review.inactive_reason = 'source_updated' then
        raise exception using message = 'DATA_VERSION_CHANGED', errcode = 'P0001';
      end if;

      select pg_catalog.count(*)::integer
      into active_count
      from public.answer_reviews review
      where review.answer_id = target_id
        and review.source_version = current_version
        and review.is_active = true;

      if active_count >= 3 then
        raise exception using message = 'REVIEWER_CAP_REACHED', errcode = 'P0001';
      end if;
    end if;

    update public.answer_reviews
    set
      question_id = parent_question_id,
      has_mismatched_misconceptions = p_has_mismatched_misconceptions,
      removed_misconception_ids = removed_ids,
      removal_reason = case
        when p_has_mismatched_misconceptions then nullif(pg_catalog.btrim(p_removal_reason), '')
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
    from public.answer_reviews review
    where review.answer_id = target_id
      and review.source_version = current_version
      and review.is_active = true;

    if active_count >= 3 then
      raise exception using message = 'REVIEWER_CAP_REACHED', errcode = 'P0001';
    end if;

    insert into public.answer_reviews (
      reviewer_id,
      answer_id,
      question_id,
      has_mismatched_misconceptions,
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
      parent_question_id,
      p_has_mismatched_misconceptions,
      removed_ids,
      case
        when p_has_mismatched_misconceptions then nullif(pg_catalog.btrim(p_removal_reason), '')
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

  consensus := public.recompute_answer_review_consensus_v3(
    target_id,
    current_version
  );

  return pg_catalog.jsonb_build_object(
    'review_id', review_id,
    'answer_id', target_id,
    'question_id', parent_question_id,
    'source_version', current_version,
    'is_active', true,
    'consensus', consensus
  );
end;
$$;


ALTER FUNCTION "public"."save_answer_review_v3"("p_answer_id" "text", "p_source_version" "uuid", "p_has_mismatched_misconceptions" boolean, "p_removed_misconception_ids" "text"[], "p_removal_reason" "text", "p_has_additional_misconceptions" boolean, "p_additional_misconception_ids" "text"[], "p_addition_reason" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_question_content_override"("input_question_id" "text", "input_question_ind" "text", "input_question_en" "text", "input_question_code" "text") RETURNS TABLE("question_id" "text", "question_ind" "text", "question_en" "text", "question_code" "text", "updated_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  normalized_question_id text := pg_catalog.btrim(input_question_id);
begin
  if not exists (
    select 1 from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid()) and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.length(normalized_question_id) = 0
    or (
      pg_catalog.length(pg_catalog.btrim(coalesce(input_question_ind, ''))) = 0
      and pg_catalog.length(pg_catalog.btrim(coalesce(input_question_en, ''))) = 0
      and pg_catalog.length(pg_catalog.btrim(coalesce(input_question_code, ''))) = 0
    ) then
    raise exception using message = 'INVALID_QUESTION_CONTENT', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  if not exists (
    select 1
    from public.question_misconception_baselines as baseline
    where baseline.question_id = normalized_question_id
  ) then
    raise exception using message = 'BASELINE_NOT_SYNCED', errcode = 'P0001';
  end if;

  insert into public.question_content_overrides (
    question_id, question_ind, question_en, question_code, updated_by
  )
  values (
    normalized_question_id,
    input_question_ind,
    input_question_en,
    input_question_code,
    (select auth.uid())
  )
  on conflict on constraint question_content_overrides_pkey do update
  set
    question_ind = excluded.question_ind,
    question_en = excluded.question_en,
    question_code = excluded.question_code,
    updated_by = excluded.updated_by
  returning
    question_content_overrides.question_id,
    question_content_overrides.question_ind,
    question_content_overrides.question_en,
    question_content_overrides.question_code,
    question_content_overrides.updated_at
  into question_id, question_ind, question_en, question_code, updated_at;

  return next;
end;
$$;


ALTER FUNCTION "public"."save_question_content_override"("input_question_id" "text", "input_question_ind" "text", "input_question_en" "text", "input_question_code" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_question_review_v3"("p_question_id" "text", "p_source_version" "uuid", "p_has_incorrect_misconceptions" boolean, "p_removed_misconception_ids" "text"[], "p_removal_reason" "text", "p_has_additional_misconceptions" boolean, "p_additional_misconception_ids" "text"[], "p_addition_reason" "text", "p_note" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
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
$$;


ALTER FUNCTION "public"."save_question_review_v3"("p_question_id" "text", "p_source_version" "uuid", "p_has_incorrect_misconceptions" boolean, "p_removed_misconception_ids" "text"[], "p_removal_reason" "text", "p_has_additional_misconceptions" boolean, "p_additional_misconception_ids" "text"[], "p_addition_reason" "text", "p_note" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_master_relation_baselines"("input_question_baselines" "jsonb", "input_answer_baselines" "jsonb", "input_misconception_ids" "text"[]) RETURNS TABLE("question_count" integer, "answer_count" integer, "misconception_count" integer, "synced_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  normalized_misconception_ids text[] :=
    public.normalize_text_id_array(input_misconception_ids);
begin
  if not exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  ) or not (select public.current_user_is_admin()) then
    raise exception using message = 'ADMIN_ACCESS_REQUIRED', errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(input_question_baselines) is distinct from 'array'
    or pg_catalog.jsonb_typeof(input_answer_baselines) is distinct from 'array' then
    raise exception using message = 'INVALID_BASELINE_INPUT', errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_question_baselines) as item(value)
    where pg_catalog.jsonb_typeof(item.value) is distinct from 'object'
      or pg_catalog.jsonb_typeof(item.value -> 'question_id') is distinct from 'string'
      or pg_catalog.length(pg_catalog.btrim(item.value ->> 'question_id')) = 0
      or pg_catalog.jsonb_typeof(item.value -> 'misconception_ids') is distinct from 'array'
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_answer_baselines) as item(value)
    where pg_catalog.jsonb_typeof(item.value) is distinct from 'object'
      or pg_catalog.jsonb_typeof(item.value -> 'answer_id') is distinct from 'string'
      or pg_catalog.length(pg_catalog.btrim(item.value ->> 'answer_id')) = 0
      or pg_catalog.jsonb_typeof(item.value -> 'question_id') is distinct from 'string'
      or pg_catalog.length(pg_catalog.btrim(item.value ->> 'question_id')) = 0
      or pg_catalog.jsonb_typeof(item.value -> 'misconception_ids') is distinct from 'array'
  ) then
    raise exception using message = 'INVALID_BASELINE_INPUT', errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_question_baselines) as item(value)
    cross join lateral pg_catalog.jsonb_array_elements(
      item.value -> 'misconception_ids'
    ) as relation(value)
    where pg_catalog.jsonb_typeof(relation.value) is distinct from 'string'
  ) or exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_answer_baselines) as item(value)
    cross join lateral pg_catalog.jsonb_array_elements(
      item.value -> 'misconception_ids'
    ) as relation(value)
    where pg_catalog.jsonb_typeof(relation.value) is distinct from 'string'
  ) then
    raise exception using message = 'INVALID_BASELINE_INPUT', errcode = '22023';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(input_question_baselines)
  ) <> (
    select pg_catalog.count(distinct pg_catalog.btrim(item.value ->> 'question_id'))
    from pg_catalog.jsonb_array_elements(input_question_baselines) as item(value)
  ) or (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(input_answer_baselines)
  ) <> (
    select pg_catalog.count(distinct pg_catalog.btrim(item.value ->> 'answer_id'))
    from pg_catalog.jsonb_array_elements(input_answer_baselines) as item(value)
  ) then
    raise exception using message = 'DUPLICATE_BASELINE_TARGET', errcode = '22023';
  end if;

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_answer_baselines) as answer(value)
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(input_question_baselines) as question(value)
      where pg_catalog.btrim(question.value ->> 'question_id')
        = pg_catalog.btrim(answer.value ->> 'question_id')
    )
  ) then
    raise exception using message = 'ANSWER_QUESTION_MISMATCH', errcode = '22023';
  end if;

  if exists (
    select 1
    from (
      select pg_catalog.btrim(relation.value #>> '{}') as misconception_id
      from pg_catalog.jsonb_array_elements(input_question_baselines) as item(value)
      cross join lateral pg_catalog.jsonb_array_elements(
        item.value -> 'misconception_ids'
      ) as relation(value)
      union
      select pg_catalog.btrim(relation.value #>> '{}')
      from pg_catalog.jsonb_array_elements(input_answer_baselines) as item(value)
      cross join lateral pg_catalog.jsonb_array_elements(
        item.value -> 'misconception_ids'
      ) as relation(value)
    ) as relation
    where pg_catalog.length(relation.misconception_id) = 0
      or not (relation.misconception_id = any(normalized_misconception_ids))
  ) then
    raise exception using message = 'INVALID_MISCONCEPTION_ID', errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  delete from public.question_misconception_baselines where true;
  delete from public.answer_misconception_baselines where true;
  delete from public.master_misconception_catalog where true;

  synced_at := pg_catalog.now();

  insert into public.master_misconception_catalog (
    misconception_id,
    synced_by,
    synced_at
  )
  select id, (select auth.uid()), synced_at
  from pg_catalog.unnest(normalized_misconception_ids) as item(id);

  insert into public.question_misconception_baselines (
    question_id,
    misconception_ids,
    synced_by,
    synced_at
  )
  select
    pg_catalog.btrim(item.value ->> 'question_id'),
    public.normalize_text_id_array(
      array(
        select relation.value #>> '{}'
        from pg_catalog.jsonb_array_elements(
          item.value -> 'misconception_ids'
        ) as relation(value)
      )
    ),
    (select auth.uid()),
    synced_at
  from pg_catalog.jsonb_array_elements(input_question_baselines) as item(value);

  insert into public.answer_misconception_baselines (
    answer_id,
    question_id,
    misconception_ids,
    synced_by,
    synced_at
  )
  select
    pg_catalog.btrim(item.value ->> 'answer_id'),
    pg_catalog.btrim(item.value ->> 'question_id'),
    public.normalize_text_id_array(
      array(
        select relation.value #>> '{}'
        from pg_catalog.jsonb_array_elements(
          item.value -> 'misconception_ids'
        ) as relation(value)
      )
    ),
    (select auth.uid()),
    synced_at
  from pg_catalog.jsonb_array_elements(input_answer_baselines) as item(value);

  question_count := pg_catalog.jsonb_array_length(input_question_baselines);
  answer_count := pg_catalog.jsonb_array_length(input_answer_baselines);
  misconception_count := pg_catalog.cardinality(normalized_misconception_ids);
  return next;
end;
$$;


ALTER FUNCTION "public"."sync_master_relation_baselines"("input_question_baselines" "jsonb", "input_answer_baselines" "jsonb", "input_misconception_ids" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_master_relation_baselines_v2"("input_question_baselines" "jsonb", "input_answer_baselines" "jsonb", "input_misconception_ids" "text"[]) RETURNS TABLE("question_count" integer, "answer_count" integer, "misconception_count" integer, "question_versions_changed" integer, "answer_versions_changed" integer, "synced_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  sync_time timestamptz := pg_catalog.now();

  valid_misconception_ids text[] :=
    public.normalize_text_id_array(input_misconception_ids);

  item jsonb;

  target_question_id text;
  target_answer_id text;
  target_parent_question_id text;
  incoming_fingerprint text;
  incoming_ids text[];

  previous_version uuid;
  next_version uuid;
  previous_fingerprint text;
  previous_ids text[];

  changed_questions integer := 0;
  changed_answers integer := 0;

  removed_question record;
  removed_answer record;
begin
  -- Hanya backend/Edge Function terpercaya yang boleh menjalankan sync.
  if (select auth.role()) is distinct from 'service_role' then
    raise exception using
      message = 'SERVICE_ROLE_REQUIRED',
      errcode = 'P0001';
  end if;

  if pg_catalog.jsonb_typeof(input_question_baselines) is distinct from 'array'
    or pg_catalog.jsonb_typeof(input_answer_baselines) is distinct from 'array'
  then
    raise exception using
      message = 'INVALID_BASELINE_INPUT',
      errcode = '22023';
  end if;

  -- =======================================================
  -- Validasi question snapshot
  -- =======================================================

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_question_baselines) q(value)
    where pg_catalog.jsonb_typeof(q.value) is distinct from 'object'
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(q.value ->> 'question_id', ''))
       ) = 0
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(q.value ->> 'source_fingerprint', ''))
       ) = 0
       or pg_catalog.jsonb_typeof(
         q.value -> 'misconception_ids'
       ) is distinct from 'array'
  ) then
    raise exception using
      message = 'INVALID_QUESTION_BASELINE_INPUT',
      errcode = '22023';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(input_question_baselines)
  ) <> (
    select pg_catalog.count(
      distinct pg_catalog.btrim(q.value ->> 'question_id')
    )
    from pg_catalog.jsonb_array_elements(input_question_baselines) q(value)
  ) then
    raise exception using
      message = 'DUPLICATE_QUESTION_ID',
      errcode = '22023';
  end if;

  -- =======================================================
  -- Validasi answer snapshot
  -- =======================================================

  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_answer_baselines) a(value)
    where pg_catalog.jsonb_typeof(a.value) is distinct from 'object'
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(a.value ->> 'answer_id', ''))
       ) = 0
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(a.value ->> 'question_id', ''))
       ) = 0
       or pg_catalog.length(
         pg_catalog.btrim(coalesce(a.value ->> 'source_fingerprint', ''))
       ) = 0
       or pg_catalog.jsonb_typeof(
         a.value -> 'misconception_ids'
       ) is distinct from 'array'
  ) then
    raise exception using
      message = 'INVALID_ANSWER_BASELINE_INPUT',
      errcode = '22023';
  end if;

  if (
    select pg_catalog.count(*)
    from pg_catalog.jsonb_array_elements(input_answer_baselines)
  ) <> (
    select pg_catalog.count(
      distinct pg_catalog.btrim(a.value ->> 'answer_id')
    )
    from pg_catalog.jsonb_array_elements(input_answer_baselines) a(value)
  ) then
    raise exception using
      message = 'DUPLICATE_ANSWER_ID',
      errcode = '22023';
  end if;

  -- Jawaban harus mengarah ke soal yang ada di snapshot yang sama.
  if exists (
    select 1
    from pg_catalog.jsonb_array_elements(input_answer_baselines) a(value)
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(input_question_baselines) q(value)
      where pg_catalog.btrim(q.value ->> 'question_id')
        = pg_catalog.btrim(a.value ->> 'question_id')
    )
  ) then
    raise exception using
      message = 'ANSWER_QUESTION_MISMATCH',
      errcode = '22023';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('master_relation_baselines', 0)
  );

  -- =======================================================
  -- Target jawaban yang hilang dari master terbaru
  -- =======================================================

  for removed_answer in
    select
      baseline.answer_id,
      baseline.source_version
    from public.answer_misconception_baselines baseline
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(input_answer_baselines) a(value)
      where pg_catalog.btrim(a.value ->> 'answer_id')
        = baseline.answer_id
    )
  loop
    update public.answer_reviews
    set
      is_active = false,
      inactive_reason = 'source_updated',
      inactive_at = sync_time
    where answer_id = removed_answer.answer_id
      and is_active = true;

    delete from public.answer_misconception_overrides
    where answer_id = removed_answer.answer_id;

    delete from public.answer_misconception_baselines
    where answer_id = removed_answer.answer_id;

    changed_answers := changed_answers + 1;
  end loop;

  -- =======================================================
  -- Target soal yang hilang dari master terbaru
  -- =======================================================

  for removed_question in
    select
      baseline.question_id,
      baseline.source_version
    from public.question_misconception_baselines baseline
    where not exists (
      select 1
      from pg_catalog.jsonb_array_elements(input_question_baselines) q(value)
      where pg_catalog.btrim(q.value ->> 'question_id')
        = baseline.question_id
    )
  loop
    update public.question_reviews
    set
      is_active = false,
      inactive_reason = 'source_updated',
      inactive_at = sync_time
    where question_id = removed_question.question_id
      and is_active = true;

    delete from public.question_misconception_overrides
    where question_id = removed_question.question_id;

    delete from public.question_misconception_baselines
    where question_id = removed_question.question_id;

    changed_questions := changed_questions + 1;
  end loop;

  -- =======================================================
  -- Upsert question baseline + version
  -- =======================================================

  for item in
    select value
    from pg_catalog.jsonb_array_elements(input_question_baselines)
  loop
    target_question_id :=
      pg_catalog.btrim(item ->> 'question_id');

    incoming_fingerprint :=
      pg_catalog.btrim(item ->> 'source_fingerprint');

    incoming_ids :=
      public.normalize_text_id_array(
        array(
          select relation.value #>> '{}'
          from pg_catalog.jsonb_array_elements(
            item -> 'misconception_ids'
          ) relation(value)
        )
      );

    if exists (
      select 1
      from pg_catalog.unnest(incoming_ids) relation(id)
      where pg_catalog.length(pg_catalog.btrim(relation.id)) = 0
         or not (relation.id = any(valid_misconception_ids))
    ) then
      raise exception using
        message = 'INVALID_MISCONCEPTION_ID',
        errcode = '22023';
    end if;

    previous_version := null;
    previous_fingerprint := null;
    previous_ids := null;

    select
      baseline.source_version,
      baseline.source_fingerprint,
      baseline.misconception_ids
    into
      previous_version,
      previous_fingerprint,
      previous_ids
    from public.question_misconception_baselines baseline
    where baseline.question_id = target_question_id;

    if not found then
      next_version := gen_random_uuid();

      insert into public.question_misconception_baselines (
        question_id,
        misconception_ids,
        synced_by,
        synced_at,
        source_version,
        source_fingerprint
      )
      values (
        target_question_id,
        incoming_ids,
        null,
        sync_time,
        next_version,
        incoming_fingerprint
      );

      changed_questions := changed_questions + 1;

    elsif previous_fingerprint is distinct from incoming_fingerprint
       or previous_ids is distinct from incoming_ids
    then
      next_version := gen_random_uuid();

      -- Review versi sebelumnya tetap ada untuk Histori,
      -- tetapi tidak boleh ikut consensus versi baru.
      update public.question_reviews
      set
        is_active = false,
        inactive_reason = 'source_updated',
        inactive_at = sync_time
      where question_id = target_question_id
        and is_active = true;

      -- Hasil review versi sebelumnya tidak lagi effective.
      delete from public.question_misconception_overrides
      where question_id = target_question_id;

      update public.question_misconception_baselines
      set
        misconception_ids = incoming_ids,
        synced_by = null,
        synced_at = sync_time,
        source_version = next_version,
        source_fingerprint = incoming_fingerprint
      where question_id = target_question_id;

      changed_questions := changed_questions + 1;

    else
      -- Tidak berubah: version tetap.
      update public.question_misconception_baselines
      set
        synced_by = null,
        synced_at = sync_time
      where question_id = target_question_id;
    end if;
  end loop;

  -- =======================================================
  -- Upsert answer baseline + version
  -- =======================================================

  for item in
    select value
    from pg_catalog.jsonb_array_elements(input_answer_baselines)
  loop
    target_answer_id :=
      pg_catalog.btrim(item ->> 'answer_id');

    target_parent_question_id :=
      pg_catalog.btrim(item ->> 'question_id');

    incoming_fingerprint :=
      pg_catalog.btrim(item ->> 'source_fingerprint');

    incoming_ids :=
      public.normalize_text_id_array(
        array(
          select relation.value #>> '{}'
          from pg_catalog.jsonb_array_elements(
            item -> 'misconception_ids'
          ) relation(value)
        )
      );

    if exists (
      select 1
      from pg_catalog.unnest(incoming_ids) relation(id)
      where pg_catalog.length(pg_catalog.btrim(relation.id)) = 0
         or not (relation.id = any(valid_misconception_ids))
    ) then
      raise exception using
        message = 'INVALID_MISCONCEPTION_ID',
        errcode = '22023';
    end if;

    previous_version := null;
    previous_fingerprint := null;
    previous_ids := null;

    select
      baseline.source_version,
      baseline.source_fingerprint,
      baseline.misconception_ids
    into
      previous_version,
      previous_fingerprint,
      previous_ids
    from public.answer_misconception_baselines baseline
    where baseline.answer_id = target_answer_id;

    if not found then
      next_version := gen_random_uuid();

      insert into public.answer_misconception_baselines (
        answer_id,
        question_id,
        misconception_ids,
        synced_by,
        synced_at,
        source_version,
        source_fingerprint
      )
      values (
        target_answer_id,
        target_parent_question_id,
        incoming_ids,
        null,
        sync_time,
        next_version,
        incoming_fingerprint
      );

      changed_answers := changed_answers + 1;

    elsif previous_fingerprint is distinct from incoming_fingerprint
       or previous_ids is distinct from incoming_ids
       or exists (
         select 1
         from public.answer_misconception_baselines baseline
         where baseline.answer_id = target_answer_id
           and baseline.question_id is distinct from target_parent_question_id
       )
    then
      next_version := gen_random_uuid();

      update public.answer_reviews
      set
        is_active = false,
        inactive_reason = 'source_updated',
        inactive_at = sync_time
      where answer_id = target_answer_id
        and is_active = true;

      delete from public.answer_misconception_overrides
      where answer_id = target_answer_id;

      update public.answer_misconception_baselines
      set
        question_id = target_parent_question_id,
        misconception_ids = incoming_ids,
        synced_by = null,
        synced_at = sync_time,
        source_version = next_version,
        source_fingerprint = incoming_fingerprint
      where answer_id = target_answer_id;

      changed_answers := changed_answers + 1;

    else
      update public.answer_misconception_baselines
      set
        synced_by = null,
        synced_at = sync_time
      where answer_id = target_answer_id;
    end if;
  end loop;

  -- =======================================================
  -- Refresh misconception catalog
  -- =======================================================

  delete from public.master_misconception_catalog where misconception_id is not null;

  insert into public.master_misconception_catalog (
    misconception_id,
    synced_by,
    synced_at
  )
  select
    misconception_id,
    null,
    sync_time
  from pg_catalog.unnest(valid_misconception_ids)
    misconception(misconception_id);

  return query
  select
    (
      select pg_catalog.count(*)::integer
      from public.question_misconception_baselines
    ),
    (
      select pg_catalog.count(*)::integer
      from public.answer_misconception_baselines
    ),
    (
      select pg_catalog.count(*)::integer
      from public.master_misconception_catalog
    ),
    changed_questions,
    changed_answers,
    sync_time;
end;
$$;


ALTER FUNCTION "public"."sync_master_relation_baselines_v2"("input_question_baselines" "jsonb", "input_answer_baselines" "jsonb", "input_misconception_ids" "text"[]) OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "public"."answer_content_overrides" (
    "answer_id" "text" NOT NULL,
    "answer_text" "text" NOT NULL,
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "answer_content_overrides_answer_id_not_blank" CHECK (("length"("btrim"("answer_id")) > 0)),
    CONSTRAINT "answer_content_overrides_answer_text_not_blank" CHECK (("length"("btrim"("answer_text")) > 0))
);


ALTER TABLE "public"."answer_content_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."answer_misconception_baselines" (
    "answer_id" "text" NOT NULL,
    "question_id" "text" NOT NULL,
    "misconception_ids" "text"[] NOT NULL,
    "synced_by" "uuid",
    "synced_at" timestamp with time zone NOT NULL,
    "source_version" "uuid",
    "source_fingerprint" "text",
    CONSTRAINT "answer_misconception_baselines_answer_id_not_blank" CHECK (("length"("btrim"("answer_id")) > 0)),
    CONSTRAINT "answer_misconception_baselines_normalized_ids" CHECK (("misconception_ids" = "public"."normalize_text_id_array"("misconception_ids"))),
    CONSTRAINT "answer_misconception_baselines_question_id_not_blank" CHECK (("length"("btrim"("question_id")) > 0))
);


ALTER TABLE "public"."answer_misconception_baselines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."answer_misconception_overrides" (
    "answer_id" "text" NOT NULL,
    "question_id" "text" NOT NULL,
    "misconception_ids" "text"[] NOT NULL,
    "source_review_count" integer NOT NULL,
    "published_by" "uuid",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_version" "uuid" NOT NULL,
    CONSTRAINT "answer_misconception_overrides_answer_id_not_blank" CHECK (("length"("btrim"("answer_id")) > 0)),
    CONSTRAINT "answer_misconception_overrides_normalized_ids" CHECK (("misconception_ids" = "public"."normalize_text_id_array"("misconception_ids"))),
    CONSTRAINT "answer_misconception_overrides_question_id_not_blank" CHECK (("length"("btrim"("question_id")) > 0)),
    CONSTRAINT "answer_misconception_overrides_review_count" CHECK (("source_review_count" = 3))
);


ALTER TABLE "public"."answer_misconception_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."answer_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "answer_id" "text" NOT NULL,
    "question_id" "text" NOT NULL,
    "has_mismatched_misconceptions" boolean NOT NULL,
    "removed_misconception_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "removal_reason" "text",
    "has_additional_misconceptions" boolean NOT NULL,
    "additional_misconception_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "addition_reason" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_version" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "inactive_reason" "text",
    "inactive_at" timestamp with time zone,
    CONSTRAINT "answer_reviews_addition_complete" CHECK (((NOT "has_additional_misconceptions") OR (("cardinality"("additional_misconception_ids") > 0) AND ("length"("btrim"(COALESCE("addition_reason", ''::"text"))) > 0)))),
    CONSTRAINT "answer_reviews_answer_id_not_blank" CHECK (("length"("btrim"("answer_id")) > 0)),
    CONSTRAINT "answer_reviews_inactive_state_check" CHECK (((("is_active" = true) AND ("inactive_reason" IS NULL) AND ("inactive_at" IS NULL)) OR (("is_active" = false) AND ("inactive_reason" = ANY (ARRAY['deleted'::"text", 'source_updated'::"text"])) AND ("inactive_at" IS NOT NULL)))),
    CONSTRAINT "answer_reviews_question_id_not_blank" CHECK (("length"("btrim"("question_id")) > 0)),
    CONSTRAINT "answer_reviews_removal_complete" CHECK (((NOT "has_mismatched_misconceptions") OR (("cardinality"("removed_misconception_ids") > 0) AND ("length"("btrim"(COALESCE("removal_reason", ''::"text"))) > 0))))
);


ALTER TABLE "public"."answer_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lecturer_allowlist" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text",
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_admin" boolean DEFAULT false NOT NULL,
    CONSTRAINT "lecturer_allowlist_email_not_blank" CHECK (("length"("btrim"("email")) > 3))
);


ALTER TABLE "public"."lecturer_allowlist" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lecturer_profiles" (
    "user_id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "full_name" "text" NOT NULL,
    "active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lecturer_profiles_email_not_blank" CHECK (("length"("btrim"("email")) > 3)),
    CONSTRAINT "lecturer_profiles_full_name_not_blank" CHECK (("length"("btrim"("full_name")) > 0))
);


ALTER TABLE "public"."lecturer_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."master_misconception_catalog" (
    "misconception_id" "text" NOT NULL,
    "synced_by" "uuid",
    "synced_at" timestamp with time zone NOT NULL,
    CONSTRAINT "master_misconception_catalog_id_not_blank" CHECK (("length"("btrim"("misconception_id")) > 0))
);


ALTER TABLE "public"."master_misconception_catalog" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_content_overrides" (
    "question_id" "text" NOT NULL,
    "question_ind" "text",
    "question_en" "text",
    "question_code" "text",
    "updated_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "question_content_overrides_has_content" CHECK ((("length"("btrim"(COALESCE("question_ind", ''::"text"))) > 0) OR ("length"("btrim"(COALESCE("question_en", ''::"text"))) > 0) OR ("length"("btrim"(COALESCE("question_code", ''::"text"))) > 0))),
    CONSTRAINT "question_content_overrides_question_id_not_blank" CHECK (("length"("btrim"("question_id")) > 0))
);


ALTER TABLE "public"."question_content_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_misconception_baselines" (
    "question_id" "text" NOT NULL,
    "misconception_ids" "text"[] NOT NULL,
    "synced_by" "uuid",
    "synced_at" timestamp with time zone NOT NULL,
    "source_version" "uuid",
    "source_fingerprint" "text",
    CONSTRAINT "question_misconception_baselines_normalized_ids" CHECK (("misconception_ids" = "public"."normalize_text_id_array"("misconception_ids"))),
    CONSTRAINT "question_misconception_baselines_question_id_not_blank" CHECK (("length"("btrim"("question_id")) > 0))
);


ALTER TABLE "public"."question_misconception_baselines" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_misconception_overrides" (
    "question_id" "text" NOT NULL,
    "misconception_ids" "text"[] NOT NULL,
    "source_review_count" integer NOT NULL,
    "published_by" "uuid",
    "published_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_version" "uuid" NOT NULL,
    CONSTRAINT "question_misconception_overrides_normalized_ids" CHECK (("misconception_ids" = "public"."normalize_text_id_array"("misconception_ids"))),
    CONSTRAINT "question_misconception_overrides_question_id_not_blank" CHECK (("length"("btrim"("question_id")) > 0)),
    CONSTRAINT "question_misconception_overrides_review_count" CHECK (("source_review_count" = 3))
);


ALTER TABLE "public"."question_misconception_overrides" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."question_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "question_id" "text" NOT NULL,
    "has_incorrect_misconceptions" boolean NOT NULL,
    "removed_misconception_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "removal_reason" "text",
    "has_additional_misconceptions" boolean NOT NULL,
    "additional_misconception_ids" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "addition_reason" "text",
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "source_version" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "inactive_reason" "text",
    "inactive_at" timestamp with time zone,
    CONSTRAINT "question_reviews_addition_complete" CHECK (((NOT "has_additional_misconceptions") OR (("cardinality"("additional_misconception_ids") > 0) AND ("length"("btrim"(COALESCE("addition_reason", ''::"text"))) > 0)))),
    CONSTRAINT "question_reviews_inactive_state_check" CHECK (((("is_active" = true) AND ("inactive_reason" IS NULL) AND ("inactive_at" IS NULL)) OR (("is_active" = false) AND ("inactive_reason" = ANY (ARRAY['deleted'::"text", 'source_updated'::"text"])) AND ("inactive_at" IS NOT NULL)))),
    CONSTRAINT "question_reviews_question_id_not_blank" CHECK (("length"("btrim"("question_id")) > 0)),
    CONSTRAINT "question_reviews_removal_complete" CHECK (((NOT "has_incorrect_misconceptions") OR (("cardinality"("removed_misconception_ids") > 0) AND ("length"("btrim"(COALESCE("removal_reason", ''::"text"))) > 0))))
);


ALTER TABLE "public"."question_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."review_audit_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "review_type" "text" NOT NULL,
    "review_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "target_id" "text" NOT NULL,
    "question_id" "text",
    "source_version" "uuid",
    "event_type" "text" NOT NULL,
    "before_data" "jsonb",
    "after_data" "jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "review_audit_log_event_type_check" CHECK (("event_type" = ANY (ARRAY['created'::"text", 'edited'::"text", 'deleted'::"text", 'source_updated'::"text", 'reactivated'::"text", 'hard_deleted'::"text"]))),
    CONSTRAINT "review_audit_log_review_type_check" CHECK (("review_type" = ANY (ARRAY['question'::"text", 'answer'::"text"])))
);


ALTER TABLE "public"."review_audit_log" OWNER TO "postgres";

-- ---------------------------------------------------------------------------
-- Primary keys and unique constraints
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY "public"."answer_content_overrides"
    ADD CONSTRAINT "answer_content_overrides_pkey" PRIMARY KEY ("answer_id");

ALTER TABLE ONLY "public"."answer_misconception_baselines"
    ADD CONSTRAINT "answer_misconception_baselines_pkey" PRIMARY KEY ("answer_id");

ALTER TABLE ONLY "public"."answer_misconception_overrides"
    ADD CONSTRAINT "answer_misconception_overrides_pkey" PRIMARY KEY ("answer_id");

ALTER TABLE ONLY "public"."answer_reviews"
    ADD CONSTRAINT "answer_reviews_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."answer_reviews"
    ADD CONSTRAINT "answer_reviews_reviewer_answer_version_key" UNIQUE ("reviewer_id", "answer_id", "source_version");

ALTER TABLE ONLY "public"."lecturer_allowlist"
    ADD CONSTRAINT "lecturer_allowlist_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."lecturer_profiles"
    ADD CONSTRAINT "lecturer_profiles_pkey" PRIMARY KEY ("user_id");

ALTER TABLE ONLY "public"."master_misconception_catalog"
    ADD CONSTRAINT "master_misconception_catalog_pkey" PRIMARY KEY ("misconception_id");

ALTER TABLE ONLY "public"."question_content_overrides"
    ADD CONSTRAINT "question_content_overrides_pkey" PRIMARY KEY ("question_id");

ALTER TABLE ONLY "public"."question_misconception_baselines"
    ADD CONSTRAINT "question_misconception_baselines_pkey" PRIMARY KEY ("question_id");

ALTER TABLE ONLY "public"."question_misconception_overrides"
    ADD CONSTRAINT "question_misconception_overrides_pkey" PRIMARY KEY ("question_id");

ALTER TABLE ONLY "public"."question_reviews"
    ADD CONSTRAINT "question_reviews_pkey" PRIMARY KEY ("id");

ALTER TABLE ONLY "public"."question_reviews"
    ADD CONSTRAINT "question_reviews_reviewer_question_version_key" UNIQUE ("reviewer_id", "question_id", "source_version");

ALTER TABLE ONLY "public"."review_audit_log"
    ADD CONSTRAINT "review_audit_log_pkey" PRIMARY KEY ("id");

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX "answer_reviews_active_target_version_idx" ON "public"."answer_reviews" USING "btree" ("answer_id", "source_version") WHERE ("is_active" = true);

CREATE INDEX "answer_reviews_answer_id_idx" ON "public"."answer_reviews" USING "btree" ("answer_id");

CREATE INDEX "answer_reviews_question_id_idx" ON "public"."answer_reviews" USING "btree" ("question_id");

CREATE INDEX "answer_reviews_reviewer_id_idx" ON "public"."answer_reviews" USING "btree" ("reviewer_id");

CREATE UNIQUE INDEX "lecturer_allowlist_email_lower_key" ON "public"."lecturer_allowlist" USING "btree" ("lower"("email"));

CREATE UNIQUE INDEX "lecturer_profiles_email_lower_key" ON "public"."lecturer_profiles" USING "btree" ("lower"("email"));

CREATE INDEX "question_reviews_active_target_version_idx" ON "public"."question_reviews" USING "btree" ("question_id", "source_version") WHERE ("is_active" = true);

CREATE INDEX "question_reviews_question_id_idx" ON "public"."question_reviews" USING "btree" ("question_id");

CREATE INDEX "question_reviews_reviewer_id_idx" ON "public"."question_reviews" USING "btree" ("reviewer_id");

CREATE INDEX "review_audit_log_review_idx" ON "public"."review_audit_log" USING "btree" ("review_id", "occurred_at");

CREATE INDEX "review_audit_log_reviewer_idx" ON "public"."review_audit_log" USING "btree" ("reviewer_id", "occurred_at" DESC);

CREATE INDEX "review_audit_log_target_idx" ON "public"."review_audit_log" USING "btree" ("review_type", "target_id", "occurred_at" DESC);

-- ---------------------------------------------------------------------------
-- Triggers (public tables). The legacy Review-v1 cap / repeat-guard triggers
-- are intentionally NOT created (epoch guard: FORBIDDEN_LEGACY_REVIEW_TRIGGER).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE TRIGGER "answer_content_overrides_set_updated_at" BEFORE UPDATE ON "public"."answer_content_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "answer_misconception_overrides_set_updated_at" BEFORE UPDATE ON "public"."answer_misconception_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "answer_reviews_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."answer_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."log_review_audit"();

CREATE OR REPLACE TRIGGER "answer_reviews_set_updated_at" BEFORE UPDATE ON "public"."answer_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "lecturer_allowlist_normalize_email" BEFORE INSERT OR UPDATE ON "public"."lecturer_allowlist" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_lecturer_email"();

CREATE OR REPLACE TRIGGER "lecturer_allowlist_set_updated_at" BEFORE UPDATE ON "public"."lecturer_allowlist" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "lecturer_profiles_enforce_verified_telkom_email" BEFORE INSERT OR UPDATE OF "user_id", "email" ON "public"."lecturer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_verified_telkom_lecturer_profile"();

CREATE OR REPLACE TRIGGER "lecturer_profiles_normalize_email" BEFORE INSERT OR UPDATE ON "public"."lecturer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."normalize_lecturer_email"();

CREATE OR REPLACE TRIGGER "lecturer_profiles_set_updated_at" BEFORE UPDATE ON "public"."lecturer_profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "question_content_overrides_set_updated_at" BEFORE UPDATE ON "public"."question_content_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "question_misconception_overrides_set_updated_at" BEFORE UPDATE ON "public"."question_misconception_overrides" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

CREATE OR REPLACE TRIGGER "question_reviews_audit" AFTER INSERT OR DELETE OR UPDATE ON "public"."question_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."log_review_audit"();

CREATE OR REPLACE TRIGGER "question_reviews_set_updated_at" BEFORE UPDATE ON "public"."question_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();

-- ---------------------------------------------------------------------------
-- Foreign keys
-- ---------------------------------------------------------------------------

ALTER TABLE ONLY "public"."answer_content_overrides"
    ADD CONSTRAINT "answer_content_overrides_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."lecturer_profiles"("user_id");

ALTER TABLE ONLY "public"."answer_misconception_baselines"
    ADD CONSTRAINT "answer_misconception_baselines_synced_by_fkey" FOREIGN KEY ("synced_by") REFERENCES "public"."lecturer_profiles"("user_id");

ALTER TABLE ONLY "public"."answer_misconception_overrides"
    ADD CONSTRAINT "answer_misconception_overrides_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."lecturer_profiles"("user_id");

ALTER TABLE ONLY "public"."answer_reviews"
    ADD CONSTRAINT "answer_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."lecturer_profiles"("user_id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."lecturer_profiles"
    ADD CONSTRAINT "lecturer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;

ALTER TABLE ONLY "public"."master_misconception_catalog"
    ADD CONSTRAINT "master_misconception_catalog_synced_by_fkey" FOREIGN KEY ("synced_by") REFERENCES "public"."lecturer_profiles"("user_id");

ALTER TABLE ONLY "public"."question_content_overrides"
    ADD CONSTRAINT "question_content_overrides_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."lecturer_profiles"("user_id");

ALTER TABLE ONLY "public"."question_misconception_baselines"
    ADD CONSTRAINT "question_misconception_baselines_synced_by_fkey" FOREIGN KEY ("synced_by") REFERENCES "public"."lecturer_profiles"("user_id");

ALTER TABLE ONLY "public"."question_misconception_overrides"
    ADD CONSTRAINT "question_misconception_overrides_published_by_fkey" FOREIGN KEY ("published_by") REFERENCES "public"."lecturer_profiles"("user_id");

ALTER TABLE ONLY "public"."question_reviews"
    ADD CONSTRAINT "question_reviews_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "public"."lecturer_profiles"("user_id") ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE "public"."answer_content_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."answer_misconception_baselines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."answer_misconception_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."answer_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lecturer_allowlist" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."lecturer_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."master_misconception_catalog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_content_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_misconception_baselines" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_misconception_overrides" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."question_reviews" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."review_audit_log" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read all answer reviews" ON "public"."answer_reviews" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_is_admin"() AS "current_user_is_admin"));

CREATE POLICY "Admins can read all question reviews" ON "public"."question_reviews" FOR SELECT TO "authenticated" USING (( SELECT "public"."current_user_is_admin"() AS "current_user_is_admin"));

CREATE POLICY "Lecturers can create their own answer reviews" ON "public"."answer_reviews" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."lecturer_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."active" = true))))));

CREATE POLICY "Lecturers can create their own question reviews" ON "public"."question_reviews" FOR INSERT TO "authenticated" WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."lecturer_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."active" = true))))));

CREATE POLICY "Lecturers can read their own answer reviews" ON "public"."answer_reviews" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."lecturer_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."active" = true))))));

CREATE POLICY "Lecturers can read their own profile" ON "public"."lecturer_profiles" FOR SELECT TO "authenticated" USING ((( SELECT "auth"."uid"() AS "uid") = "user_id"));

CREATE POLICY "Lecturers can read their own question reviews" ON "public"."question_reviews" FOR SELECT TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."lecturer_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."active" = true))))));

CREATE POLICY "Lecturers can read their own review audit" ON "public"."review_audit_log" FOR SELECT TO "authenticated" USING ((("reviewer_id" = ( SELECT "auth"."uid"() AS "uid")) OR ( SELECT "public"."current_user_is_admin"() AS "current_user_is_admin")));

CREATE POLICY "Lecturers can update their own answer reviews" ON "public"."answer_reviews" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."lecturer_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."active" = true)))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."lecturer_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."active" = true))))));

CREATE POLICY "Lecturers can update their own question reviews" ON "public"."question_reviews" FOR UPDATE TO "authenticated" USING (((( SELECT "auth"."uid"() AS "uid") = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."lecturer_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."active" = true)))))) WITH CHECK (((( SELECT "auth"."uid"() AS "uid") = "reviewer_id") AND (EXISTS ( SELECT 1
   FROM "public"."lecturer_profiles" "profile"
  WHERE (("profile"."user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profile"."active" = true))))));

-- ---------------------------------------------------------------------------
-- Grants (explicit REVOKE then GRANT; independent of ALTER DEFAULT PRIVILEGES)
-- ---------------------------------------------------------------------------

grant usage on schema public to postgres, anon, authenticated, service_role;

-- Baseline / catalog / override / content tables: reachable only via the
-- SECURITY DEFINER RPCs; no API role gets direct row access.
revoke all on table public.question_misconception_baselines from public, anon, authenticated, service_role;
revoke all on table public.answer_misconception_baselines from public, anon, authenticated, service_role;
revoke all on table public.master_misconception_catalog from public, anon, authenticated, service_role;
revoke all on table public.question_misconception_overrides from public, anon, authenticated, service_role;
revoke all on table public.answer_misconception_overrides from public, anon, authenticated, service_role;
revoke all on table public.question_content_overrides from public, anon, authenticated, service_role;
revoke all on table public.answer_content_overrides from public, anon, authenticated, service_role;

revoke all on table public.lecturer_allowlist from public, anon, authenticated;
grant all on table public.lecturer_allowlist to service_role;

revoke all on table public.lecturer_profiles from public, anon;
grant all on table public.lecturer_profiles to authenticated, service_role;

revoke all on table public.question_reviews from public, anon, authenticated, service_role;
grant select, references, trigger, truncate, maintain on table public.question_reviews to authenticated;
grant all on table public.question_reviews to service_role;

revoke all on table public.answer_reviews from public, anon, authenticated, service_role;
grant select, references, trigger, truncate, maintain on table public.answer_reviews to authenticated;
grant all on table public.answer_reviews to service_role;

revoke all on table public.review_audit_log from public, anon, authenticated, service_role;
grant select on table public.review_audit_log to authenticated;
grant all on table public.review_audit_log to service_role;

-- Guarded Review-v3 contract functions (the epoch guard asserts these ACLs).
revoke all on function public.current_user_is_admin() from public, anon, authenticated, service_role;
grant execute on function public.current_user_is_admin() to anon, authenticated, service_role;

revoke all on function public.save_question_review_v3(text, uuid, boolean, text[], text, boolean, text[], text, text) from public, anon, authenticated, service_role;
grant execute on function public.save_question_review_v3(text, uuid, boolean, text[], text, boolean, text[], text, text) to authenticated, service_role;
revoke all on function public.save_answer_review_v3(text, uuid, boolean, text[], text, boolean, text[], text, text) from public, anon, authenticated, service_role;
grant execute on function public.save_answer_review_v3(text, uuid, boolean, text[], text, boolean, text[], text, text) to authenticated, service_role;
revoke all on function public.delete_question_review_v3(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_question_review_v3(text, uuid) to authenticated, service_role;
revoke all on function public.delete_answer_review_v3(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_answer_review_v3(text, uuid) to authenticated, service_role;
revoke all on function public.delete_question_review_workflow_v3(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_question_review_workflow_v3(text, uuid) to authenticated, service_role;
revoke all on function public.recompute_question_review_consensus_v3(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.recompute_question_review_consensus_v3(text, uuid) to service_role;
revoke all on function public.recompute_answer_review_consensus_v3(text, uuid) from public, anon, authenticated, service_role;
grant execute on function public.recompute_answer_review_consensus_v3(text, uuid) to service_role;
revoke all on function public.get_review_source_versions() from public, anon, authenticated, service_role;
grant execute on function public.get_review_source_versions() to authenticated;
revoke all on function public.sync_master_relation_baselines_v2(jsonb, jsonb, text[]) from public, anon, authenticated, service_role;
grant execute on function public.sync_master_relation_baselines_v2(jsonb, jsonb, text[]) to service_role;

-- Legacy v1 sync: production keeps this callable by authenticated. This is the
-- single documented replay exception
-- (checks/fixtures/review-v3/documented-exceptions.json).
revoke all on function public.sync_master_relation_baselines(jsonb, jsonb, text[]) from public, anon, authenticated, service_role;
grant execute on function public.sync_master_relation_baselines(jsonb, jsonb, text[]) to authenticated;

-- Non-guarded application functions.
revoke all on function public.get_my_review_status() from public, anon, authenticated, service_role;
grant execute on function public.get_my_review_status() to authenticated;
revoke all on function public.get_question_review_counts() from public, anon, authenticated, service_role;
grant execute on function public.get_question_review_counts() to authenticated;
revoke all on function public.get_answer_review_counts() from public, anon, authenticated, service_role;
grant execute on function public.get_answer_review_counts() to authenticated;
revoke all on function public.get_admin_review_consensus() from public, anon, authenticated, service_role;
grant execute on function public.get_admin_review_consensus() to authenticated;
revoke all on function public.get_admin_review_lifecycle() from public, anon, authenticated, service_role;
grant execute on function public.get_admin_review_lifecycle() to authenticated;
revoke all on function public.get_admin_reviewer_profiles(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.get_admin_reviewer_profiles(uuid[]) to anon, authenticated, service_role;
revoke all on function public.get_published_master_overrides() from public, anon, authenticated, service_role;
grant execute on function public.get_published_master_overrides() to anon, authenticated;

-- Publish-override RPCs: production has revoked these from every API role; the
-- Review-v3 consensus recompute path supersedes manual publish. Kept for parity.
revoke all on function public.publish_question_misconception_override(text) from public, anon, authenticated, service_role;
revoke all on function public.publish_answer_misconception_override(text) from public, anon, authenticated, service_role;

revoke all on function public.save_question_content_override(text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.save_question_content_override(text, text, text, text) to authenticated;
revoke all on function public.save_answer_content_override(text, text) from public, anon, authenticated, service_role;
grant execute on function public.save_answer_content_override(text, text) to authenticated;
revoke all on function public.reset_question_content_override(text) from public, anon, authenticated, service_role;
grant execute on function public.reset_question_content_override(text) to authenticated;
revoke all on function public.reset_answer_content_override(text) from public, anon, authenticated, service_role;
grant execute on function public.reset_answer_content_override(text) to authenticated;
revoke all on function public.reset_question_misconception_override(text) from public, anon, authenticated, service_role;
grant execute on function public.reset_question_misconception_override(text) to authenticated;
revoke all on function public.reset_answer_misconception_override(text) from public, anon, authenticated, service_role;
grant execute on function public.reset_answer_misconception_override(text) to authenticated;

revoke all on function public.normalize_text_id_array(text[]) from public, anon, authenticated, service_role;

-- Trigger/helper functions keep broad execute (matches production ACLs).
grant execute on function public.set_updated_at() to public, anon, authenticated, service_role;
grant execute on function public.log_review_audit() to public, anon, authenticated, service_role;
grant execute on function public.prevent_repeat_lecturer_review_update() to public, anon, authenticated, service_role;
grant execute on function public.normalize_lecturer_email() to public, anon, authenticated, service_role;

revoke all on function public.is_telkom_lecturer_email(text) from public;
grant execute on function public.is_telkom_lecturer_email(text) to anon, authenticated, service_role;
revoke all on function public.enforce_verified_telkom_lecturer_profile() from public;
grant execute on function public.enforce_verified_telkom_lecturer_profile() to anon, authenticated, service_role;
revoke all on function public.handle_new_lecturer_user() from public;
grant execute on function public.handle_new_lecturer_user() to anon, authenticated, service_role;

revoke all on function public.enforce_question_review_cap() from public, anon, authenticated, service_role;
revoke all on function public.enforce_answer_review_cap() from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- auth.users provisioning trigger
-- Reconstructed verbatim from the repository source (the auth schema is
-- outside the production public-schema dump):
--   database/migration-archive/legacy-20260720-through-20260814174227/
--   20260722_001_telkom_lecturer_domain_access.sql
-- ---------------------------------------------------------------------------

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, email_confirmed_at on auth.users
for each row
execute procedure public.handle_new_lecturer_user();

commit;

-- Next: apply supabase/migrations/20260823000000_review_v3_epoch_guard.sql to
-- this database. It must complete with no MIGRATION_EPOCH_GUARD_FAILED.
