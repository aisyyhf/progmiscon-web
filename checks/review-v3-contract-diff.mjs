import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

const fixtureDirectory = fileURLToPath(
  new URL("./fixtures/review-v3/", import.meta.url),
);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const contractFiles = [
  "production-review-schema-contracts.csv",
  "production-review-sync-contracts.csv",
  "production-review-runtime-functions.csv",
];

function parseArguments(argv) {
  const result = { actualDirectory: null, selfTest: false };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--self-test") result.selfTest = true;
    else if (argv[index] === "--actual-dir") {
      result.actualDirectory = resolve(argv[index + 1]);
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }
  return result;
}

async function readCsv(path) {
  const source = await readFile(path, "utf8");
  const parsed = Papa.parse(source, {
    header: true,
    skipEmptyLines: "greedy",
  });
  if (parsed.errors.length > 0) {
    throw new Error(
      `Invalid CSV ${path}: ${parsed.errors.map((item) => item.message).join("; ")}`,
    );
  }
  return parsed.data;
}

function normalizeLineEndings(value) {
  return typeof value === "string" ? value.replaceAll("\r\n", "\n") : value;
}

function canonicalJson(value, parentKey = "") {
  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalJson(item, parentKey));
    return ["acl", "config"].includes(parentKey)
      ? items.toSorted((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        )
      : items;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .toSorted()
        .map((key) => [key, canonicalJson(value[key], key)]),
    );
  }
  return normalizeLineEndings(value);
}

function parsePgArray(value) {
  if (!value || value === "{}") return [];
  assert.match(value, /^\{.*\}$/);
  return value
    .slice(1, -1)
    .split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((item) => item.replace(/^"|"$/g, "").replaceAll('\\"', '"'))
    .toSorted();
}

function canonicalFunctionRow(row) {
  return {
    ...row,
    definition: normalizeLineEndings(row.definition),
    function_config: JSON.stringify(
      canonicalJson(JSON.parse(row.function_config || "[]"), "config"),
    ),
    acl: JSON.stringify(parsePgArray(row.acl)),
  };
}

function functionIdentity(row) {
  return [row.schema_name, row.function_name, row.identity_arguments].join("|");
}

function canonicalSchemaRow(row) {
  const details = canonicalJson(JSON.parse(row.details));
  return {
    object_kind: row.object_kind,
    object_name: row.object_name,
    sub_name: row.sub_name,
    details: JSON.stringify(details),
  };
}

function schemaIdentity(row) {
  return [row.object_kind, row.object_name, row.sub_name].join("|");
}

function cloneRows(rows) {
  return rows.map((row) => ({ ...row }));
}

function exceptionFor(exceptions, file, row, field) {
  return exceptions.find(
    (exception) =>
      exception.contract === file &&
      exception.object.schema_name === row.schema_name &&
      exception.object.function_name === row.function_name &&
      exception.object.identity_arguments === row.identity_arguments &&
      exception.allowedFields.includes(field),
  );
}

function compareSchema(expectedRows, actualRows) {
  const expected = expectedRows
    .map(canonicalSchemaRow)
    .map((row) => JSON.stringify(row))
    .toSorted();
  const actual = actualRows
    .map(canonicalSchemaRow)
    .map((row) => JSON.stringify(row))
    .toSorted();
  if (JSON.stringify(expected) === JSON.stringify(actual)) return [];

  const expectedCounts = new Map();
  const actualCounts = new Map();
  for (const row of expectedRows.map(canonicalSchemaRow)) {
    const key = schemaIdentity(row);
    expectedCounts.set(key, [...(expectedCounts.get(key) ?? []), row.details]);
  }
  for (const row of actualRows.map(canonicalSchemaRow)) {
    const key = schemaIdentity(row);
    actualCounts.set(key, [...(actualCounts.get(key) ?? []), row.details]);
  }
  const errors = [];
  for (const key of new Set([...expectedCounts.keys(), ...actualCounts.keys()])) {
    const left = (expectedCounts.get(key) ?? []).toSorted();
    const right = (actualCounts.get(key) ?? []).toSorted();
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      errors.push(`${key}: expected ${JSON.stringify(left)}, actual ${JSON.stringify(right)}`);
    }
  }
  return errors;
}

