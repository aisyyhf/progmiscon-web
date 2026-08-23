-- Progmiscon
-- Published content/relation overrides, three-reviewer consensus, and review caps.
-- Apply after 20260728_002. Do not run from the frontend.

begin;

create or replace function public.normalize_text_id_array(input_values text[])
returns text[]
language sql
immutable
security invoker
set search_path = ''
as $$
  select coalesce(
    array_agg(distinct pg_catalog.btrim(value) order by pg_catalog.btrim(value)),
    '{}'::text[]
  )
  from pg_catalog.unnest(coalesce(input_values, '{}'::text[])) as item(value)
  where pg_catalog.length(pg_catalog.btrim(value)) > 0;
$$;

create table public.question_misconception_baselines (
  question_id text primary key,
  misconception_ids text[] not null,
  synced_by uuid not null references public.lecturer_profiles(user_id),
  synced_at timestamptz not null,
  constraint question_misconception_baselines_question_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(question_id)) > 0),
  constraint question_misconception_baselines_normalized_ids
    check (misconception_ids = public.normalize_text_id_array(misconception_ids))
);

create table public.answer_misconception_baselines (
  answer_id text primary key,
  question_id text not null,
  misconception_ids text[] not null,
  synced_by uuid not null references public.lecturer_profiles(user_id),
  synced_at timestamptz not null,
  constraint answer_misconception_baselines_answer_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(answer_id)) > 0),
  constraint answer_misconception_baselines_question_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(question_id)) > 0),
  constraint answer_misconception_baselines_normalized_ids
    check (misconception_ids = public.normalize_text_id_array(misconception_ids))
);

create table public.master_misconception_catalog (
  misconception_id text primary key,
  synced_by uuid not null references public.lecturer_profiles(user_id),
  synced_at timestamptz not null,
  constraint master_misconception_catalog_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(misconception_id)) > 0)
);

create table public.question_misconception_overrides (
  question_id text primary key,
  misconception_ids text[] not null,
  source_review_count integer not null,
  published_by uuid not null references public.lecturer_profiles(user_id),
  published_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint question_misconception_overrides_question_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(question_id)) > 0),
  constraint question_misconception_overrides_normalized_ids
    check (misconception_ids = public.normalize_text_id_array(misconception_ids)),
  constraint question_misconception_overrides_review_count
    check (source_review_count = 3)
);

create table public.answer_misconception_overrides (
  answer_id text primary key,
  question_id text not null,
  misconception_ids text[] not null,
  source_review_count integer not null,
  published_by uuid not null references public.lecturer_profiles(user_id),
  published_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint answer_misconception_overrides_answer_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(answer_id)) > 0),
  constraint answer_misconception_overrides_question_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(question_id)) > 0),
  constraint answer_misconception_overrides_normalized_ids
    check (misconception_ids = public.normalize_text_id_array(misconception_ids)),
  constraint answer_misconception_overrides_review_count
    check (source_review_count = 3)
);

create table public.question_content_overrides (
  question_id text primary key,
  question_ind text,
  question_en text,
  question_code text,
  updated_by uuid not null references public.lecturer_profiles(user_id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint question_content_overrides_question_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(question_id)) > 0),
  constraint question_content_overrides_has_content
    check (
      pg_catalog.length(pg_catalog.btrim(coalesce(question_ind, ''))) > 0
      or pg_catalog.length(pg_catalog.btrim(coalesce(question_en, ''))) > 0
      or pg_catalog.length(pg_catalog.btrim(coalesce(question_code, ''))) > 0
    )
);

create table public.answer_content_overrides (
  answer_id text primary key,
  answer_text text not null,
  updated_by uuid not null references public.lecturer_profiles(user_id),
  created_at timestamptz not null default pg_catalog.now(),
  updated_at timestamptz not null default pg_catalog.now(),
  constraint answer_content_overrides_answer_id_not_blank
    check (pg_catalog.length(pg_catalog.btrim(answer_id)) > 0),
  constraint answer_content_overrides_answer_text_not_blank
    check (pg_catalog.length(pg_catalog.btrim(answer_text)) > 0)
);

create trigger question_misconception_overrides_set_updated_at
before update on public.question_misconception_overrides
for each row execute function public.set_updated_at();

create trigger answer_misconception_overrides_set_updated_at
before update on public.answer_misconception_overrides
for each row execute function public.set_updated_at();

create trigger question_content_overrides_set_updated_at
before update on public.question_content_overrides
for each row execute function public.set_updated_at();

create trigger answer_content_overrides_set_updated_at
before update on public.answer_content_overrides
for each row execute function public.set_updated_at();

alter table public.question_misconception_overrides enable row level security;
alter table public.answer_misconception_overrides enable row level security;
alter table public.question_content_overrides enable row level security;
alter table public.answer_content_overrides enable row level security;
alter table public.question_misconception_baselines enable row level security;
alter table public.answer_misconception_baselines enable row level security;
alter table public.master_misconception_catalog enable row level security;

