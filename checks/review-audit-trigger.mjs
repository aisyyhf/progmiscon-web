import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const migration = await readFile(
  new URL(
    "../database/migration-archive/legacy-20260720-through-20260814174227/20260814174227_fix_review_audit_trigger.sql",
    import.meta.url,
  ),
  "utf8",
);
const repository = await readFile(
  new URL("../src/services/reviewPersistenceRepository.ts", import.meta.url),
  "utf8",
);

assert.match(
  migration,
  /pg_catalog\.pg_get_functiondef\(audit_function_oid\)/i,
  "the existing audit function must be preserved rather than reconstructed",
);
assert.match(
  migration,
  /function_object\.proname\s*=\s*'log_review_audit'/i,
);

const patchStatements = [
  ...migration.matchAll(
    /patched_definition\s*:=\s*pg_catalog\.regexp_replace\([\s\S]*?\n\s*\);/gi,
  ),
].map((match) => match[0]);
assert.equal(
  patchStatements.length,
  2,
  "only NEW.answer_id and OLD.answer_id may be patched",
);
assert.match(patchStatements[0], /unsafe_new_pattern/i);
assert.match(
  patchStatements[0],
  /pg_catalog\.to_jsonb\(NEW\)\s*->>\s*''answer_id''/i,
);
assert.match(patchStatements[1], /unsafe_old_pattern/i);
assert.match(
  patchStatements[1],
  /pg_catalog\.to_jsonb\(OLD\)\s*->>\s*''answer_id''/i,
);
for (const statement of patchStatements) {
  assert.doesNotMatch(
    statement,
    /question_id/i,
    "question target IDs must not be rewritten",
  );
}

assert.match(
  migration,
  /patched_definition\s*~\*\s*unsafe_new_pattern[\s\S]*?patched_definition\s*~\*\s*unsafe_old_pattern/i,
  "the patched function must reject direct NEW/OLD answer_id access",
);
assert.match(
  migration,
  /installed_function_oid\s*<>\s*audit_function_oid/i,
  "CREATE OR REPLACE must preserve the function used by both triggers",
);

for (const token of [
  "tg_table_name",
  "created",
  "edited",
  "deleted",
  "source_updated",
  "reactivated",
  "hard_deleted",
  "review_id",
  "reviewer_id",
  "target_id",
  "question_id",
  "source_version",
  "before_data",
  "after_data",
]) {
  assert.match(
    migration,
    new RegExp(`['"]${token}['"]`, "i"),
    `audit behavior token ${token} must remain guarded`,
  );
}

for (const [table, trigger] of [
  ["question_reviews", "question_reviews_audit"],
  ["answer_reviews", "answer_reviews_audit"],
]) {
  assert.match(
    migration,
    new RegExp(
      `\\('${table}'::text,\\s*'${trigger}'::text\\)`,
      "i",
    ),
    `${trigger} must remain intended on public.${table}`,
  );
}
assert.match(migration, /trigger_object\.tgfoid\s*=\s*audit_function_oid/i);
assert.match(migration, /trigger_object\.tgenabled\s+in\s*\(\s*'O'\s*,\s*'A'\s*\)/i);
assert.match(migration, /trigger_object\.tgtype::integer\s*&\s*4\)\s*<>\s*0/i);
assert.match(migration, /trigger_object\.tgtype::integer\s*&\s*8\)\s*<>\s*0/i);
assert.match(migration, /trigger_object\.tgtype::integer\s*&\s*16\)\s*<>\s*0/i);
assert.doesNotMatch(migration, /drop\s+trigger/i);
assert.doesNotMatch(migration, /alter\s+table[\s\S]*disable\s+trigger/i);
assert.doesNotMatch(migration, /\b(?:grant|revoke)\b/i);
assert.doesNotMatch(migration, /alter\s+table[\s\S]*row\s+level\s+security/i);

const questionSave = repository.match(
  /export async function saveQuestionReview\([\s\S]*?(?=\nexport async function)/,
)?.[0];
const answerSave = repository.match(
  /export async function saveAnswerReview\([\s\S]*?(?=\nexport async function)/,
)?.[0];
assert.ok(questionSave, "saveQuestionReview was not found");
assert.ok(answerSave, "saveAnswerReview was not found");
assert.match(questionSave, /supabase\.rpc\("save_question_review_v3"/);
assert.match(questionSave, /p_question_id:\s*questionId/);
assert.doesNotMatch(questionSave, /save_answer_review_v3|p_answer_id|\.from\(/);
assert.match(answerSave, /supabase\.rpc\("save_answer_review_v3"/);
assert.match(answerSave, /p_answer_id:\s*answerId/);
assert.doesNotMatch(answerSave, /save_question_review_v3|\.from\(/);

async function sourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? sourceFiles(path) : [path];
    }),
  );
  return files.flat();
}

for (const path of await sourceFiles("src")) {
  if (![".js", ".jsx", ".ts", ".tsx"].includes(extname(path))) continue;
  const source = await readFile(path, "utf8");
  assert.doesNotMatch(
    source,
    /\.from\(["'](?:question_reviews|answer_reviews)["']\)[\s\S]{0,400}?\.(?:insert|update|upsert|delete)\(/,
    `review writes must remain behind RPCs: ${path}`,
  );
}

console.log("Review audit trigger regression check passed.");