function compareFunctions(file, expectedRows, actualRows, exceptions) {
  const expected = new Map(
    expectedRows.map((row) => [functionIdentity(row), canonicalFunctionRow(row)]),
  );
  const actual = new Map(
    actualRows.map((row) => [functionIdentity(row), canonicalFunctionRow(row)]),
  );
  const errors = [];

  for (const key of new Set([...expected.keys(), ...actual.keys()])) {
    const expectedRow = expected.get(key);
    const actualRow = actual.get(key);
    if (!expectedRow || !actualRow) {
      errors.push(`${key}: ${expectedRow ? "missing from fresh" : "unexpected in fresh"}`);
      continue;
    }
    for (const field of Object.keys(expectedRow)) {
      if (expectedRow[field] === actualRow[field]) continue;
      const approved = exceptionFor(exceptions, file, expectedRow, field);
      if (approved) {
        const expectedExceptionValue =
          field === "acl"
            ? JSON.stringify(parsePgArray(approved.production[field]))
            : String(approved.production[field]);
        const freshExceptionValue =
          field === "acl"
            ? JSON.stringify(parsePgArray(approved.fresh[field]))
            : String(approved.fresh[field]);
        if (
          expectedRow[field] === expectedExceptionValue &&
          actualRow[field] === freshExceptionValue
        ) {
          continue;
        }
      }
      errors.push(
        `${key}.${field}: expected ${JSON.stringify(expectedRow[field])}, actual ${JSON.stringify(actualRow[field])}`,
      );
    }
  }
  return errors;
}

export function compareContracts(file, expectedRows, actualRows, exceptions) {
  return file.includes("schema-contracts")
    ? compareSchema(expectedRows, actualRows)
    : compareFunctions(file, expectedRows, actualRows, exceptions);
}

function mutateDetails(row, changes) {
  return {
    ...row,
    details: JSON.stringify({ ...JSON.parse(row.details), ...changes }),
  };
}

