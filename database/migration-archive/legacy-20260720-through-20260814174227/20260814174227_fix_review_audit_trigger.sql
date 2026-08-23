-- Progmiscon
-- Make the shared Review v3 audit trigger safe for both review row types.
-- The historical Review v3 audit migration is not present in this repository,
-- so preserve the installed function verbatim and replace only the two fields
-- that are not shared by question_reviews and answer_reviews.

begin;

do $$
declare
  audit_function_oid oid;
  installed_function_oid oid;
  original_definition text;
  patched_definition text;
  installed_definition text;
  unsafe_new_pattern constant text :=
    '\mnew\M[[:space:]]*\.[[:space:]]*answer_id\M';
  unsafe_old_pattern constant text :=
    '\mold\M[[:space:]]*\.[[:space:]]*answer_id\M';
  required_tokens constant text[] := array[
    'tg_table_name',
    '''created''',
    '''edited''',
    '''deleted''',
    '''source_updated''',
    '''reactivated''',
    '''hard_deleted''',
    'review_id',
    'reviewer_id',
    'target_id',
    'question_id',
    'source_version',
    'before_data',
    'after_data'
  ];
  required_token text;
  expected_table text;
  expected_trigger text;
begin
  select function_object.oid
    into strict audit_function_oid
  from pg_catalog.pg_proc as function_object
  inner join pg_catalog.pg_namespace as function_schema
    on function_schema.oid = function_object.pronamespace
  where function_schema.nspname = 'public'
    and function_object.proname = 'log_review_audit'
    and pg_catalog.pg_get_function_identity_arguments(function_object.oid) = ''
    and function_object.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype;

  original_definition := pg_catalog.pg_get_functiondef(audit_function_oid);

  foreach required_token in array required_tokens loop
    if pg_catalog.strpos(
      pg_catalog.lower(original_definition),
      required_token
    ) = 0 then
      raise exception using
        message = 'UNEXPECTED_REVIEW_AUDIT_FUNCTION',
        detail = 'Missing required audit token: ' || required_token;
    end if;
  end loop;

  if original_definition !~* unsafe_new_pattern
    or original_definition !~* unsafe_old_pattern then
    raise exception using
      message = 'UNEXPECTED_REVIEW_AUDIT_FUNCTION',
      detail = 'Expected direct NEW.answer_id and OLD.answer_id access was not found.';
  end if;

  patched_definition := pg_catalog.regexp_replace(
    original_definition,
    unsafe_new_pattern,
    '(pg_catalog.to_jsonb(NEW) ->> ''answer_id'')',
    'gi'
  );
  patched_definition := pg_catalog.regexp_replace(
    patched_definition,
    unsafe_old_pattern,
    '(pg_catalog.to_jsonb(OLD) ->> ''answer_id'')',
    'gi'
  );

  if patched_definition ~* unsafe_new_pattern
    or patched_definition ~* unsafe_old_pattern then
    raise exception using message = 'UNSAFE_REVIEW_AUDIT_FUNCTION';
  end if;

  execute patched_definition;

  select
    function_object.oid,
    pg_catalog.pg_get_functiondef(function_object.oid)
    into strict installed_function_oid, installed_definition
  from pg_catalog.pg_proc as function_object
  inner join pg_catalog.pg_namespace as function_schema
    on function_schema.oid = function_object.pronamespace
  where function_schema.nspname = 'public'
    and function_object.proname = 'log_review_audit'
    and pg_catalog.pg_get_function_identity_arguments(function_object.oid) = ''
    and function_object.prorettype = 'pg_catalog.trigger'::pg_catalog.regtype;

  if installed_function_oid <> audit_function_oid
    or installed_definition ~* unsafe_new_pattern
    or installed_definition ~* unsafe_old_pattern
    or pg_catalog.strpos(
      installed_definition,
      '(pg_catalog.to_jsonb(NEW) ->> ''answer_id'')'
    ) = 0
    or pg_catalog.strpos(
      installed_definition,
      '(pg_catalog.to_jsonb(OLD) ->> ''answer_id'')'
    ) = 0 then
    raise exception using message = 'REVIEW_AUDIT_PATCH_VERIFICATION_FAILED';
  end if;

  for expected_table, expected_trigger in
    select expected.table_name, expected.trigger_name
    from (
      values
        ('question_reviews'::text, 'question_reviews_audit'::text),
        ('answer_reviews'::text, 'answer_reviews_audit'::text)
    ) as expected(table_name, trigger_name)
  loop
    if not exists (
      select 1
      from pg_catalog.pg_trigger as trigger_object
      inner join pg_catalog.pg_class as review_table
        on review_table.oid = trigger_object.tgrelid
      inner join pg_catalog.pg_namespace as table_schema
        on table_schema.oid = review_table.relnamespace
      where table_schema.nspname = 'public'
        and review_table.relname = expected_table
        and trigger_object.tgname = expected_trigger
        and trigger_object.tgfoid = audit_function_oid
        and not trigger_object.tgisinternal
        and trigger_object.tgenabled in ('O', 'A')
        and (trigger_object.tgtype::integer & 1) <> 0
        and (trigger_object.tgtype::integer & 2) = 0
        and (trigger_object.tgtype::integer & 4) <> 0
        and (trigger_object.tgtype::integer & 8) <> 0
        and (trigger_object.tgtype::integer & 16) <> 0
        and (trigger_object.tgtype::integer & 64) = 0
    ) then
      raise exception using
        message = 'REVIEW_AUDIT_TRIGGER_MISSING_OR_DISABLED',
        detail = expected_trigger || ' on public.' || expected_table;
    end if;
  end loop;
end;
$$;

commit;
