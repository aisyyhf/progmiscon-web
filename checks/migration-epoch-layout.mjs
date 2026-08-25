import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const archiveRoot = join(
  repositoryRoot,
  "database",
  "migration-archive",
  "legacy-20260720-through-20260814174227",
);
const inventoryPath = join(archiveRoot, "inventory.json");
const manifestPath = join(
  repositoryRoot,
  "database",
  "replay",
  "review-v3-manifest.json",
);
const replayReadmePath = join(repositoryRoot, "database", "replay", "README.md");
const activeRoot = join(repositoryRoot, "supabase", "migrations");
const archiveBoundaryVersion = "20260814174227";

const expectedArchive = [
  ["20260720_001_lecturer_auth_and_reviews.sql", 11673, "ea9a383c7b61f6983411b789a8216ff6d514d33707dfead46cdd280dffab2969"],
  ["20260721_001_admin_access.sql", 1104, "489be43d8227db7c161ffe7ea8a905924e4f8a1b4e9046c875f8e8aac116c031"],
  ["20260721_002_admin_review_read_access.sql", 1718, "a76612dbb8a07ddee600ef6e4f01e951cd1caa3f6b4e8c766dc0e940f3361078"],
  ["20260722_001_telkom_lecturer_domain_access.sql", 4693, "65d9c412f6f7d532e7f7840f7a62e7662ba6eb1997f493df85e4a2e6424fe13d"],
  ["20260727_001_review_status_rpc.sql", 1628, "17b5c870f491716d1475b90e92909559fe8bcfc57c431763cbc1c6766b1eee74"],
  ["20260728_001_question_review_counts_rpc.sql", 1045, "6cb1e7a5040976257a624e709ab5c7357d6c8f00613e8f67538cf65038123ca4"],
  ["20260728_002_prevent_repeat_lecturer_reviews.sql", 1036, "b097d6bcb4312f1c4b34afcf0ae0e0bf790287cc51431ca5f38da61e5d7d3bf3"],
  ["20260728_003_effective_content_overrides.sql", 43100, "1893a4f44aa9f671d6005295dee1e7d665f163439efce282856f87a6e0c27d9c"],
  ["20260728_004_fix_baseline_sync_safe_delete.sql", 7339, "cb7655304bf62b9a60a73c8ebee88403977128ef270003a94643d7269af2a8f3"],
  ["20260729_005_fix_override_upsert_conflicts.sql", 15239, "ecd9893b6468c4283125026c4e83b20e832af32b5d0b2d452b07e8bef59cc31d"],
  ["20260814_006_review_source_versions_rpc.sql", 1395, "7b6376b4acbcd3d3a3afaae19211802942d3ee25121484b25c9e8b0b67da3e8c"],
  ["20260814174227_fix_review_audit_trigger.sql", 5410, "21b6ba98342b82eceab401263a324d157c0e007451ffaf1fccc6b6d3049ca86e"],
].map(([name, bytes, sha256]) => ({ name, bytes, sha256 }));

function assertInside(parent, candidate) {
  const pathFromParent = relative(resolve(parent), resolve(candidate));
  assert.ok(
    pathFromParent !== "" &&
      pathFromParent !== ".." &&
      !pathFromParent.startsWith(`..${sep}`),
    `path escapes expected root: ${candidate}`,
  );
}

async function listTreeWithoutLinks(root) {
  const rootStatus = await lstat(root);
  assert.ok(!rootStatus.isSymbolicLink(), `symlink/junction root is forbidden: ${root}`);
  assert.ok(rootStatus.isDirectory(), `expected directory: ${root}`);
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      assertInside(root, path);
      assert.ok(!entry.isSymbolicLink(), `symlink/junction is forbidden: ${path}`);
      if (entry.isDirectory()) await visit(path);
      else if (entry.isFile()) files.push(path);
      else assert.fail(`unsupported filesystem entry: ${path}`);
    }
  }
  await visit(root);
  return files;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function stripCommentsAndStrings(sql) {
  let output = "";
  let index = 0;
  while (index < sql.length) {
    if (sql.startsWith("--", index)) {
      const end = sql.indexOf("\n", index + 2);
      output += " ";
      index = end === -1 ? sql.length : end;
    } else if (sql.startsWith("/*", index)) {
      const end = sql.indexOf("*/", index + 2);
      assert.notEqual(end, -1, "unterminated SQL block comment");
      output += " ";
      index = end + 2;
    } else if (sql[index] === "'") {
      index += 1;
      while (index < sql.length) {
        if (sql[index] !== "'") {
          index += 1;
        } else if (sql[index + 1] === "'") {
          index += 2;
        } else {
          index += 1;
          break;
        }
      }
      output += " ";
    } else {
      output += sql[index];
      index += 1;
    }
  }
  return output;
}

