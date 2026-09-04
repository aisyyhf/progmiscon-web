// Offline structural check for database/staging/staging-bootstrap.sql.
//
// Proves — without a database — that the staging bootstrap declares the objects,
// columns, constraints, indexes, triggers, policies, function signatures and
// grants required by the current Review-v3 contract, that Review-v3 invariants
// are structurally present, that the legacy forbidden objects are absent, and
// that no production secret / identity / backup artifact leaked into the file.
//
// It does NOT execute SQL. A disposable-database apply + the epoch guard
// (supabase/migrations/20260823000000_review_v3_epoch_guard.sql) + the contract
// diff (npm run check:review-v3-replay) remain the authoritative runtime proof.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bootstrapPath = join(root, "database", "staging", "staging-bootstrap.sql");
const fixturesDir = join(root, "checks", "fixtures", "review-v3");
const prerequisitePath = join(root, "database", "replay", "review-v3-legacy-prerequisite.sql");
const archiveTriggerPath = join(
  root,
  "database",
  "migration-archive",
  "legacy-20260720-through-20260814174227",
  "20260722_001_telkom_lecturer_domain_access.sql",
);
const guardPath = join(root, "supabase", "migrations", "20260823000000_review_v3_epoch_guard.sql");

const read = (p) => readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const sql = read(bootstrapPath);

// identifier-unquoted view (keeps multi-word quoted names like policy titles)
const sqlU = sql.replace(/"([A-Za-z_][A-Za-z0-9_$]*)"/g, "$1");
// collapsed + lowercased view for whitespace-insensitive "contains" checks
const sqlC = sqlU.replace(/\s+/g, " ").toLowerCase();

const problems = [];
const ok = (condition, message) => {
  if (!condition) problems.push(message);
};
const has = (fragment) => sqlC.includes(fragment.replace(/\s+/g, " ").toLowerCase());

// canonicalise a SQL expression for loose comparison (drop parens/quotes/space/casts/public.)
const canon = (s) =>
  s.toLowerCase().replace(/::text/g, "").replace(/public\./g, "").replace(/[\s"()]/g, "");

function parseCsv(text) {
  const rows = [];
  let field = "";
  let record = [];
  let q = false;
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; } else { q = false; }
      } else field += c;
    } else if (c === '"') q = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\n") { record.push(field); field = ""; rows.push(record); record = []; }
    else field += c;
  }
  if (field !== "" || record.length) { record.push(field); rows.push(record); }
  const header = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.length > 1 || (r[0] ?? "") !== "")
    .map((r) => Object.fromEntries(header.map((h, idx) => [h, r[idx] ?? ""])));
}

const schemaRows = parseCsv(read(join(fixturesDir, "production-review-schema-contracts.csv")));

function tableBlock(table) {
  const m = sqlU.match(
    new RegExp(`create table if not exists\\s+(?:public\\.)?${table}\\s*\\(([\\s\\S]*?)\\n\\);`, "i"),
  );
  return m ? m[1] : null;
}

// ===========================================================================
// 1. Structural shell
// ===========================================================================
ok(/^\s*(--[^\n]*\n|\s)*begin;/i.test(sql), "must open with begin;");
ok(/\ncommit;\s*(--[^\n]*\n?|\s)*$/i.test(sql), "must close with commit;");
ok(
  sql.includes("supabase/migrations/20260823000000_review_v3_epoch_guard.sql"),
  "must point operators at the epoch guard for final validation",
);
ok(
  !sql.includes("$review_v3_epoch_guard$") &&
    !/raise exception[\s\S]{0,80}MIGRATION_EPOCH_GUARD_FAILED/i.test(sql),
  "must NOT embed a second copy of the epoch guard assertion logic",
);

