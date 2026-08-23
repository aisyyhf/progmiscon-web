with target_functions(function_name) as (
  values
    ('get_admin_review_consensus'::text),
    ('get_admin_reviewer_profiles'::text),
    ('get_answer_review_counts'::text),
    ('get_my_review_status'::text),
    ('get_published_master_overrides'::text),
    ('get_question_review_counts'::text),
    ('prevent_repeat_lecturer_review_update'::text),
    ('publish_answer_misconception_override'::text),
    ('publish_question_misconception_override'::text),
    ('sync_master_relation_baselines'::text)
)
select
  namespace.nspname::text as schema_name,
  function_object.proname::text as function_name,
  pg_catalog.pg_get_function_identity_arguments(function_object.oid)
    as identity_arguments,
  pg_catalog.pg_get_userbyid(function_object.proowner) as owner_name,
  function_object.prosecdef::text as security_definer,
  function_object.provolatile::text as volatility,
  coalesce(to_jsonb(function_object.proconfig), '[]'::jsonb)::text
    as function_config,
  coalesce(
    function_object.proacl,
    pg_catalog.acldefault('f', function_object.proowner)
  )::text as acl,
  pg_catalog.has_function_privilege('anon', function_object.oid, 'EXECUTE')::text
    as anon_execute,
  pg_catalog.has_function_privilege('authenticated', function_object.oid, 'EXECUTE')::text
    as authenticated_execute,
  pg_catalog.has_function_privilege('service_role', function_object.oid, 'EXECUTE')::text
    as service_role_execute,
  pg_catalog.pg_get_functiondef(function_object.oid) as definition
from pg_catalog.pg_proc function_object
join pg_catalog.pg_namespace namespace on namespace.oid = function_object.pronamespace
join target_functions target on target.function_name = function_object.proname
where namespace.nspname = 'public'
order by namespace.nspname, function_object.proname,
  pg_catalog.pg_get_function_identity_arguments(function_object.oid)