function tokenizeExecutableSql(sql) {
  const executableSql = stripCommentsAndStrings(sql);
  const tokens = [];
  let index = 0;
  while (index < executableSql.length) {
    const character = executableSql[index];
    if (/\s/.test(character)) {
      index += 1;
    } else if (character === '"') {
      let value = "";
      index += 1;
      while (index < executableSql.length) {
        if (executableSql[index] !== '"') {
          value += executableSql[index++];
        } else if (executableSql[index + 1] === '"') {
          value += '"';
          index += 2;
        } else {
          index += 1;
          break;
        }
      }
      tokens.push({ kind: "identifier", value: value.toLowerCase(), quoted: true });
    } else if (/[a-z_]/i.test(character)) {
      const start = index++;
      while (index < executableSql.length && /[a-z0-9_$]/i.test(executableSql[index])) {
        index += 1;
      }
      tokens.push({
        kind: "identifier",
        value: executableSql.slice(start, index).toLowerCase(),
        quoted: false,
      });
    } else if (executableSql.startsWith("::", index)) {
      tokens.push({ kind: "symbol", value: "::" });
      index += 2;
    } else {
      tokens.push({ kind: "symbol", value: character });
      index += 1;
    }
  }
  return { executableSql, tokens };
}

function assertNoPublicFunctionCalls(tokens, label) {
  for (let index = 0; index <= tokens.length - 4; index += 1) {
    const [schema, dot, functionName, openingParenthesis] = tokens.slice(index, index + 4);
    const previous = tokens[index - 1];
    const typeContext =
      previous?.value === "::" ||
      (previous?.kind === "identifier" && previous.quoted === false && previous.value === "as");
    if (
      !typeContext &&
      schema.kind === "identifier" &&
      schema.value === "public" &&
      dot.value === "." &&
      functionName.kind === "identifier" &&
      openingParenthesis.value === "("
    ) {
      assert.fail(`${label} directly calls public.${functionName.value}()`);
    }
  }
}

function assertAssertionOnlySql(sql, label) {
  const { executableSql, tokens } = tokenizeExecutableSql(sql);
  assert.doesNotMatch(
    executableSql,
    /\b(create|alter|drop|grant|revoke|insert|update|delete|truncate|merge|copy|execute|call)\b/i,
    `${label} contains forbidden DDL/DML`,
  );
  assertNoPublicFunctionCalls(tokens, label);
  assert.doesNotMatch(
    executableSql,
    /\b(?:supabase_migrations|auth|realtime|storage)\s*\./i,
    `${label} references a migration ledger or Supabase subsystem schema`,
  );
  return executableSql;
}

for (const [label, sql] of [
  ["PERFORM", "perform public.some_mutating_function();"],
  ["parenthesized PERFORM", "perform (public.some_mutating_function());"],
  ["SELECT", "select public.some_mutating_function();"],
  ["parenthesized SELECT", "select (public.some_mutating_function());"],
  ["nested SELECT", "select coalesce(public.some_mutating_function(), 1);"],
  ["nested multiline SELECT", `select (
    pg_catalog.coalesce(
      PUBLIC . some_mutating_function
      (),
      1
    )
  );`],
  ["quoted identifier SELECT", 'select "public"."some_mutating_function"();'],
]) {
  assert.throws(
    () => assertAssertionOnlySql(sql, `${label} self-test`),
    /directly calls public\.some_mutating_function\(\)/,
  );
}
assert.doesNotThrow(() => assertAssertionOnlySql(`
  -- perform public.some_mutating_function();
  /* select public.some_mutating_function(); */
  select 'public.some_mutating_function()'::text;
  select null::public.some_type;
  select pg_catalog.coalesce(pg_catalog.count(*), 0) from public.question_reviews;
`, "non-call self-test"));

const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));
assert.equal(inventory.formatVersion, 1);
assert.equal(
  inventory.boundary,
  "legacy-20260720-through-20260814174227",
  "archive boundary changed",
);
assert.deepEqual(inventory.files, expectedArchive, "frozen archive inventory changed");

const archiveFiles = await listTreeWithoutLinks(archiveRoot);
const archiveSqlNames = archiveFiles
  .filter((path) => path.toLowerCase().endsWith(".sql"))
  .map((path) => basename(path))
  .toSorted();