// ===========================================================================
// 2. Tables + columns + constraints + indexes (from the contract fixture)
// ===========================================================================
const contractTables = new Set(
  schemaRows.filter((r) => r.object_kind === "table").map((r) => r.object_name),
);
assert.equal(contractTables.size, 8, "fixture must describe 8 contract tables");
const allTables = [
  "lecturer_allowlist",
  "lecturer_profiles",
  "question_content_overrides",
  "answer_content_overrides",
  ...contractTables,
];

for (const t of allTables) {
  ok(tableBlock(t) !== null, `missing CREATE TABLE ${t}`);
  ok(has(`alter table public.${t} enable row level security`), `missing RLS enable on ${t}`);
}

for (const row of schemaRows.filter((r) => r.object_kind === "column")) {
  const meta = JSON.parse(row.details);
  const block = tableBlock(row.object_name) ?? "";
  const line = block
    .split("\n")
    .map((l) => l.trim().replace(/,$/, ""))
    .find((l) => new RegExp(`^${row.sub_name}\\s`, "i").test(l));
  if (!line) { problems.push(`${row.object_name}.${row.sub_name}: column not found`); continue; }
  const ln = line.toLowerCase();
  const want = meta.type.toLowerCase();
  ok(
    ln.includes(want) || ln.includes(want.replace("timestamp with time zone", "timestamp")),
    `${row.object_name}.${row.sub_name}: expected type ${meta.type} — got "${line}"`,
  );
  if (meta.not_null) ok(/not null/i.test(line), `${row.object_name}.${row.sub_name}: expected NOT NULL`);
}

for (const row of schemaRows.filter((r) => r.object_kind === "constraint")) {
  const def = JSON.parse(row.details).definition;
  ok(sqlU.includes(row.sub_name), `missing constraint ${row.sub_name}`);
  ok(canon(sqlU).includes(canon(def)), `constraint ${row.sub_name}: definition mismatch (${def})`);
}

for (const row of schemaRows.filter((r) => r.object_kind === "index")) {
  if (/_(pkey|key)$/.test(row.sub_name)) continue; // backed by ADD CONSTRAINT
  ok(
    new RegExp(`create (unique )?index (if not exists )?${row.sub_name}\\b`, "i").test(sqlU),
    `missing index ${row.sub_name}`,
  );
}
for (const partial of [
  "question_reviews_active_target_version_idx",
  "answer_reviews_active_target_version_idx",
]) {
  const idx = sqlC.match(new RegExp(`create index ${partial}[^;]*;`, "i"))?.[0] ?? "";
  ok(/where \(is_active = true\)/i.test(idx), `${partial} must be partial WHERE is_active = true`);
}
ok(
  has("add constraint answer_reviews_reviewer_answer_version_key unique (reviewer_id, answer_id, source_version)"),
  "answer_reviews uniqueness must be (reviewer_id, answer_id, source_version)",
);
ok(
  has("add constraint question_reviews_reviewer_question_version_key unique (reviewer_id, question_id, source_version)"),
  "question_reviews uniqueness must be (reviewer_id, question_id, source_version)",
);

// ===========================================================================
// 3. Triggers — required present, forbidden absent, exactly six on contract tables
// ===========================================================================
const requiredTriggers = [
  ["question_reviews_set_updated_at", "before update on public.question_reviews", "set_updated_at"],
  ["answer_reviews_set_updated_at", "before update on public.answer_reviews", "set_updated_at"],
  ["question_misconception_overrides_set_updated_at", "before update on public.question_misconception_overrides", "set_updated_at"],
  ["answer_misconception_overrides_set_updated_at", "before update on public.answer_misconception_overrides", "set_updated_at"],
  ["question_reviews_audit", "after insert or delete or update on public.question_reviews", "log_review_audit"],
  ["answer_reviews_audit", "after insert or delete or update on public.answer_reviews", "log_review_audit"],
];
for (const [name, when, fn] of requiredTriggers) {
  const block = sqlC.match(new RegExp(`create (or replace )?trigger ${name} [^;]*;`, "i"))?.[0] ?? "";
  ok(block !== "", `missing trigger ${name}`);
  ok(block.includes(when), `trigger ${name}: wrong timing/table`);
  ok(new RegExp(`execute (function|procedure) public\\.${fn}\\(`).test(block), `trigger ${name}: wrong function`);
}
for (const forbidden of [
  "question_reviews_enforce_cap",
  "answer_reviews_enforce_cap",
  "question_reviews_prevent_repeat_lecturer_update",
  "answer_reviews_prevent_repeat_lecturer_update",
]) {
  ok(
    !new RegExp(`create (or replace )?trigger ${forbidden}\\b`, "i").test(sqlC),
    `forbidden legacy trigger present: ${forbidden}`,
  );
}
const contractTriggerCount = [
  ...sqlC.matchAll(/create (?:or replace )?trigger ([a-z_]+) [^;]*? on public\.([a-z_]+)/gi),
].filter(([, , tbl]) => contractTables.has(tbl)).length;
ok(contractTriggerCount === 6, `expected 6 triggers on contract tables, found ${contractTriggerCount}`);

