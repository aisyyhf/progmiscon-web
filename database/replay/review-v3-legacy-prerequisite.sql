-- LOCAL/DISPOSABLE REPLAY ONLY. Never deploy or pass to a linked Supabase project.
begin;

alter table public.question_misconception_baselines
  add column if not exists source_version uuid,
  add column if not exists source_fingerprint text,
  alter column synced_by drop not null;

alter table public.answer_misconception_baselines
  add column if not exists source_version uuid,
  add column if not exists source_fingerprint text,
  alter column synced_by drop not null;

alter table public.master_misconception_catalog
  alter column synced_by drop not null;

update public.question_misconception_baselines
set source_version = gen_random_uuid()
where source_version is null;

update public.answer_misconception_baselines
set source_version = gen_random_uuid()
where source_version is null;

alter table public.question_reviews
  add column if not exists source_version uuid,
  add column if not exists is_active boolean default true,
  add column if not exists inactive_reason text,
  add column if not exists inactive_at timestamptz;

alter table public.answer_reviews
  add column if not exists source_version uuid,
  add column if not exists is_active boolean default true,
  add column if not exists inactive_reason text,
  add column if not exists inactive_at timestamptz;

do $validation$
begin
  if exists (
    select 1
    from public.question_reviews review
    left join public.question_misconception_baselines baseline
      on baseline.question_id = review.question_id
    where baseline.question_id is null
  ) then
    raise exception using message = 'REVIEW_V3_MISSING_QUESTION_BASELINE';
  end if;

  if exists (
    select 1
    from public.answer_reviews review
    left join public.answer_misconception_baselines baseline
      on baseline.answer_id = review.answer_id
    where baseline.answer_id is null
  ) then
    raise exception using message = 'REVIEW_V3_MISSING_ANSWER_BASELINE';
  end if;

  if exists (
    select 1
    from public.answer_reviews review
    join public.answer_misconception_baselines baseline
      on baseline.answer_id = review.answer_id
    where baseline.question_id <> review.question_id
  ) then
    raise exception using message = 'REVIEW_V3_ANSWER_PARENT_MISMATCH';
  end if;

  if exists (
    select 1
    from public.question_reviews
    group by reviewer_id, question_id
    having count(*) > 1
  ) or exists (
    select 1
    from public.answer_reviews
    group by reviewer_id, answer_id
    having count(*) > 1
  ) then
    raise exception using message = 'REVIEW_V3_DUPLICATE_LEGACY_REVIEW';
  end if;

  if exists (
    select 1
    from public.question_reviews
    group by question_id
    having count(distinct reviewer_id) > 3
  ) or exists (
    select 1
    from public.answer_reviews
    group by answer_id
    having count(distinct reviewer_id) > 3
  ) then
    raise exception using message = 'REVIEW_V3_REVIEWER_CAP_EXCEEDED';
  end if;

  if exists (
    select 1
    from public.question_reviews
    where is_active is null
       or (is_active = true and (inactive_reason is not null or inactive_at is not null))
       or (is_active = false and (
         inactive_reason not in ('deleted', 'source_updated') or inactive_at is null
       ))
  ) or exists (
    select 1
    from public.answer_reviews
    where is_active is null
       or (is_active = true and (inactive_reason is not null or inactive_at is not null))
       or (is_active = false and (
         inactive_reason not in ('deleted', 'source_updated') or inactive_at is null
       ))
  ) then
    raise exception using message = 'REVIEW_V3_MALFORMED_LIFECYCLE';
  end if;
end;
$validation$;

drop trigger if exists question_reviews_enforce_cap on public.question_reviews;
drop trigger if exists answer_reviews_enforce_cap on public.answer_reviews;
drop trigger if exists question_reviews_prevent_repeat_lecturer_update on public.question_reviews;
drop trigger if exists answer_reviews_prevent_repeat_lecturer_update on public.answer_reviews;

