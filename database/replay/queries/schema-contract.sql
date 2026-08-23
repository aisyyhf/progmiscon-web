with target_tables(table_name) as (
  values
    ('question_misconception_baselines'::text),
    ('answer_misconception_baselines'::text),
    ('master_misconception_catalog'::text),
    ('question_misconception_overrides'::text),
    ('answer_misconception_overrides'::text),
    ('question_reviews'::text),
    ('answer_reviews'::text),
    ('review_audit_log'::text)
),
target_functions(function_name) as (
  values
    ('enforce_answer_review_cap'::text),
    ('enforce_question_review_cap'::text),
    ('log_review_audit'::text),
    ('normalize_text_id_array'::text),
    ('set_updated_at'::text)
),
contract_rows as (
  select
    'table'::text as object_kind,
    relation.relname::text as object_name,
    'null'::text as sub_name,
    jsonb_build_object(
      'owner', pg_catalog.pg_get_userbyid(relation.relowner),
      'relkind', relation.relkind::text,
      'rls_forced', relation.relforcerowsecurity,
      'rls_enabled', relation.relrowsecurity
    ) as details
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join target_tables target on target.table_name = relation.relname
  where namespace.nspname = 'public'

  union all

  select
    'column',
    relation.relname,
    attribute.attname,
    jsonb_build_object(
      'type', pg_catalog.format_type(attribute.atttypid, attribute.atttypmod),
      'default', pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid),
      'ordinal', attribute.attnum,
      'identity', nullif(attribute.attidentity, ''),
      'not_null', attribute.attnotnull,
      'generated', nullif(attribute.attgenerated, '')
    )
  from pg_catalog.pg_attribute attribute
  join pg_catalog.pg_class relation on relation.oid = attribute.attrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join target_tables target on target.table_name = relation.relname
  left join pg_catalog.pg_attrdef default_value
    on default_value.adrelid = attribute.attrelid
   and default_value.adnum = attribute.attnum
  where namespace.nspname = 'public'
    and attribute.attnum > 0
    and not attribute.attisdropped

  union all

  select
    'constraint',
    relation.relname,
    constraint_object.conname,
    jsonb_build_object(
      'deferred', constraint_object.condeferred,
      'validated', constraint_object.convalidated,
      'deferrable', constraint_object.condeferrable,
      'definition', pg_catalog.pg_get_constraintdef(constraint_object.oid, true),
      'constraint_type', constraint_object.contype::text
    )
  from pg_catalog.pg_constraint constraint_object
  join pg_catalog.pg_class relation on relation.oid = constraint_object.conrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join target_tables target on target.table_name = relation.relname
  where namespace.nspname = 'public'

  union all

  select
    'index',
    relation.relname,
    index_relation.relname,
    jsonb_build_object(
      'definition', pg_catalog.pg_get_indexdef(index_object.indexrelid)
    )
  from pg_catalog.pg_index index_object
  join pg_catalog.pg_class relation on relation.oid = index_object.indrelid
  join pg_catalog.pg_class index_relation on index_relation.oid = index_object.indexrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join target_tables target on target.table_name = relation.relname
  where namespace.nspname = 'public'

  union all

  select
    'policy',
    policy.tablename,
    policy.policyname,
    jsonb_build_object(
      'roles', to_jsonb(policy.roles),
      'using', policy.qual,
      'command', policy.cmd,
      'permissive', policy.permissive,
      'with_check', policy.with_check
    )
  from pg_catalog.pg_policies policy
  join target_tables target on target.table_name = policy.tablename
  where policy.schemaname = 'public'

  union all

  select
    'table_grant',
    relation.relname,
    case
      when table_grant.grantee = 0::oid then 'PUBLIC'::text
      else pg_catalog.pg_get_userbyid(table_grant.grantee)::text
    end,
    jsonb_build_object(
      'is_grantable', case
        when table_grant.is_grantable
          or table_grant.grantee = relation.relowner
        then 'YES'
        else 'NO'
      end,
      'privilege_type', table_grant.privilege_type
    )
  from pg_catalog.pg_class relation
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join target_tables target on target.table_name = relation.relname
  cross join lateral pg_catalog.aclexplode(
    coalesce(
      relation.relacl,
      pg_catalog.acldefault('r', relation.relowner)
    )
  ) table_grant
  where namespace.nspname = 'public'

  union all

  select
    'trigger',
    relation.relname,
    trigger_object.tgname,
    jsonb_build_object(
      'enabled', trigger_object.tgenabled::text,
      'function_name', trigger_function.proname,
      'function_schema', function_namespace.nspname,
      'trigger_definition', pg_catalog.pg_get_triggerdef(trigger_object.oid, true),
      'function_definition', pg_catalog.pg_get_functiondef(trigger_function.oid),
      'function_identity_arguments',
        pg_catalog.pg_get_function_identity_arguments(trigger_function.oid)
    )
  from pg_catalog.pg_trigger trigger_object
  join pg_catalog.pg_class relation on relation.oid = trigger_object.tgrelid
  join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
  join target_tables target on target.table_name = relation.relname
  join pg_catalog.pg_proc trigger_function on trigger_function.oid = trigger_object.tgfoid
  join pg_catalog.pg_namespace function_namespace
    on function_namespace.oid = trigger_function.pronamespace
  where namespace.nspname = 'public'
    and not trigger_object.tgisinternal

  union all

  select
    'function',
    function_object.proname,
    pg_catalog.pg_get_function_identity_arguments(function_object.oid),
    jsonb_build_object(
      'acl', to_jsonb(coalesce(
        function_object.proacl,
        pg_catalog.acldefault('f', function_object.proowner)
      )),
      'owner', pg_catalog.pg_get_userbyid(function_object.proowner),
      'config', coalesce(to_jsonb(function_object.proconfig), '[]'::jsonb),
      'definition', pg_catalog.pg_get_functiondef(function_object.oid),
      'volatility', function_object.provolatile::text,
      'anon_execute', pg_catalog.has_function_privilege(
        'anon',
        function_object.oid,
        'EXECUTE'
      ),
      'security_definer', function_object.prosecdef,
      'service_role_execute', pg_catalog.has_function_privilege(
        'service_role',
        function_object.oid,
        'EXECUTE'
      ),
      'authenticated_execute', pg_catalog.has_function_privilege(
        'authenticated',
        function_object.oid,
        'EXECUTE'
      )
    )
  from pg_catalog.pg_proc function_object
  join pg_catalog.pg_namespace namespace on namespace.oid = function_object.pronamespace
  join target_functions target on target.function_name = function_object.proname
  where namespace.nspname = 'public'
)
select object_kind, object_name, sub_name, details::text as details
from contract_rows
order by object_kind, object_name, sub_name, details::text