// ===========================================================================
// 4. RLS policies
// ===========================================================================
const policies = [
  ["Lecturers can read their own profile", "lecturer_profiles", "for select"],
  ["Lecturers can read their own question reviews", "question_reviews", "for select"],
  ["Lecturers can create their own question reviews", "question_reviews", "for insert"],
  ["Lecturers can update their own question reviews", "question_reviews", "for update"],
  ["Admins can read all question reviews", "question_reviews", "for select"],
  ["Lecturers can read their own answer reviews", "answer_reviews", "for select"],
  ["Lecturers can create their own answer reviews", "answer_reviews", "for insert"],
  ["Lecturers can update their own answer reviews", "answer_reviews", "for update"],
  ["Lecturers can read their own review audit", "review_audit_log", "for select"],
];
for (const [name, table, cmd] of policies) {
  const block =
    sqlC.match(new RegExp(`create policy "${name.toLowerCase()}"[^;]*;`, "i"))?.[0] ?? "";
  ok(block !== "", `missing policy "${name}"`);
  ok(block.includes(`on public.${table} `), `policy "${name}": wrong table`);
  ok(block.includes(cmd), `policy "${name}": wrong command`);
  ok(block.includes("to authenticated"), `policy "${name}": must target authenticated`);
}
const totalPolicies = (sqlC.match(/create policy /g) ?? []).length;
ok(totalPolicies === 10, `expected 10 policies total (9 on contract tables + profile), found ${totalPolicies}`);
const contractPolicies = [
  ...sqlC.matchAll(/create policy "[^"]*" on public\.([a-z_]+)/g),
].filter(([, tbl]) => contractTables.has(tbl)).length;
ok(contractPolicies === 9, `expected 9 policies on contract tables, found ${contractPolicies}`);
for (const t of [
  "question_misconception_baselines", "answer_misconception_baselines",
  "master_misconception_catalog", "question_misconception_overrides",
  "answer_misconception_overrides", "question_content_overrides", "answer_content_overrides",
]) {
  ok(!new RegExp(`create policy "[^"]*" on public\\.${t}\\b`).test(sqlC), `${t} must have no RLS policy`);
}