assert.deepEqual(
  archiveSqlNames,
  expectedArchive.map((item) => item.name).toSorted(),
  "archive SQL inventory is not exact",
);
for (const expected of expectedArchive) {
  const bytes = await readFile(join(archiveRoot, expected.name));
  assert.equal(bytes.byteLength, expected.bytes, `${expected.name} byte size changed`);
  assert.equal(sha256(bytes), expected.sha256, `${expected.name} SHA-256 changed`);
}

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assert.equal(manifest.productionDeployable, false);
const orders = manifest.entries.map((entry) => entry.order);
assert.deepEqual(orders, orders.toSorted((left, right) => left - right));
assert.equal(new Set(orders).size, orders.length, "manifest orders must be unique");

const manifestArchivePaths = manifest.entries
  .map((entry) => entry.path.replaceAll("\\", "/"))
  .filter((path) => path.startsWith("database/migration-archive/"));
assert.deepEqual(
  manifestArchivePaths.map((path) => basename(path)).toSorted(),
  expectedArchive.map((item) => item.name).toSorted(),
  "manifest must explicitly replay every archived migration exactly once",
);

const activeEntries = manifest.entries.filter((entry) => entry.activeMigration === true);
assert.ok(activeEntries.length > 0, "manifest has no explicitly approved active migrations");
const approvedActiveNames = activeEntries.map((entry) => {
  const path = entry.path.replaceAll("\\", "/");
  assert.match(path, /^supabase\/migrations\/[^/]+\.sql$/);
  return basename(path);
});

const activeFiles = (await listTreeWithoutLinks(activeRoot))
  .filter((path) => path.toLowerCase().endsWith(".sql"));
const activeNames = activeFiles.map((path) => basename(path)).toSorted();
assert.deepEqual(
  activeNames,
  approvedActiveNames.toSorted(),
  "active migrations differ from the manifest allowlist",
);

const versions = [];
for (const name of activeNames) {
  assert.match(name, /^\d{14}_[a-z0-9_]+\.sql$/, `noncanonical active migration: ${name}`);
  const version = name.slice(0, 14);
  assert.ok(version > archiveBoundaryVersion, `${name} is not later than the archive boundary`);
  versions.push(version);
}
assert.equal(new Set(versions).size, versions.length, "duplicate active migration timestamp");
assert.equal(
  activeNames[0],
  "20260823000000_review_v3_epoch_guard.sql",
  "the first active epoch migration must be the reviewed guard",
);

const replayReadme = await readFile(replayReadmePath, "utf8");
assert.match(
  replayReadme,
  /Admin Edit Soal Phase 2A is implemented by the strictly post-epoch/i,
  "replay documentation must identify the post-epoch Admin Edit migration",
);
assert.match(
  replayReadme,
  /PR #48 remains a read-only historical reference and its pre-epoch migration is\s+not active or reused/i,
  "replay documentation must preserve the PR #48 rejection boundary",
);
assert.match(
  replayReadme,
  /PR #49 \/ trusted sync \/ fingerprint-v3 work remains\s+separate and is not implemented or authorized/i,
  "replay documentation must preserve the PR #49 scope boundary",
);

const supabaseFiles = await listTreeWithoutLinks(join(repositoryRoot, "supabase"));
const archivedNameSet = new Set(expectedArchive.map((item) => item.name.toLowerCase()));
const archivedHashSet = new Set(expectedArchive.map((item) => item.sha256));
for (const path of supabaseFiles) {
  assert.ok(
    !archivedNameSet.has(basename(path).toLowerCase()),
    `archived migration is discoverable under supabase/: ${path}`,
  );
  if (path.toLowerCase().endsWith(".sql")) {
    assert.ok(
      !archivedHashSet.has(sha256(await readFile(path))),
      `byte-identical archived SQL is discoverable under supabase/: ${path}`,
    );
  }
}

const guardPath = join(activeRoot, "20260823000000_review_v3_epoch_guard.sql");
const guardSql = await readFile(guardPath, "utf8");
const executableGuard = assertAssertionOnlySql(guardSql, "epoch guard");
assert.match(guardSql, /MIGRATION_EPOCH_GUARD_FAILED/);
assert.match(executableGuard, /pg_advisory_xact_lock/i);

console.log(
  `Migration epoch layout passed: ${expectedArchive.length} frozen archive files verified; ${activeNames.length} explicitly approved active migration(s).`,
);
