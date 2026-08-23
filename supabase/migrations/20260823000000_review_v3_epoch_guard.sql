-- First migration in the Review-v3 production epoch.
-- Assertion-only: this transaction must not change application schema or data.
begin;

do $review_v3_epoch_guard$
declare
  failure_detail text;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('review_v3_migration_epoch_guard', 0)
  );

  with expected(table_name) as (
    values
      ('question_misconception_baselines'::text),
      ('answer_misconception_baselines'::text),
      ('master_misconception_catalog'::text),
      ('question_misconception_overrides'::text),
      ('answer_misconception_overrides'::text),
      ('question_reviews'::text),
      ('answer_reviews'::text),
      ('review_audit_log'::text)
  )
  select pg_catalog.string_agg(expected.table_name, ', ' order by expected.table_name)
    into failure_detail
  from expected
  left join pg_catalog.pg_namespace namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
  where relation.oid is null
     or relation.relkind <> 'r'
     or pg_catalog.pg_get_userbyid(relation.relowner) <> 'postgres'
     or relation.relrowsecurity is not true
     or relation.relforcerowsecurity is not false;

  if failure_detail is not null then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'TABLE_CONTRACT: ' || failure_detail,
      errcode = 'P0001';
  end if;

  with expected(table_name, column_name, type_name, expected_not_null) as (
    values
      ('lecturer_profiles', 'user_id', 'uuid', true),
      ('lecturer_profiles', 'active', 'boolean', true),
      ('question_misconception_baselines', 'question_id', 'text', true),
      ('question_misconception_baselines', 'misconception_ids', 'text[]', true),
      ('question_misconception_baselines', 'synced_by', 'uuid', false),
      ('question_misconception_baselines', 'synced_at', 'timestamp with time zone', true),
      ('question_misconception_baselines', 'source_version', 'uuid', false),
      ('question_misconception_baselines', 'source_fingerprint', 'text', false),
      ('answer_misconception_baselines', 'answer_id', 'text', true),
      ('answer_misconception_baselines', 'question_id', 'text', true),
      ('answer_misconception_baselines', 'misconception_ids', 'text[]', true),
      ('answer_misconception_baselines', 'synced_by', 'uuid', false),
      ('answer_misconception_baselines', 'synced_at', 'timestamp with time zone', true),
      ('answer_misconception_baselines', 'source_version', 'uuid', false),
      ('answer_misconception_baselines', 'source_fingerprint', 'text', false),
      ('master_misconception_catalog', 'misconception_id', 'text', true),
      ('master_misconception_catalog', 'synced_by', 'uuid', false),
      ('master_misconception_catalog', 'synced_at', 'timestamp with time zone', true),
      ('question_misconception_overrides', 'question_id', 'text', true),
      ('question_misconception_overrides', 'misconception_ids', 'text[]', true),
      ('question_misconception_overrides', 'source_review_count', 'integer', true),
      ('question_misconception_overrides', 'published_by', 'uuid', false),
      ('question_misconception_overrides', 'published_at', 'timestamp with time zone', true),
      ('question_misconception_overrides', 'updated_at', 'timestamp with time zone', true),
      ('question_misconception_overrides', 'source_version', 'uuid', true),
      ('answer_misconception_overrides', 'answer_id', 'text', true),
      ('answer_misconception_overrides', 'question_id', 'text', true),
      ('answer_misconception_overrides', 'misconception_ids', 'text[]', true),
      ('answer_misconception_overrides', 'source_review_count', 'integer', true),
      ('answer_misconception_overrides', 'published_by', 'uuid', false),
      ('answer_misconception_overrides', 'published_at', 'timestamp with time zone', true),
      ('answer_misconception_overrides', 'updated_at', 'timestamp with time zone', true),
      ('answer_misconception_overrides', 'source_version', 'uuid', true),
      ('question_reviews', 'id', 'uuid', true),
      ('question_reviews', 'reviewer_id', 'uuid', true),
      ('question_reviews', 'question_id', 'text', true),
      ('question_reviews', 'has_incorrect_misconceptions', 'boolean', true),
      ('question_reviews', 'removed_misconception_ids', 'text[]', true),
      ('question_reviews', 'removal_reason', 'text', false),
      ('question_reviews', 'has_additional_misconceptions', 'boolean', true),
      ('question_reviews', 'additional_misconception_ids', 'text[]', true),
      ('question_reviews', 'addition_reason', 'text', false),
      ('question_reviews', 'note', 'text', false),
      ('question_reviews', 'created_at', 'timestamp with time zone', true),
      ('question_reviews', 'updated_at', 'timestamp with time zone', true),
      ('question_reviews', 'source_version', 'uuid', true),
      ('question_reviews', 'is_active', 'boolean', true),
      ('question_reviews', 'inactive_reason', 'text', false),
      ('question_reviews', 'inactive_at', 'timestamp with time zone', false),
      ('answer_reviews', 'id', 'uuid', true),
      ('answer_reviews', 'reviewer_id', 'uuid', true),
      ('answer_reviews', 'answer_id', 'text', true),
      ('answer_reviews', 'question_id', 'text', true),
      ('answer_reviews', 'has_mismatched_misconceptions', 'boolean', true),
      ('answer_reviews', 'removed_misconception_ids', 'text[]', true),
      ('answer_reviews', 'removal_reason', 'text', false),
      ('answer_reviews', 'has_additional_misconceptions', 'boolean', true),
      ('answer_reviews', 'additional_misconception_ids', 'text[]', true),
      ('answer_reviews', 'addition_reason', 'text', false),
      ('answer_reviews', 'note', 'text', false),
      ('answer_reviews', 'created_at', 'timestamp with time zone', true),
      ('answer_reviews', 'updated_at', 'timestamp with time zone', true),
      ('answer_reviews', 'source_version', 'uuid', true),
      ('answer_reviews', 'is_active', 'boolean', true),
      ('answer_reviews', 'inactive_reason', 'text', false),
      ('answer_reviews', 'inactive_at', 'timestamp with time zone', false),
      ('review_audit_log', 'id', 'uuid', true),
      ('review_audit_log', 'review_type', 'text', true),
      ('review_audit_log', 'review_id', 'uuid', true),
      ('review_audit_log', 'reviewer_id', 'uuid', true),
      ('review_audit_log', 'target_id', 'text', true),
      ('review_audit_log', 'question_id', 'text', false),
      ('review_audit_log', 'source_version', 'uuid', false),
      ('review_audit_log', 'event_type', 'text', true),
      ('review_audit_log', 'before_data', 'jsonb', false),
      ('review_audit_log', 'after_data', 'jsonb', false),
      ('review_audit_log', 'occurred_at', 'timestamp with time zone', true)
  )
  select pg_catalog.string_agg(
    expected.table_name || '.' || expected.column_name,
    ', ' order by expected.table_name, expected.column_name
  ) into failure_detail
  from expected
  left join pg_catalog.pg_namespace namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
   and relation.relkind = 'r'
  left join pg_catalog.pg_attribute attribute
    on attribute.attrelid = relation.oid
   and attribute.attname = expected.column_name
   and attribute.attnum > 0
   and not attribute.attisdropped
  where attribute.attnum is null
     or pg_catalog.format_type(attribute.atttypid, attribute.atttypmod) <> expected.type_name
     or attribute.attnotnull is distinct from expected.expected_not_null;

  if failure_detail is not null then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'COLUMN_CONTRACT: ' || failure_detail,
      errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.question_misconception_baselines
    where source_version is null
  ) or exists (
    select 1 from public.answer_misconception_baselines
    where source_version is null
  ) then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'BASELINE_SOURCE_VERSION_NOT_POPULATED',
      errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.question_reviews
    where (is_active and (inactive_reason is not null or inactive_at is not null))
       or (not is_active and (
         inactive_reason is null
         or inactive_reason not in ('deleted', 'source_updated')
         or inactive_at is null
       ))
  ) or exists (
    select 1 from public.answer_reviews
    where (is_active and (inactive_reason is not null or inactive_at is not null))
       or (not is_active and (
         inactive_reason is null
         or inactive_reason not in ('deleted', 'source_updated')
         or inactive_at is null
       ))
  ) then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'MALFORMED_REVIEW_LIFECYCLE',
      errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.question_reviews review
    left join public.question_misconception_baselines baseline
      on baseline.question_id = review.question_id
     and baseline.source_version = review.source_version
    where review.is_active and baseline.question_id is null
  ) then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'ACTIVE_QUESTION_REVIEW_SOURCE_VERSION_MISMATCH',
      errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.answer_reviews review
    left join public.answer_misconception_baselines baseline
      on baseline.answer_id = review.answer_id
     and baseline.question_id = review.question_id
     and baseline.source_version = review.source_version
    where review.is_active and baseline.answer_id is null
  ) then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'ACTIVE_ANSWER_REVIEW_SOURCE_VERSION_OR_PARENT_MISMATCH',
      errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.question_misconception_overrides override_row
    left join public.question_misconception_baselines baseline
      on baseline.question_id = override_row.question_id
     and baseline.source_version = override_row.source_version
    where baseline.question_id is null
  ) or exists (
    select 1
    from public.answer_misconception_overrides override_row
    left join public.answer_misconception_baselines baseline
      on baseline.answer_id = override_row.answer_id
     and baseline.question_id = override_row.question_id
     and baseline.source_version = override_row.source_version
    where baseline.answer_id is null
  ) then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'OVERRIDE_SOURCE_VERSION_OR_PARENT_MISMATCH',
      errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.question_reviews
    group by reviewer_id, question_id, source_version
    having pg_catalog.count(*) > 1
  ) or exists (
    select 1 from public.answer_reviews
    group by reviewer_id, answer_id, source_version
    having pg_catalog.count(*) > 1
  ) then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'DUPLICATE_REVIEWER_TARGET_SOURCE_VERSION',
      errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.question_reviews
    where is_active
    group by question_id, source_version
    having pg_catalog.count(distinct reviewer_id) > 3
  ) or exists (
    select 1 from public.answer_reviews
    where is_active
    group by answer_id, source_version
    having pg_catalog.count(distinct reviewer_id) > 3
  ) then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'ACTIVE_REVIEWER_CAP_EXCEEDED',
      errcode = 'P0001';
  end if;

  with expected(table_name, constraint_name, constraint_type, definition) as (
    values
      ('question_misconception_baselines', 'question_misconception_baselines_pkey', 'p', 'PRIMARY KEY (question_id)'),
      ('answer_misconception_baselines', 'answer_misconception_baselines_pkey', 'p', 'PRIMARY KEY (answer_id)'),
      ('master_misconception_catalog', 'master_misconception_catalog_pkey', 'p', 'PRIMARY KEY (misconception_id)'),
      ('question_misconception_overrides', 'question_misconception_overrides_pkey', 'p', 'PRIMARY KEY (question_id)'),
      ('answer_misconception_overrides', 'answer_misconception_overrides_pkey', 'p', 'PRIMARY KEY (answer_id)'),
      ('question_reviews', 'question_reviews_pkey', 'p', 'PRIMARY KEY (id)'),
      ('answer_reviews', 'answer_reviews_pkey', 'p', 'PRIMARY KEY (id)'),
      ('review_audit_log', 'review_audit_log_pkey', 'p', 'PRIMARY KEY (id)'),
      ('question_misconception_baselines', 'question_misconception_baselines_synced_by_fkey', 'f', 'FOREIGN KEY (synced_by) REFERENCES lecturer_profiles(user_id)'),
      ('answer_misconception_baselines', 'answer_misconception_baselines_synced_by_fkey', 'f', 'FOREIGN KEY (synced_by) REFERENCES lecturer_profiles(user_id)'),
      ('master_misconception_catalog', 'master_misconception_catalog_synced_by_fkey', 'f', 'FOREIGN KEY (synced_by) REFERENCES lecturer_profiles(user_id)'),
      ('question_misconception_overrides', 'question_misconception_overrides_published_by_fkey', 'f', 'FOREIGN KEY (published_by) REFERENCES lecturer_profiles(user_id)'),
      ('answer_misconception_overrides', 'answer_misconception_overrides_published_by_fkey', 'f', 'FOREIGN KEY (published_by) REFERENCES lecturer_profiles(user_id)'),
      ('question_reviews', 'question_reviews_reviewer_id_fkey', 'f', 'FOREIGN KEY (reviewer_id) REFERENCES lecturer_profiles(user_id) ON DELETE CASCADE'),
      ('answer_reviews', 'answer_reviews_reviewer_id_fkey', 'f', 'FOREIGN KEY (reviewer_id) REFERENCES lecturer_profiles(user_id) ON DELETE CASCADE'),
      ('question_reviews', 'question_reviews_reviewer_question_version_key', 'u', 'UNIQUE (reviewer_id, question_id, source_version)'),
      ('answer_reviews', 'answer_reviews_reviewer_answer_version_key', 'u', 'UNIQUE (reviewer_id, answer_id, source_version)'),
      ('question_reviews', 'question_reviews_inactive_state_check', 'c', 'CHECK (is_active = true AND inactive_reason IS NULL AND inactive_at IS NULL OR is_active = false AND (inactive_reason = ANY (ARRAY[''deleted''::text, ''source_updated''::text])) AND inactive_at IS NOT NULL)'),
      ('answer_reviews', 'answer_reviews_inactive_state_check', 'c', 'CHECK (is_active = true AND inactive_reason IS NULL AND inactive_at IS NULL OR is_active = false AND (inactive_reason = ANY (ARRAY[''deleted''::text, ''source_updated''::text])) AND inactive_at IS NOT NULL)')
  )
  select pg_catalog.string_agg(
    expected.table_name || '.' || expected.constraint_name,
    ', ' order by expected.table_name, expected.constraint_name
  ) into failure_detail
  from expected
  left join pg_catalog.pg_namespace namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
  left join pg_catalog.pg_constraint constraint_object
    on constraint_object.conrelid = relation.oid
   and constraint_object.conname = expected.constraint_name
  where constraint_object.oid is null
     or constraint_object.contype::text <> expected.constraint_type
     or constraint_object.convalidated is not true
     or constraint_object.condeferrable is not false
     or constraint_object.condeferred is not false
     or pg_catalog.pg_get_constraintdef(constraint_object.oid, true) <> expected.definition;

  if failure_detail is not null then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'CONSTRAINT_CONTRACT: ' || failure_detail,
      errcode = 'P0001';
  end if;

  with expected(table_name, index_name, definition) as (
    values
      ('question_reviews', 'question_reviews_active_target_version_idx', 'CREATE INDEX question_reviews_active_target_version_idx ON public.question_reviews USING btree (question_id, source_version) WHERE (is_active = true)'),
      ('answer_reviews', 'answer_reviews_active_target_version_idx', 'CREATE INDEX answer_reviews_active_target_version_idx ON public.answer_reviews USING btree (answer_id, source_version) WHERE (is_active = true)')
  )
  select pg_catalog.string_agg(
    expected.table_name || '.' || expected.index_name,
    ', ' order by expected.table_name, expected.index_name
  ) into failure_detail
  from expected
  left join pg_catalog.pg_namespace namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
  left join pg_catalog.pg_class index_relation
    on index_relation.relnamespace = namespace.oid
   and index_relation.relname = expected.index_name
  left join pg_catalog.pg_index index_object
    on index_object.indrelid = relation.oid
   and index_object.indexrelid = index_relation.oid
  where index_object.indexrelid is null
     or index_object.indisvalid is not true
     or index_object.indisready is not true
     or pg_catalog.pg_get_indexdef(index_object.indexrelid) <> expected.definition;

  if failure_detail is not null then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'ACTIVE_TARGET_VERSION_INDEX_CONTRACT: ' || failure_detail,
      errcode = 'P0001';
  end if;

  -- Frozen from the committed Review-v3 V2 contract fixture. pg_policies
  -- provides the catalog-rendered expression; whitespace is not semantic.
  with authoritative_own_write(expression) as (
    values (
      '((( SELECT auth.uid() AS uid) = reviewer_id) AND (EXISTS ( SELECT 1
         FROM lecturer_profiles profile
        WHERE ((profile.user_id = ( SELECT auth.uid() AS uid)) AND (profile.active = true)))))'::text
    )
  ),
  expected(table_name, policy_name, command, rule_kind) as (
    values
      ('question_reviews', 'Admins can read all question reviews', 'SELECT', 'admin'),
      ('question_reviews', 'Lecturers can create their own question reviews', 'INSERT', 'own_insert'),
      ('question_reviews', 'Lecturers can read their own question reviews', 'SELECT', 'own_read'),
      ('question_reviews', 'Lecturers can update their own question reviews', 'UPDATE', 'own_update'),
      ('answer_reviews', 'Admins can read all answer reviews', 'SELECT', 'admin'),
      ('answer_reviews', 'Lecturers can create their own answer reviews', 'INSERT', 'own_insert'),
      ('answer_reviews', 'Lecturers can read their own answer reviews', 'SELECT', 'own_read'),
      ('answer_reviews', 'Lecturers can update their own answer reviews', 'UPDATE', 'own_update'),
      ('review_audit_log', 'Lecturers can read their own review audit', 'SELECT', 'audit_read')
  )
  select pg_catalog.string_agg(
    expected.table_name || '.' || expected.policy_name,
    ', ' order by expected.table_name, expected.policy_name
  ) into failure_detail
  from expected
  left join pg_catalog.pg_policies policy
    on policy.schemaname = 'public'
   and policy.tablename = expected.table_name
   and policy.policyname = expected.policy_name
  where policy.policyname is null
     or policy.cmd <> expected.command
     or policy.permissive <> 'PERMISSIVE'
     or policy.roles::text <> '{authenticated}'
     or case expected.rule_kind
       when 'admin' then policy.qual is null
         or policy.qual not like '%current_user_is_admin()%'
         or policy.with_check is not null
       when 'own_read' then policy.qual is null
         or policy.qual not like '%auth.uid()%'
         or policy.qual not like '%lecturer_profiles%'
         or policy.with_check is not null
       when 'own_insert' then policy.qual is not null
         or pg_catalog.regexp_replace(
           pg_catalog.lower(policy.with_check),
           '[[:space:]]+',
           '',
           'g'
         ) is distinct from (
           select pg_catalog.regexp_replace(
             pg_catalog.lower(authoritative_own_write.expression),
             '[[:space:]]+',
             '',
             'g'
           )
           from authoritative_own_write
         )
       when 'own_update' then pg_catalog.regexp_replace(
           pg_catalog.lower(policy.qual),
           '[[:space:]]+',
           '',
           'g'
         ) is distinct from (
           select pg_catalog.regexp_replace(
             pg_catalog.lower(authoritative_own_write.expression),
             '[[:space:]]+',
             '',
             'g'
           )
           from authoritative_own_write
         )
         or pg_catalog.regexp_replace(
           pg_catalog.lower(policy.with_check),
           '[[:space:]]+',
           '',
           'g'
         ) is distinct from (
           select pg_catalog.regexp_replace(
             pg_catalog.lower(authoritative_own_write.expression),
             '[[:space:]]+',
             '',
             'g'
           )
           from authoritative_own_write
         )
       when 'audit_read' then policy.qual is null
         or policy.qual not like '%reviewer_id%'
         or policy.qual not like '%current_user_is_admin()%'
         or policy.with_check is not null
       else true
     end;

  if failure_detail is not null or (
    select pg_catalog.count(*)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename in (
        'question_misconception_baselines',
        'answer_misconception_baselines',
        'master_misconception_catalog',
        'question_misconception_overrides',
        'answer_misconception_overrides',
        'question_reviews',
        'answer_reviews',
        'review_audit_log'
      )
  ) <> 9 then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'RLS_POLICY_CONTRACT: ' || coalesce(failure_detail, 'unexpected policy set'),
      errcode = 'P0001';
  end if;

  with expected(table_name, trigger_name, function_name, trigger_type) as (
    values
      ('question_reviews', 'question_reviews_set_updated_at', 'set_updated_at', 19),
      ('answer_reviews', 'answer_reviews_set_updated_at', 'set_updated_at', 19),
      ('question_reviews', 'question_reviews_audit', 'log_review_audit', 29),
      ('answer_reviews', 'answer_reviews_audit', 'log_review_audit', 29),
      ('question_misconception_overrides', 'question_misconception_overrides_set_updated_at', 'set_updated_at', 19),
      ('answer_misconception_overrides', 'answer_misconception_overrides_set_updated_at', 'set_updated_at', 19)
  )
  select pg_catalog.string_agg(
    expected.table_name || '.' || expected.trigger_name,
    ', ' order by expected.table_name, expected.trigger_name
  ) into failure_detail
  from expected
  left join pg_catalog.pg_namespace namespace
    on namespace.nspname = 'public'
  left join pg_catalog.pg_class relation
    on relation.relnamespace = namespace.oid
   and relation.relname = expected.table_name
  left join pg_catalog.pg_trigger trigger_object
    on trigger_object.tgrelid = relation.oid
   and trigger_object.tgname = expected.trigger_name
   and not trigger_object.tgisinternal
  left join pg_catalog.pg_proc trigger_function
    on trigger_function.oid = trigger_object.tgfoid
  left join pg_catalog.pg_namespace function_namespace
    on function_namespace.oid = trigger_function.pronamespace
  where trigger_object.oid is null
     or trigger_object.tgenabled <> 'O'
     or trigger_object.tgtype <> expected.trigger_type
     or function_namespace.nspname <> 'public'
     or trigger_function.proname <> expected.function_name
     or pg_catalog.pg_get_function_identity_arguments(trigger_function.oid) <> '';

  if failure_detail is not null or (
    select pg_catalog.count(*)
    from pg_catalog.pg_trigger trigger_object
    join pg_catalog.pg_class relation on relation.oid = trigger_object.tgrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and not trigger_object.tgisinternal
      and relation.relname in (
        'question_misconception_baselines',
        'answer_misconception_baselines',
        'master_misconception_catalog',
        'question_misconception_overrides',
        'answer_misconception_overrides',
        'question_reviews',
        'answer_reviews',
        'review_audit_log'
      )
  ) <> 6 then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'TRIGGER_CONTRACT: ' || coalesce(failure_detail, 'expected exactly six scoped user triggers'),
      errcode = 'P0001';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_trigger trigger_object
    join pg_catalog.pg_class relation on relation.oid = trigger_object.tgrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('question_reviews', 'answer_reviews')
      and trigger_object.tgname in (
        'question_reviews_enforce_cap',
        'answer_reviews_enforce_cap',
        'question_reviews_prevent_repeat_lecturer_update',
        'answer_reviews_prevent_repeat_lecturer_update'
      )
      and not trigger_object.tgisinternal
  ) then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'FORBIDDEN_LEGACY_REVIEW_TRIGGER',
      errcode = 'P0001';
  end if;

  with expected(
    function_name,
    signature,
    identity_arguments,
    volatility,
    anon_execute,
    authenticated_execute,
    service_role_execute
  ) as (
    values
      ('current_user_is_admin', 'public.current_user_is_admin()', '', 's', true, true, true),
      ('delete_answer_review_v3', 'public.delete_answer_review_v3(text,uuid)', 'p_answer_id text, p_source_version uuid', 'v', false, true, true),
      ('delete_question_review_v3', 'public.delete_question_review_v3(text,uuid)', 'p_question_id text, p_source_version uuid', 'v', false, true, true),
      ('get_review_source_versions', 'public.get_review_source_versions()', '', 's', false, true, false),
      ('recompute_answer_review_consensus_v3', 'public.recompute_answer_review_consensus_v3(text,uuid)', 'p_answer_id text, p_source_version uuid', 'v', false, false, true),
      ('recompute_question_review_consensus_v3', 'public.recompute_question_review_consensus_v3(text,uuid)', 'p_question_id text, p_source_version uuid', 'v', false, false, true),
      ('save_answer_review_v3', 'public.save_answer_review_v3(text,uuid,boolean,text[],text,boolean,text[],text,text)', 'p_answer_id text, p_source_version uuid, p_has_mismatched_misconceptions boolean, p_removed_misconception_ids text[], p_removal_reason text, p_has_additional_misconceptions boolean, p_additional_misconception_ids text[], p_addition_reason text, p_note text', 'v', false, true, true),
      ('save_question_review_v3', 'public.save_question_review_v3(text,uuid,boolean,text[],text,boolean,text[],text,text)', 'p_question_id text, p_source_version uuid, p_has_incorrect_misconceptions boolean, p_removed_misconception_ids text[], p_removal_reason text, p_has_additional_misconceptions boolean, p_additional_misconception_ids text[], p_addition_reason text, p_note text', 'v', false, true, true),
      ('sync_master_relation_baselines_v2', 'public.sync_master_relation_baselines_v2(jsonb,jsonb,text[])', 'input_question_baselines jsonb, input_answer_baselines jsonb, input_misconception_ids text[]', 'v', false, false, true),
      -- The sole documented replay/production exception: legacy v1 may be
      -- postgres-only (fresh replay) or additionally authenticated (production).
      ('sync_master_relation_baselines', 'public.sync_master_relation_baselines(jsonb,jsonb,text[])', 'input_question_baselines jsonb, input_answer_baselines jsonb, input_misconception_ids text[]', 'v', false, null, false)
  )
  select pg_catalog.string_agg(expected.function_name, ', ' order by expected.function_name)
    into failure_detail
  from expected
  left join pg_catalog.pg_proc function_object
    on function_object.oid = pg_catalog.to_regprocedure(expected.signature)
  where function_object.oid is null
     or pg_catalog.pg_get_userbyid(function_object.proowner) <> 'postgres'
     or function_object.prosecdef is not true
     or function_object.provolatile::text <> expected.volatility
     or function_object.proconfig is distinct from array['search_path=""']::text[]
     or pg_catalog.pg_get_function_identity_arguments(function_object.oid) <> expected.identity_arguments
     or pg_catalog.has_function_privilege('anon', function_object.oid, 'EXECUTE') is distinct from expected.anon_execute
     or (
       expected.authenticated_execute is not null
       and pg_catalog.has_function_privilege('authenticated', function_object.oid, 'EXECUTE') is distinct from expected.authenticated_execute
     )
     or pg_catalog.has_function_privilege('service_role', function_object.oid, 'EXECUTE') is distinct from expected.service_role_execute;

  if failure_detail is not null then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'FUNCTION_CONTRACT_OR_EXPOSURE: ' || failure_detail,
      errcode = 'P0001';
  end if;

  with expected(function_name) as (
    values
      ('current_user_is_admin'::text),
      ('delete_answer_review_v3'::text),
      ('delete_question_review_v3'::text),
      ('get_review_source_versions'::text),
      ('recompute_answer_review_consensus_v3'::text),
      ('recompute_question_review_consensus_v3'::text),
      ('save_answer_review_v3'::text),
      ('save_question_review_v3'::text),
      ('sync_master_relation_baselines_v2'::text),
      ('sync_master_relation_baselines'::text)
  )
  select pg_catalog.string_agg(expected.function_name, ', ' order by expected.function_name)
    into failure_detail
  from expected
  left join lateral (
    select pg_catalog.count(*) as overload_count
    from pg_catalog.pg_proc function_object
    join pg_catalog.pg_namespace namespace
      on namespace.oid = function_object.pronamespace
    where namespace.nspname = 'public'
      and function_object.proname = expected.function_name
  ) found on true
  where found.overload_count <> 1;

  if failure_detail is not null then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'FUNCTION_SIGNATURE_SET: ' || failure_detail,
      errcode = 'P0001';
  end if;

  with guarded(signature) as (
    values
      ('public.current_user_is_admin()'::text),
      ('public.delete_answer_review_v3(text,uuid)'::text),
      ('public.delete_question_review_v3(text,uuid)'::text),
      ('public.get_review_source_versions()'::text),
      ('public.recompute_answer_review_consensus_v3(text,uuid)'::text),
      ('public.recompute_question_review_consensus_v3(text,uuid)'::text),
      ('public.save_answer_review_v3(text,uuid,boolean,text[],text,boolean,text[],text,text)'::text),
      ('public.save_question_review_v3(text,uuid,boolean,text[],text,boolean,text[],text,text)'::text),
      ('public.sync_master_relation_baselines_v2(jsonb,jsonb,text[])'::text),
      ('public.sync_master_relation_baselines(jsonb,jsonb,text[])'::text)
  )
  select pg_catalog.string_agg(guarded.signature, ', ' order by guarded.signature)
    into failure_detail
  from guarded
  join pg_catalog.pg_proc function_object
    on function_object.oid = pg_catalog.to_regprocedure(guarded.signature)
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      function_object.proacl,
      pg_catalog.acldefault('f', function_object.proowner)
    )
  ) function_grant
  where function_grant.grantee = 0::oid
    and function_grant.privilege_type = 'EXECUTE';

  if failure_detail is not null then
    raise exception using
      message = 'MIGRATION_EPOCH_GUARD_FAILED',
      detail = 'UNEXPECTED_PUBLIC_FUNCTION_EXECUTE: ' || failure_detail,
      errcode = 'P0001';
  end if;
end;
$review_v3_epoch_guard$;

commit;