// ===========================================================================
// 5. Functions — signatures, attributes, grants
// ===========================================================================
const guarded = [
  ["current_user_is_admin", "()", ["anon", "authenticated", "service_role"], true, "stable"],
  ["delete_answer_review_v3", "(text, uuid)", ["authenticated", "service_role"], true, null],
  ["delete_question_review_v3", "(text, uuid)", ["authenticated", "service_role"], true, null],
  ["delete_question_review_workflow_v3", "(text, uuid)", ["authenticated", "service_role"], true, null],
  ["get_review_source_versions", "()", ["authenticated"], true, "stable"],
  ["recompute_answer_review_consensus_v3", "(text, uuid)", ["service_role"], true, null],
  ["recompute_question_review_consensus_v3", "(text, uuid)", ["service_role"], true, null],
  ["save_answer_review_v3", "(text, uuid, boolean, text[], text, boolean, text[], text, text)", ["authenticated", "service_role"], true, null],
  ["save_question_review_v3", "(text, uuid, boolean, text[], text, boolean, text[], text, text)", ["authenticated", "service_role"], true, null],
  ["sync_master_relation_baselines_v2", "(jsonb, jsonb, text[])", ["service_role"], true, null],
  ["sync_master_relation_baselines", "(jsonb, jsonb, text[])", ["authenticated"], true, null],
];
const nonGuarded = [
  "get_admin_review_consensus", "get_admin_review_lifecycle",
  "get_admin_reviewer_profiles", "get_answer_review_counts",
  "get_my_review_status", "get_published_master_overrides", "get_question_review_counts",
  "prevent_repeat_lecturer_review_update", "publish_answer_misconception_override",
  "publish_question_misconception_override", "save_answer_content_override",
  "save_question_content_override", "reset_answer_content_override", "reset_question_content_override",
  "reset_answer_misconception_override", "reset_question_misconception_override",
  "reset_question_reviews_v3",
  "normalize_text_id_array", "set_updated_at", "normalize_lecturer_email",
  "is_telkom_lecturer_email", "log_review_audit", "handle_new_lecturer_user",
  "enforce_verified_telkom_lecturer_profile", "enforce_question_review_cap",
  "enforce_answer_review_cap",
];
for (const fn of [...guarded.map((g) => g[0]), ...nonGuarded]) {
  const count = (sqlU.match(new RegExp(`create or replace function (public\\.)?${fn}\\(`, "gi")) ?? []).length;
  ok(count === 1, `function ${fn}: expected exactly 1 definition, found ${count}`);
}

const sig = (s) => s.replace(/\s+/g, " ").toLowerCase();
for (const [fn, argSig, roles, secdef, vol] of guarded) {
  const def =
    sqlU.match(new RegExp(`create or replace function (public\\.)?${fn}\\([\\s\\S]*?\\bAS \\$`, "i"))?.[0] ?? "";
  ok(/set search_path to ''/i.test(def), `${fn}: must SET search_path TO ''`);
  if (secdef) ok(/security definer/i.test(def), `${fn}: expected SECURITY DEFINER`);
  if (vol) ok(new RegExp(`\\b${vol}\\b`, "i").test(def), `${fn}: expected ${vol.toUpperCase()}`);

  ok(
    has(`revoke all on function public.${fn}${sig(argSig)} from public, anon, authenticated, service_role;`),
    `${fn}: missing explicit REVOKE ALL FROM public, anon, authenticated, service_role`,
  );
  ok(
    has(`grant execute on function public.${fn}${sig(argSig)} to ${roles.join(", ")};`),
    `${fn}: missing GRANT EXECUTE TO ${roles.join(", ")}`,
  );
  ok(
    !new RegExp(`grant execute on function public\\.${fn}\\([^)]*\\) to [^;]*\\bpublic\\b`).test(sqlC),
    `${fn}: must not GRANT EXECUTE to PUBLIC`,
  );
}
for (const fn of ["publish_question_misconception_override", "publish_answer_misconception_override"]) {
  ok(
    has(`revoke all on function public.${fn}(text) from public, anon, authenticated, service_role;`),
    `${fn}: expected REVOKE ALL from every API role`,
  );
  ok(
    !new RegExp(`grant execute on function public\\.${fn}\\(text\\) to`).test(sqlC),
    `${fn}: must not be granted to any API role (production has revoked it)`,
  );
}