alter table public.question_reviews disable trigger question_reviews_set_updated_at;
alter table public.answer_reviews disable trigger answer_reviews_set_updated_at;
alter table public.question_misconception_overrides
  disable trigger question_misconception_overrides_set_updated_at;
alter table public.answer_misconception_overrides
  disable trigger answer_misconception_overrides_set_updated_at;

update public.question_reviews review
set
  source_version = baseline.source_version,
  is_active = true,
  inactive_reason = null,
  inactive_at = null
from public.question_misconception_baselines baseline
where baseline.question_id = review.question_id;

update public.answer_reviews review
set
  source_version = baseline.source_version,
  is_active = true,
  inactive_reason = null,
  inactive_at = null
from public.answer_misconception_baselines baseline
where baseline.answer_id = review.answer_id;

alter table public.question_reviews
  alter column source_version set not null,
  alter column is_active set default true,
  alter column is_active set not null;

alter table public.answer_reviews
  alter column source_version set not null,
  alter column is_active set default true,
  alter column is_active set not null;

alter table public.question_reviews
  drop constraint if exists question_reviews_inactive_state_check,
  add constraint question_reviews_inactive_state_check
    check (
      (is_active = true and inactive_reason is null and inactive_at is null)
      or (
        is_active = false
        and inactive_reason in ('deleted', 'source_updated')
        and inactive_at is not null
      )
    ),
  drop constraint if exists question_reviews_reviewer_id_question_id_key,
  drop constraint if exists question_reviews_reviewer_question_version_key,
  add constraint question_reviews_reviewer_question_version_key
    unique (reviewer_id, question_id, source_version);

alter table public.answer_reviews
  drop constraint if exists answer_reviews_inactive_state_check,
  add constraint answer_reviews_inactive_state_check
    check (
      (is_active = true and inactive_reason is null and inactive_at is null)
      or (
        is_active = false
        and inactive_reason in ('deleted', 'source_updated')
        and inactive_at is not null
      )
    ),
  drop constraint if exists answer_reviews_reviewer_id_answer_id_key,
  drop constraint if exists answer_reviews_reviewer_answer_version_key,
  add constraint answer_reviews_reviewer_answer_version_key
    unique (reviewer_id, answer_id, source_version);

create index if not exists question_reviews_active_target_version_idx
  on public.question_reviews (question_id, source_version)
  where is_active = true;

create index if not exists answer_reviews_active_target_version_idx
  on public.answer_reviews (answer_id, source_version)
  where is_active = true;

alter table public.question_misconception_overrides
  add column if not exists source_version uuid,
  alter column published_by drop not null;

alter table public.answer_misconception_overrides
  add column if not exists source_version uuid,
  alter column published_by drop not null;

do $override_validation$
begin
  if exists (
    select 1
    from public.question_misconception_overrides override_row
    left join public.question_misconception_baselines baseline
      on baseline.question_id = override_row.question_id
    where baseline.question_id is null
  ) then
    raise exception using message = 'REVIEW_V3_UNMAPPABLE_QUESTION_OVERRIDE';
  end if;

  if exists (
    select 1
    from public.answer_misconception_overrides override_row
    left join public.answer_misconception_baselines baseline
      on baseline.answer_id = override_row.answer_id
    where baseline.answer_id is null
       or baseline.question_id <> override_row.question_id
  ) then
    raise exception using message = 'REVIEW_V3_UNMAPPABLE_ANSWER_OVERRIDE';
  end if;
end;
$override_validation$;

update public.question_misconception_overrides override_row
set source_version = baseline.source_version
from public.question_misconception_baselines baseline
where baseline.question_id = override_row.question_id;

update public.answer_misconception_overrides override_row
set source_version = baseline.source_version
from public.answer_misconception_baselines baseline
where baseline.answer_id = override_row.answer_id
  and baseline.question_id = override_row.question_id;

alter table public.question_misconception_overrides
  alter column source_version set not null;
alter table public.answer_misconception_overrides
  alter column source_version set not null;