revoke all on table public.question_misconception_overrides from public, anon, authenticated, service_role;
revoke all on table public.answer_misconception_overrides from public, anon, authenticated, service_role;
revoke all on table public.question_content_overrides from public, anon, authenticated, service_role;
revoke all on table public.answer_content_overrides from public, anon, authenticated, service_role;
revoke all on table public.question_misconception_baselines from public, anon, authenticated, service_role;
revoke all on table public.answer_misconception_baselines from public, anon, authenticated, service_role;
revoke all on table public.master_misconception_catalog from public, anon, authenticated, service_role;

create or replace function public.enforce_question_review_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.enforce_answer_review_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
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

create trigger question_reviews_enforce_cap
before insert on public.question_reviews
for each row execute function public.enforce_question_review_cap();

create trigger answer_reviews_enforce_cap
before insert on public.answer_reviews
for each row execute function public.enforce_answer_review_cap();

create or replace function public.get_answer_review_counts()
returns table (
  answer_id text,
  review_count integer,
  latest_updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    review.answer_id,
    pg_catalog.count(distinct review.reviewer_id)::integer,
    pg_catalog.max(review.updated_at)
  from public.answer_reviews as review
  where exists (
    select 1
    from public.lecturer_profiles as profile
    where profile.user_id = (select auth.uid())
      and profile.active = true
  )
  group by review.answer_id;
$$;

create or replace function public.sync_master_relation_baselines(
  input_question_baselines jsonb,
  input_answer_baselines jsonb,
  input_misconception_ids text[]
)
returns table (
  question_count integer,
  answer_count integer,
  misconception_count integer,
  synced_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.get_admin_review_consensus()
returns table (
  target_type text,
  target_id text,
  question_id text,
  review_count integer,
  removed_votes jsonb,
  additional_votes jsonb,
  published_misconception_ids text[],
  published_at timestamptz,
  baseline_misconception_ids text[],
  baseline_synced_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
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

create or replace function public.publish_question_misconception_override(
  input_question_id text
)
returns table (
  question_id text,
  misconception_ids text[],
  source_review_count integer,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.publish_answer_misconception_override(
  input_answer_id text
)
returns table (
  answer_id text,
  question_id text,
  misconception_ids text[],
  source_review_count integer,
  published_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.save_question_content_override(
  input_question_id text,
  input_question_ind text,
  input_question_en text,
  input_question_code text
)
returns table (
  question_id text,
  question_ind text,
  question_en text,
  question_code text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.save_answer_content_override(
  input_answer_id text,
  input_answer_text text
)
returns table (
  answer_id text,
  answer_text text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.reset_question_content_override(input_question_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.reset_answer_content_override(input_answer_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.reset_question_misconception_override(input_question_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.reset_answer_misconception_override(input_answer_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
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

create or replace function public.get_published_master_overrides()
returns table (
  question_content_overrides jsonb,
  answer_content_overrides jsonb,
  question_misconception_overrides jsonb,
  answer_misconception_overrides jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
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

revoke all on function public.normalize_text_id_array(text[]) from public, anon, authenticated, service_role;
revoke all on function public.enforce_question_review_cap() from public, anon, authenticated, service_role;
revoke all on function public.enforce_answer_review_cap() from public, anon, authenticated, service_role;

revoke all on function public.get_answer_review_counts() from public, anon, service_role;
grant execute on function public.get_answer_review_counts() to authenticated;

revoke all on function public.get_admin_review_consensus() from public, anon, service_role;
grant execute on function public.get_admin_review_consensus() to authenticated;

revoke all on function public.sync_master_relation_baselines(jsonb, jsonb, text[]) from public, anon, service_role;
revoke all on function public.publish_question_misconception_override(text) from public, anon, service_role;
revoke all on function public.publish_answer_misconception_override(text) from public, anon, service_role;
revoke all on function public.save_question_content_override(text, text, text, text) from public, anon, service_role;
revoke all on function public.save_answer_content_override(text, text) from public, anon, service_role;
revoke all on function public.reset_question_content_override(text) from public, anon, service_role;
revoke all on function public.reset_answer_content_override(text) from public, anon, service_role;
revoke all on function public.reset_question_misconception_override(text) from public, anon, service_role;
revoke all on function public.reset_answer_misconception_override(text) from public, anon, service_role;

grant execute on function public.sync_master_relation_baselines(jsonb, jsonb, text[]) to authenticated;
grant execute on function public.publish_question_misconception_override(text) to authenticated;
grant execute on function public.publish_answer_misconception_override(text) to authenticated;
grant execute on function public.save_question_content_override(text, text, text, text) to authenticated;
grant execute on function public.save_answer_content_override(text, text) to authenticated;
grant execute on function public.reset_question_content_override(text) to authenticated;
grant execute on function public.reset_answer_content_override(text) to authenticated;
grant execute on function public.reset_question_misconception_override(text) to authenticated;
grant execute on function public.reset_answer_misconception_override(text) to authenticated;

revoke all on function public.get_published_master_overrides() from public, service_role;
grant execute on function public.get_published_master_overrides() to anon, authenticated;

commit;