// reset_question_reviews_v3 — targeted admin Question Review reset. SECURITY
// DEFINER with an internal admin gate; EXECUTE to `authenticated` only (never
// anon / public / service_role), and no direct question_reviews write grant.
{
  // Whole CREATE ... $$; block, identifier-unquoted, comments removed, so the
  // "never references answer_*" assertion inspects executable SQL only.
  const raw =
    sqlU.match(/create or replace function (?:public\.)?reset_question_reviews_v3\([\s\S]*?\n\$\$;/i)?.[0] ?? "";
  const executable = raw
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  ok(raw !== "", "reset_question_reviews_v3: missing definition");
  ok(/security definer/i.test(raw), "reset_question_reviews_v3: expected SECURITY DEFINER");
  ok(/set\s+search_path\s+to\s+''/i.test(raw), "reset_question_reviews_v3: must SET search_path TO ''");
  ok(
    /current_user_is_admin\(\)/i.test(executable),
    "reset_question_reviews_v3: must gate on current_user_is_admin()",
  );
  ok(
    /admin_access_required/i.test(executable),
    "reset_question_reviews_v3: must raise ADMIN_ACCESS_REQUIRED",
  );
  ok(
    has("revoke all on function public.reset_question_reviews_v3(text, uuid) from public, anon, authenticated, service_role;"),
    "reset_question_reviews_v3: missing REVOKE ALL from public, anon, authenticated, service_role",
  );
  ok(
    has("grant execute on function public.reset_question_reviews_v3(text, uuid) to authenticated;"),
    "reset_question_reviews_v3: missing GRANT EXECUTE TO authenticated",
  );
  ok(
    !/grant execute on function public\.reset_question_reviews_v3\([^)]*\) to [^;]*\b(public|anon|service_role)\b/.test(sqlC),
    "reset_question_reviews_v3: must not GRANT EXECUTE to public / anon / service_role",
  );
  ok(
    !/\banswer_reviews\b|\banswer_misconception_overrides\b|recompute_answer_review_consensus_v3/i.test(executable),
    "reset_question_reviews_v3: must never reference answer_reviews / answer_misconception_overrides / recompute_answer_review_consensus_v3",
  );
  ok(
    /recompute_question_review_consensus_v3/i.test(executable),
    "reset_question_reviews_v3: must recompute question consensus",
  );
  ok(
    /inactive_reason\s*=\s*'deleted'/i.test(executable) &&
      /is_active\s*=\s*false/i.test(executable) &&
      /inactive_at\s*=\s*pg_catalog\.now\(\)/i.test(executable),
    "reset_question_reviews_v3: must deactivate with is_active=false, inactive_reason='deleted', inactive_at=now()",
  );
}

// ===========================================================================
// 6. Review-v3 invariants (structural)
// ===========================================================================
for (const t of ["question_reviews", "answer_reviews"]) {
  const b = (tableBlock(t) ?? "").toLowerCase();
  ok(/source_version\s+uuid\b[\s\S]*not null/.test(b), `${t}.source_version must be uuid NOT NULL`);
  ok(/is_active\s+boolean\b[\s\S]*not null/.test(b), `${t}.is_active must be boolean NOT NULL`);
  ok(/inactive_reason\s+text/.test(b), `${t}.inactive_reason must exist`);
  ok(/inactive_at\s+timestamp/.test(b), `${t}.inactive_at must exist`);
  ok(sqlU.includes(`${t}_inactive_state_check`), `${t}: lifecycle CHECK constraint missing`);
}
for (const t of ["question_misconception_overrides", "answer_misconception_overrides"]) {
  const b = (tableBlock(t) ?? "").toLowerCase();
  ok(/source_version\s+uuid\b[\s\S]*not null/.test(b), `${t}.source_version must be uuid NOT NULL`);
}
ok(sqlC.includes("service_role_required"), "sync_master_relation_baselines_v2 must gate on service_role");
ok((sql.match(/REVIEW_CAP_INVARIANT_BROKEN/g) ?? []).length >= 2, "both recompute_*_v3 must assert the cap invariant");
ok((sql.match(/REVIEWER_CAP_REACHED/g) ?? []).length >= 4, "save_*_v3 must enforce the 3-reviewer cap");