alter table public.question_reviews enable trigger question_reviews_set_updated_at;
alter table public.answer_reviews enable trigger answer_reviews_set_updated_at;
alter table public.question_misconception_overrides
  enable trigger question_misconception_overrides_set_updated_at;
alter table public.answer_misconception_overrides
  enable trigger answer_misconception_overrides_set_updated_at;

create table public.review_audit_log (
  id uuid primary key default gen_random_uuid(),
  review_type text not null
    check (review_type in ('question', 'answer')),
  review_id uuid not null,
  reviewer_id uuid not null,
  target_id text not null,
  question_id text,
  source_version uuid,
  event_type text not null
    check (event_type in (
      'created', 'edited', 'deleted', 'source_updated', 'reactivated', 'hard_deleted'
    )),
  before_data jsonb,
  after_data jsonb,
  occurred_at timestamptz not null default now()
);

create index review_audit_log_review_idx
  on public.review_audit_log (review_id, occurred_at);
create index review_audit_log_reviewer_idx
  on public.review_audit_log (reviewer_id, occurred_at desc);
create index review_audit_log_target_idx
  on public.review_audit_log (review_type, target_id, occurred_at desc);

alter table public.review_audit_log enable row level security;

create policy "Lecturers can read their own review audit"
on public.review_audit_log
for select
to authenticated
using (
  reviewer_id = (select auth.uid())
  or (select public.current_user_is_admin())
);

-- The exact predecessor is derived from the authoritative current definition by
-- reversing only the two substitutions guarded by the existing historical patch.
CREATE OR REPLACE FUNCTION public.log_review_audit()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
        else new.answer_id
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
        else new.answer_id
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
        else old.answer_id
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
$function$;

create trigger question_reviews_audit
after insert or update or delete on public.question_reviews
for each row execute function public.log_review_audit();

create trigger answer_reviews_audit
after insert or update or delete on public.answer_reviews
for each row execute function public.log_review_audit();

revoke all on table public.question_reviews from public, anon, authenticated, service_role;
revoke all on table public.answer_reviews from public, anon, authenticated, service_role;
grant select, truncate, references, trigger, maintain on table public.question_reviews to authenticated;
grant select, truncate, references, trigger, maintain on table public.answer_reviews to authenticated;
grant all on table public.question_reviews to service_role;
grant all on table public.answer_reviews to service_role;

revoke all on table public.review_audit_log from public, anon, authenticated, service_role;
grant select on table public.review_audit_log to authenticated;
grant all on table public.review_audit_log to service_role;

revoke all on function public.normalize_text_id_array(text[]) from public, anon, authenticated, service_role;
revoke all on function public.enforce_question_review_cap() from public, anon, authenticated, service_role;
revoke all on function public.enforce_answer_review_cap() from public, anon, authenticated, service_role;

revoke all on function public.set_updated_at() from public, anon, authenticated, service_role;
grant execute on function public.set_updated_at() to public, anon, authenticated, service_role;
revoke all on function public.log_review_audit() from public, anon, authenticated, service_role;
grant execute on function public.log_review_audit() to public, anon, authenticated, service_role;
revoke all on function public.prevent_repeat_lecturer_review_update()
  from public, anon, authenticated, service_role;
grant execute on function public.prevent_repeat_lecturer_review_update()
  to public, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_is_admin()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke all on function public.current_user_is_admin() from public, anon, authenticated, service_role;
