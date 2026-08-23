import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";

const baselineTables = [
  "question_misconception_baselines",
  "answer_misconception_baselines",
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".ts", ".tsx"].includes(extname(entry.name)) ? [path] : [];
  });
}

for (const path of sourceFiles("src")) {
  const source = readFileSync(path, "utf8");
  for (const table of baselineTables) {
    assert.doesNotMatch(
      source,
      new RegExp(`\\.from\\s*\\(\\s*["'\\\`]${table}["'\\\`]\\s*\\)`, "i"),
      `${path} must read ${table} through an RPC`,
    );
  }
}

const repository = readFileSync(
  "src/services/reviewPersistenceRepository.ts",
  "utf8",
);
assert.match(
  repository,
  /supabase\.rpc\(\s*["']get_review_source_versions["']\s*\)/,
  "Review source versions must be loaded through get_review_source_versions",
);

const migration = readFileSync(
  "database/migration-archive/legacy-20260720-through-20260814174227/20260814_006_review_source_versions_rpc.sql",
  "utf8",
);
const functionStart = migration.indexOf(
  "create or replace function public.get_review_source_versions()",
);
const functionEnd = migration.indexOf("\n$$;", functionStart);
assert.notEqual(functionStart, -1, "get_review_source_versions is missing");
assert.notEqual(functionEnd, -1, "get_review_source_versions is incomplete");
const rpcFunction = migration.slice(functionStart, functionEnd + 4);

assert.match(
  rpcFunction,
  /returns table\s*\(\s*target_type text,\s*target_id text,\s*parent_question_id text,\s*source_version text\s*\)/i,
);
assert.match(rpcFunction, /language sql\s+stable\s+security definer/i);
assert.match(rpcFunction, /set search_path = ''/i);
assert.match(rpcFunction, /from public\.lecturer_profiles as profile/i);
assert.match(
  rpcFunction,
  /profile\.user_id = \(select auth\.uid\(\)\)\s+and profile\.active = true/i,
);
for (const table of baselineTables) {
  assert.match(rpcFunction, new RegExp(`from public\\.${table}\\b`, "i"));
}
assert.doesNotMatch(
  rpcFunction,
  /\b(?:misconception_ids|synced_by|synced_at)\b/i,
  "The source-version RPC must not expose baseline contents or sync metadata",
);

assert.match(
  migration,
  /revoke all on function public\.get_review_source_versions\(\) from public;/i,
);
assert.match(
  migration,
  /revoke all on function public\.get_review_source_versions\(\) from anon, service_role;/i,
);
assert.match(
  migration,
  /grant execute on function public\.get_review_source_versions\(\) to authenticated;/i,
);
assert.doesNotMatch(
  migration,
  /grant execute on function public\.get_review_source_versions\(\) to [^;]*\banon\b/i,
);

const migrationSources = readdirSync("supabase/migrations")
  .filter((name) => name.endsWith(".sql"))
  .map((name) => readFileSync(join("supabase/migrations", name), "utf8"))
  .join("\n");
const grantStatements = migrationSources
  .split(";")
  .map((statement) => statement.trim().toLowerCase())
  .filter((statement) => /\bgrant\s/.test(statement));

for (const table of baselineTables) {
  assert.equal(
    grantStatements.some(
      (statement) =>
        statement.includes(table) &&
        statement.includes("authenticated") &&
        /\b(?:select|all(?:\s+privileges)?)\b/.test(statement),
    ),
    false,
    `${table} must not grant direct SELECT access to authenticated`,
  );
}
assert.equal(
  grantStatements.some(
    (statement) =>
      statement.includes("authenticated") &&
      /\b(?:select|all(?:\s+privileges)?)\b/.test(statement) &&
      /\ball tables in schema public\b/.test(statement),
  ),
  false,
  "authenticated must not receive SELECT access to every public table",
);

const baselineMigration = readFileSync(
  "database/migration-archive/legacy-20260720-through-20260814174227/20260728_003_effective_content_overrides.sql",
  "utf8",
);
for (const table of baselineTables) {
  assert.match(
    baselineMigration,
    new RegExp(
      `revoke all on table public\\.${table} from public, anon, authenticated, service_role;`,
      "i",
    ),
  );
}

console.log("Review source access checks passed.");