// v3 function bodies must match the contract-validated replay prerequisite verbatim
const prereq = read(prerequisitePath);
const bodyOf = (text, fn) => {
  const m = text.match(new RegExp(`function[^\\n]*\\b${fn}\\b[^]*?\\bAS (\\$[a-z_]*\\$)([^]*?)\\1`, "i"));
  return m ? m[2] : null;
};
for (const fn of [
  "save_question_review_v3", "save_answer_review_v3",
  "delete_question_review_v3", "delete_answer_review_v3",
  "recompute_question_review_consensus_v3", "recompute_answer_review_consensus_v3",
  "sync_master_relation_baselines_v2",
]) {
  const a = bodyOf(sql, fn);
  const b = bodyOf(prereq, fn);
  ok(a && b && a === b, `${fn}: body differs from database/replay/review-v3-legacy-prerequisite.sql`);
}

// ===========================================================================
// 7. auth.users provisioning trigger — reconstructed verbatim from the archive
// ===========================================================================
const archiveTrg = read(archiveTriggerPath).match(
  /drop trigger if exists on_auth_user_created on auth\.users;[\s\S]*?execute procedure public\.handle_new_lecturer_user\(\);/,
)[0];
ok(sql.includes(archiveTrg), "on_auth_user_created trigger must match the archived source verbatim");

// ===========================================================================
// 8. Sanitization — no production identity / secret / backup artifact
// ===========================================================================
const forbiddenPatterns = [
  [/create\s+role\b/i, "CREATE ROLE (roles.sql content)"],
  [/alter\s+publication\b/i, "ALTER PUBLICATION (platform-managed)"],
  [/create extension[^;]*(pg_stat_statements|supabase_vault|uuid-ossp)/i, "platform-managed extension"],
  [/\beyJ[A-Za-z0-9_-]{12,}/, "JWT-looking token"],
  [/-----BEGIN [A-Z ]+-----/, "PEM / private key block"],
  [/service_role_key|SUPABASE_SERVICE_ROLE|SUPABASE_DB_PASSWORD/i, "service-role / db-password reference"],
  [/[A-Za-z]:[\\/]+secure\b/i, "C:\\secure local path"],
  [/project_ref\s*=/i, "project_ref assignment"],
  [/[a-z0-9-]+\.supabase\.(co|in|net)\b/i, "Supabase project URL"],
  [/[A-Za-z0-9._%+-]+@(?!telkomuniversity\[?\.?\]?ac\[?\.?\]?id)[A-Za-z0-9.-]+\.[A-Za-z]{2,}/,
    "literal email address"],
  [/\bowner to (?!postgres\b)[a-z_]+/i, "OWNER TO a non-postgres role", sqlU],
  [/\bclaude\b|\bcopilot\b|generated with|co-authored-by/i, "assistant attribution"],
  [/\b[a-p]{20}\b/, "20-char a-p token (possible project ref)"],
];
for (const [re, label, target] of forbiddenPatterns) {
  const hit = (target ?? sql).match(re);
  ok(!hit, `sanitization: found ${label} -> ${hit ? JSON.stringify(hit[0]) : ""}`);
}

// ===========================================================================
// 9. Epoch guard file is untouched by this phase
// ===========================================================================
ok(
  read(guardPath).includes("Assertion-only: this transaction must not change application schema or data."),
  "epoch guard file must remain the assertion-only guard",
);

// ===========================================================================
if (problems.length) {
  console.error(`staging-bootstrap contract check FAILED (${problems.length}):`);
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}
console.log(
  "staging-bootstrap contract check passed: " +
    `${allTables.length} tables, ${schemaRows.filter((r) => r.object_kind === "column").length} contract columns, ` +
    `${schemaRows.filter((r) => r.object_kind === "constraint").length} constraints, ` +
    `10 policies (9 on contract tables), 6 contract triggers, ` +
    `${guarded.length} guarded + ${nonGuarded.length} non-guarded functions, ` +
    `7 v3 bodies verbatim vs replay prerequisite, sanitization clean.`,
);
