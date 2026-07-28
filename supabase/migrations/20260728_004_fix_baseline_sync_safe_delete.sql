-- Progmiscon
-- Replace baseline sync with Supabase safe-update compatible deletes.

begin;

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

revoke all on function public.sync_master_relation_baselines(jsonb, jsonb, text[])
  from public, anon, service_role;
grant execute on function public.sync_master_relation_baselines(jsonb, jsonb, text[])
  to authenticated;

commit;