grant execute on function public.current_user_is_admin() to anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_answer_review_v3(p_answer_id text, p_source_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke all on function public.delete_answer_review_v3(p_answer_id text, p_source_version uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_answer_review_v3(p_answer_id text, p_source_version uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.delete_question_review_v3(p_question_id text, p_source_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke all on function public.delete_question_review_v3(p_question_id text, p_source_version uuid) from public, anon, authenticated, service_role;
grant execute on function public.delete_question_review_v3(p_question_id text, p_source_version uuid) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recompute_answer_review_consensus_v3(p_answer_id text, p_source_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke all on function public.recompute_answer_review_consensus_v3(p_answer_id text, p_source_version uuid) from public, anon, authenticated, service_role;
grant execute on function public.recompute_answer_review_consensus_v3(p_answer_id text, p_source_version uuid) to service_role;

CREATE OR REPLACE FUNCTION public.recompute_question_review_consensus_v3(p_question_id text, p_source_version uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke all on function public.recompute_question_review_consensus_v3(p_question_id text, p_source_version uuid) from public, anon, authenticated, service_role;
grant execute on function public.recompute_question_review_consensus_v3(p_question_id text, p_source_version uuid) to service_role;

CREATE OR REPLACE FUNCTION public.save_answer_review_v3(p_answer_id text, p_source_version uuid, p_has_mismatched_misconceptions boolean, p_removed_misconception_ids text[], p_removal_reason text, p_has_additional_misconceptions boolean, p_additional_misconception_ids text[], p_addition_reason text, p_note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke all on function public.save_answer_review_v3(p_answer_id text, p_source_version uuid, p_has_mismatched_misconceptions boolean, p_removed_misconception_ids text[], p_removal_reason text, p_has_additional_misconceptions boolean, p_additional_misconception_ids text[], p_addition_reason text, p_note text) from public, anon, authenticated, service_role;
grant execute on function public.save_answer_review_v3(p_answer_id text, p_source_version uuid, p_has_mismatched_misconceptions boolean, p_removed_misconception_ids text[], p_removal_reason text, p_has_additional_misconceptions boolean, p_additional_misconception_ids text[], p_addition_reason text, p_note text) to authenticated, service_role;

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

CREATE OR REPLACE FUNCTION public.sync_master_relation_baselines_v2(input_question_baselines jsonb, input_answer_baselines jsonb, input_misconception_ids text[])
 RETURNS TABLE(question_count integer, answer_count integer, misconception_count integer, question_versions_changed integer, answer_versions_changed integer, synced_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;

revoke all on function public.sync_master_relation_baselines_v2(input_question_baselines jsonb, input_answer_baselines jsonb, input_misconception_ids text[]) from public, anon, authenticated, service_role;
grant execute on function public.sync_master_relation_baselines_v2(input_question_baselines jsonb, input_answer_baselines jsonb, input_misconception_ids text[]) to service_role;

-- Runtime functions keep their production definitions; only exact production ACLs
-- are reconciled here, except for the documented postgres-only legacy sync v1.
-- This replay-only replacement preserves the authoritative pg_get_functiondef
-- layout that is not present in the historical migration source.
CREATE OR REPLACE FUNCTION public.get_question_review_counts()
 RETURNS TABLE(question_id text, review_count integer, latest_updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$

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

$function$;

revoke all on function public.get_my_review_status()
  from public, anon, authenticated, service_role;
grant execute on function public.get_my_review_status() to authenticated;

revoke all on function public.get_question_review_counts()
  from public, anon, authenticated, service_role;
grant execute on function public.get_question_review_counts() to authenticated;

revoke all on function public.get_answer_review_counts()
  from public, anon, authenticated, service_role;
grant execute on function public.get_answer_review_counts() to authenticated;

revoke all on function public.get_admin_review_consensus()
  from public, anon, authenticated, service_role;
grant execute on function public.get_admin_review_consensus() to authenticated;

revoke all on function public.get_published_master_overrides()
  from public, anon, authenticated, service_role;
grant execute on function public.get_published_master_overrides() to anon, authenticated;

revoke all on function public.get_admin_reviewer_profiles(uuid[])
  from public, anon, authenticated, service_role;
grant execute on function public.get_admin_reviewer_profiles(uuid[])
  to anon, authenticated, service_role;

revoke all on function public.publish_question_misconception_override(text)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_answer_misconception_override(text)
  from public, anon, authenticated, service_role;

revoke all on function public.sync_master_relation_baselines(jsonb, jsonb, text[])
  from public, anon, authenticated, service_role;

commit;