function extractFunctionDefinition(sql, functionName) {
  const startExpression = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName.replaceAll("_", "\\_")}\\(`,
    "i",
  );
  const match = startExpression.exec(sql);
  assert.ok(match, `missing prerequisite function ${functionName}`);
  const end = sql.indexOf("$function$;", match.index);
  assert.notEqual(end, -1, `unterminated prerequisite function ${functionName}`);
  return sql.slice(match.index, end + "$function$".length);
}

async function runFoundationSelfTest(fixtures) {
  const prerequisite = normalizeLineEndings(
    await readFile(
      join(
        repositoryRoot,
        "database",
        "replay",
        "review-v3-legacy-prerequisite.sql",
      ),
      "utf8",
    ),
  );
  const manifest = JSON.parse(
    await readFile(
      join(repositoryRoot, "database", "replay", "review-v3-manifest.json"),
      "utf8",
    ),
  );
  const schemaContractQuery = normalizeLineEndings(
    await readFile(
      join(repositoryRoot, "database", "replay", "queries", "schema-contract.sql"),
      "utf8",
    ),
  );
  assert.equal(manifest.productionDeployable, false);
  assert.deepEqual(
    manifest.entries.map((entry) => entry.order),
    manifest.entries.map((entry) => entry.order).toSorted((left, right) => left - right),
    "replay manifest order must be explicit and sorted",
  );
  assert.match(schemaContractQuery, /pg_catalog\.aclexplode/i);
  assert.match(
    schemaContractQuery,
    /when table_grant\.grantee = 0::oid then 'PUBLIC'::text/i,
  );
  assert.doesNotMatch(schemaContractQuery, /role_table_grants/i);
  assert.deepEqual(
    manifest.entries.slice(-5).map((entry) => basename(entry.path)),
    [
      "review-v3-legacy-prerequisite.sql",
      "20260814_006_review_source_versions_rpc.sql",
      "20260814174227_fix_review_audit_trigger.sql",
      "20260823000000_review_v3_epoch_guard.sql",
      "20260824000000_admin_question_wording_edit_phase_2a.sql",
    ],
  );

  const syncRows = fixtures["production-review-sync-contracts.csv"];
  for (const row of syncRows) {
    if (row.function_name === "get_review_source_versions") continue;
    assert.equal(
      extractFunctionDefinition(prerequisite, row.function_name).trimEnd(),
      normalizeLineEndings(row.definition).trimEnd(),
      `${row.function_name} prerequisite definition must be authoritative`,
    );
  }

  const schemaRows = fixtures["production-review-schema-contracts.csv"];
  const auditContract = schemaRows.find(
    (row) => row.object_kind === "function" && row.object_name === "log_review_audit",
  );
  const authoritativeAudit = normalizeLineEndings(
    JSON.parse(auditContract.details).definition,
  ).trimEnd();
  const reconstructedFinal = extractFunctionDefinition(
    prerequisite,
    "log_review_audit",
  )
    .replace(/\bnew\s*\.\s*answer_id\b/gi, "(pg_catalog.to_jsonb(NEW) ->> 'answer_id')")
    .replace(/\bold\s*\.\s*answer_id\b/gi, "(pg_catalog.to_jsonb(OLD) ->> 'answer_id')")
    .trimEnd();
  assert.equal(
    reconstructedFinal,
    authoritativeAudit,
    "the guarded predecessor must reconstruct the authoritative patched audit body",
  );

  for (const trigger of [
    "question_reviews_enforce_cap",
    "answer_reviews_enforce_cap",
    "question_reviews_prevent_repeat_lecturer_update",
    "answer_reviews_prevent_repeat_lecturer_update",
  ]) {
    assert.match(prerequisite, new RegExp(`drop trigger if exists ${trigger}`, "i"));
    assert.doesNotMatch(
      prerequisite,
      new RegExp(`create trigger ${trigger}`, "i"),
    );
  }
  for (const trigger of [
    "question_reviews_set_updated_at",
    "answer_reviews_set_updated_at",
    "question_misconception_overrides_set_updated_at",
    "answer_misconception_overrides_set_updated_at",
  ]) {
    assert.match(prerequisite, new RegExp(`disable trigger ${trigger}`, "i"));
    assert.match(prerequisite, new RegExp(`enable trigger ${trigger}`, "i"));
  }
  assert.ok(
    prerequisite.indexOf("update public.question_reviews review") <
      prerequisite.indexOf("create trigger question_reviews_audit"),
    "audit triggers must be attached only after historical backfill",
  );
  console.log("Review-v3 prerequisite/manifest static contract check passed.");
}

async function runSelfTest(fixtures, exceptions) {
  for (const file of contractFiles) {
    assert.deepEqual(
      compareContracts(file, fixtures[file], cloneRows(fixtures[file]), exceptions),
      [],
      `${file} must compare equal to itself`,
    );
  }

  assert.equal(exceptions.length, 1, "exactly one documented exception is allowed");

  const schemaFile = "production-review-schema-contracts.csv";
  const schema = fixtures[schemaFile];
  const syncFile = "production-review-sync-contracts.csv";
  const sync = fixtures[syncFile];
  const runtimeFile = "production-review-runtime-functions.csv";
  const runtime = fixtures[runtimeFile];

  const lineEndingVariant = cloneRows(runtime);
  for (const row of lineEndingVariant) {
    row.definition = normalizeLineEndings(row.definition).replaceAll("\n", "\r\n");
  }
  assert.deepEqual(
    compareContracts(
      runtimeFile,
      runtime,
      lineEndingVariant,
      exceptions,
    ),
    [],
    "CRLF and LF must compare equally",
  );

  const jsonKeyOrderVariant = cloneRows(schema);
  const jsonKeyOrderRow = jsonKeyOrderVariant.find(
    (row) => row.object_kind === "column",
  );
  jsonKeyOrderRow.details = JSON.stringify(
    Object.fromEntries(Object.entries(JSON.parse(jsonKeyOrderRow.details)).reverse()),
  );
  assert.deepEqual(
    compareContracts(schemaFile, schema, jsonKeyOrderVariant, exceptions),
    [],
    "JSON object key order must not affect comparison",
  );

  const orderedExpected = cloneRows(sync);
  const orderedActual = cloneRows(sync);
  const orderedExpectedRow = orderedExpected.find(
    (row) => row.function_name === "save_answer_review_v3",
  );
  const orderedActualRow = orderedActual.find(
    (row) => row.function_name === "save_answer_review_v3",
  );
  orderedExpectedRow.function_config = JSON.stringify([
    'search_path=""',
    "statement_timeout=0",
  ]);
  orderedActualRow.function_config = JSON.stringify([
    "statement_timeout=0",
    'search_path=""',
  ]);
  orderedActualRow.acl =
    "{service_role=X/postgres,authenticated=X/postgres,postgres=X/postgres}";
  assert.deepEqual(
    compareContracts(syncFile, orderedExpected, orderedActual, exceptions),
    [],
    "ACL and config array order must not affect comparison",
  );

  const blankLineVariant = cloneRows(runtime);
  blankLineVariant[0].definition = normalizeLineEndings(
    blankLineVariant[0].definition,
  ).replace("\n", "\n\n");
  assert.notEqual(
    compareContracts(runtimeFile, runtime, blankLineVariant, exceptions).length,
    0,
    "blank-line SQL differences must fail",
  );

  const trailingWhitespaceVariant = cloneRows(runtime);
  trailingWhitespaceVariant[0].definition = normalizeLineEndings(
    trailingWhitespaceVariant[0].definition,
  ).replace("\n", " \n");
  assert.notEqual(
    compareContracts(runtimeFile, runtime, trailingWhitespaceVariant, exceptions)
      .length,
    0,
    "trailing SQL whitespace differences must fail",
  );

  const booleanVariant = cloneRows(runtime);
  booleanVariant[0].security_definer = "t";
  assert.notEqual(
    compareContracts(runtimeFile, runtime, booleanVariant, exceptions).length,
    0,
    "boolean representation differences must fail",
  );

  const subNameVariant = cloneRows(schema);
  subNameVariant.find((row) => row.object_kind === "table").sub_name = "";
  assert.notEqual(
    compareContracts(schemaFile, schema, subNameVariant, exceptions).length,
    0,
    "null and empty sub_name representations must differ",
  );

  console.log(
    "Review-v3 normalization self-test passed: CRLF/JSON/ACL/config ordering accepted; blank lines/trailing whitespace/boolean/sub_name drift rejected.",
  );

  const runtimeWithException = cloneRows(fixtures[runtimeFile]);
  const legacySync = runtimeWithException.find(
    (row) => row.function_name === "sync_master_relation_baselines",
  );
  legacySync.acl = "{postgres=X/postgres}";
  legacySync.authenticated_execute = "false";
  assert.deepEqual(
    compareContracts(
      runtimeFile,
      fixtures[runtimeFile],
      runtimeWithException,
      exceptions,
    ),
    [],
    "the one exact documented exception must pass",
  );

  const cases = [
    ["extra legacy Review trigger", () => {
      const rows = cloneRows(schema);
      const source = rows.find((row) => row.object_kind === "trigger");
      rows.push({ ...source, object_name: "question_reviews", sub_name: "question_reviews_enforce_cap" });
      return [schemaFile, rows];
    }],
    ["missing audit trigger", () => [schemaFile, schema.filter((row) => row.sub_name !== "question_reviews_audit")]],
    ["wrong Review source_version nullability", () => {
      const rows = cloneRows(schema);
      const index = rows.findIndex((row) => row.object_kind === "column" && row.object_name === "question_reviews" && row.sub_name === "source_version");
      rows[index] = mutateDetails(rows[index], { not_null: false });
      return [schemaFile, rows];
    }],
    ["missing lifecycle column", () => [schemaFile, schema.filter((row) => !(row.object_kind === "column" && row.object_name === "answer_reviews" && row.sub_name === "inactive_reason"))]],
    ["missing inactive-state constraint", () => [schemaFile, schema.filter((row) => row.sub_name !== "answer_reviews_inactive_state_check")]],
    ["old two-column uniqueness", () => {
      const rows = cloneRows(schema);
      rows.push({ object_kind: "constraint", object_name: "question_reviews", sub_name: "question_reviews_reviewer_id_question_id_key", details: JSON.stringify({ constraint_type: "u", definition: "UNIQUE (reviewer_id, question_id)", deferrable: false, deferred: false, validated: true }) });
      return [schemaFile, rows];
    }],
    ["missing version-aware uniqueness", () => [schemaFile, schema.filter((row) => row.sub_name !== "question_reviews_reviewer_question_version_key")]],
    ["missing active-version index", () => [schemaFile, schema.filter((row) => row.sub_name !== "answer_reviews_active_target_version_idx")]],
    ["wrong override version nullability", () => {
      const rows = cloneRows(schema);
      const index = rows.findIndex((row) => row.object_kind === "column" && row.object_name === "answer_misconception_overrides" && row.sub_name === "source_version");
      rows[index] = mutateDetails(rows[index], { not_null: false });
      return [schemaFile, rows];
    }],
    ["wrong nullable actor columns", () => {
      const rows = cloneRows(schema);
      const index = rows.findIndex((row) => row.object_kind === "column" && row.object_name === "question_misconception_baselines" && row.sub_name === "synced_by");
      rows[index] = mutateDetails(rows[index], { not_null: true });
      return [schemaFile, rows];
    }],
    ["wrong published_by nullability", () => {
      const rows = cloneRows(schema);
      const index = rows.findIndex((row) => row.object_kind === "column" && row.object_name === "question_misconception_overrides" && row.sub_name === "published_by");
      rows[index] = mutateDetails(rows[index], { not_null: true });
      return [schemaFile, rows];
    }],
    ["missing audit table", () => [schemaFile, schema.filter((row) => !(row.object_kind === "table" && row.object_name === "review_audit_log"))]],
    ["missing audit index", () => [schemaFile, schema.filter((row) => row.sub_name !== "review_audit_log_target_idx")]],
    ["missing audit policy", () => [schemaFile, schema.filter((row) => row.sub_name !== "Lecturers can read their own review audit")]],
    ["unexpected PUBLIC table grant", () => {
      const rows = cloneRows(schema);
      rows.push({
        object_kind: "table_grant",
        object_name: "question_reviews",
        sub_name: "PUBLIC",
        details: JSON.stringify({
          is_grantable: "NO",
          privilege_type: "SELECT",
        }),
      });
      return [schemaFile, rows];
    }],
    ["wrong Review-v3 RPC body", () => {
      const rows = cloneRows(sync);
      rows.find((row) => row.function_name === "save_question_review_v3").definition += "\n-- changed";
      return [syncFile, rows];
    }],
    ["wrong Review-v3 RPC ACL", () => {
      const rows = cloneRows(sync);
      rows.find((row) => row.function_name === "save_answer_review_v3").service_role_execute = "false";
      return [syncFile, rows];
    }],
    ["wrong sync-v2 body", () => {
      const rows = cloneRows(sync);
      rows.find((row) => row.function_name === "sync_master_relation_baselines_v2").definition += "\n-- changed";
      return [syncFile, rows];
    }],
    ["wrong sync-v2 ACL", () => {
      const rows = cloneRows(sync);
      rows.find((row) => row.function_name === "sync_master_relation_baselines_v2").authenticated_execute = "true";
      return [syncFile, rows];
    }],
    ["wrong current_user_is_admin body", () => {
      const rows = cloneRows(sync);
      rows.find((row) => row.function_name === "current_user_is_admin").definition += "\n-- changed";
      return [syncFile, rows];
    }],
    ["wrong current_user_is_admin ACL", () => {
      const rows = cloneRows(sync);
      rows.find((row) => row.function_name === "current_user_is_admin").anon_execute = "false";
      return [syncFile, rows];
    }],
    ["unexpected mutation grant", () => {
      const rows = cloneRows(runtime);
      rows.find((row) => row.function_name === "publish_question_misconception_override").authenticated_execute = "true";
      return [runtimeFile, rows];
    }],
  ];

  for (const [label, build] of cases) {
    const [file, actual] = build();
    assert.notEqual(
      compareContracts(file, fixtures[file], actual, exceptions).length,
      0,
      `contract comparison must catch: ${label}`,
    );
  }
  await runFoundationSelfTest(fixtures);
  console.log(`Review-v3 contract comparator self-test passed (${cases.length} required mutations caught).`);
}

const options = parseArguments(process.argv.slice(2));
if (!options.selfTest && !options.actualDirectory) {
  throw new Error("Use --self-test or --actual-dir <directory>.");
}

const fixtures = Object.fromEntries(
  await Promise.all(
    contractFiles.map(async (file) => [
      file,
      await readCsv(join(fixtureDirectory, file)),
    ]),
  ),
);
const documented = JSON.parse(
  await readFile(join(fixtureDirectory, "documented-exceptions.json"), "utf8"),
);

if (options.selfTest) await runSelfTest(fixtures, documented.exceptions);

if (options.actualDirectory) {
  const errors = [];
  for (const file of contractFiles) {
    const actual = await readCsv(join(options.actualDirectory, basename(file)));
    errors.push(
      ...compareContracts(file, fixtures[file], actual, documented.exceptions).map(
        (message) => `${file}: ${message}`,
      ),
    );
  }
  if (errors.length > 0) {
    throw new Error(`Review-v3 contract mismatch:\n${errors.join("\n")}`);
  }
  console.log("Review-v3 fresh replay matches production contracts with only documented exceptions.");
}
