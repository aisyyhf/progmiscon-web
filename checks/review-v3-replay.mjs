import { spawn } from "node:child_process";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
);
const supabaseCli = join(
  repositoryRoot,
  "node_modules",
  "supabase",
  "dist",
  "supabase.js",
);
const manifestPath = join(
  repositoryRoot,
  "database",
  "replay",
  "review-v3-manifest.json",
);
const fixturePath = "database/replay/fixtures/pre-v3-reviews.sql";
const prerequisitePath =
  "database/replay/review-v3-legacy-prerequisite.sql";
const localEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) =>
      ![
        "DATABASE_URL",
        "PGHOST",
        "PGPORT",
        "PGUSER",
        "PGPASSWORD",
        "SUPABASE_ACCESS_TOKEN",
        "SUPABASE_DB_PASSWORD",
        "SUPABASE_PROJECT_ID",
      ].includes(name),
  ),
);
localEnvironment.SUPABASE_TELEMETRY_DISABLED = "1";

function commandText(command, arguments_) {
  return [command, ...arguments_].join(" ");
}

function runCommand(
  command,
  arguments_,
  {
    cwd = repositoryRoot,
    input = null,
    allowFailure = false,
    localDbPushRoot = null,
  } = {},
) {
  const cliArguments =
    command === process.execPath && arguments_[0] === supabaseCli
      ? arguments_.slice(1)
      : [];
  const exactLocalDbPush =
    localDbPushRoot !== null &&
    resolve(cwd) === resolve(localDbPushRoot) &&
    JSON.stringify(cliArguments) ===
      JSON.stringify([
        "db",
        "push",
        "--local",
        "--yes",
        "--workdir",
        localDbPushRoot,
      ]);
  const rendered = commandText(command, arguments_).toLowerCase();
  const forbiddenOption = ["--linked", "--db-url", "--include-all"].some(
    (option) => cliArguments.includes(option),
  );
  const forbiddenCommand =
    ["link", "login"].includes(cliArguments[0]) ||
    (cliArguments[0] === "migration" && cliArguments[1] === "repair") ||
    (cliArguments[0] === "db" && cliArguments[1] === "push" && !exactLocalDbPush);
  if (forbiddenOption || forbiddenCommand) {
    throw new Error(`LOCAL_REPLAY_SAFETY_REJECTION: ${rendered}`);
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(command, arguments_, {
      cwd,
      env: localEnvironment,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      rejectPromise(
        Object.assign(
          new Error(`LOCAL_REPLAY_TOOL_UNAVAILABLE: ${command}: ${error.message}`),
          { cause: error },
        ),
      );
    });
    child.on("close", (code) => {
      const result = { code, stdout, stderr };
      if (code === 0 || allowFailure) resolvePromise(result);
      else {
        rejectPromise(
          Object.assign(
            new Error(
              `Local command failed (${code}): ${commandText(command, arguments_)}\n${stderr}`,
            ),
            { result },
          ),
        );
      }
    });
    if (input !== null) child.stdin.end(input);
    else child.stdin.end();
  });
}

function runSupabase(arguments_, options) {
  return runCommand(process.execPath, [supabaseCli, ...arguments_], options);
}

function assertInside(parent, candidate) {
  const pathFromParent = relative(resolve(parent), resolve(candidate));
  if (
    pathFromParent === "" ||
    pathFromParent === ".." ||
    pathFromParent.startsWith(`..${sep}`)
  ) {
    throw new Error(`Unsafe temporary path: ${candidate}`);
  }
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function allocateLoopbackPorts(count) {
  const servers = [];
  try {
    for (let index = 0; index < count; index += 1) {
      const server = createServer();
      await new Promise((resolvePromise, rejectPromise) => {
        server.once("error", rejectPromise);
        server.listen(0, "127.0.0.1", resolvePromise);
      });
      servers.push(server);
    }
    return servers.map((server) => server.address().port);
  } finally {
    await Promise.all(
      servers.map(
        (server) =>
          new Promise((resolvePromise) => server.close(resolvePromise)),
      ),
    );
  }
}

async function preflight() {
  let versionRoot;
  try {
    if (!(await exists(supabaseCli))) throw new Error("local CLI entrypoint missing");
    versionRoot = await mkdtemp(join(tmpdir(), "progmiscon-review-v3-cli-"));
    assertInside(tmpdir(), versionRoot);
    await runSupabase(["--version"], { cwd: versionRoot });
  } catch (error) {
    throw new Error(
      `LOCAL_REPLAY_BLOCKED: installed Supabase CLI required; no remote or npx fallback is permitted. ${error.message}`,
    );
  } finally {
    if (versionRoot) await rm(versionRoot, { recursive: true, force: true });
  }
  const docker = await runCommand("docker", ["info"], { allowFailure: true });
  if (docker.code !== 0) {
    throw new Error(
      "LOCAL_REPLAY_BLOCKED: Docker-compatible local engine is not running; no database command was executed.",
    );
  }
}

async function loadManifest() {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.productionDeployable !== false) {
    throw new Error("Replay manifest must be explicitly non-deployable.");
  }
  const entries = manifest.entries.toSorted((left, right) => left.order - right.order);
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.order)) throw new Error(`Duplicate manifest order ${entry.order}`);
    seen.add(entry.order);
    const source = resolve(repositoryRoot, entry.path);
    assertInside(repositoryRoot, source);
    if (!(await exists(source))) throw new Error(`Manifest source missing: ${entry.path}`);
  }
  return entries;
}

async function createLocalWorkdir(label) {
  const root = await mkdtemp(join(tmpdir(), `progmiscon-review-v3-${label}-`));
  assertInside(tmpdir(), root);
  try {
    await runSupabase(["init", "--force", "--workdir", root], { cwd: root });
    const linkedRef = join(root, "supabase", ".temp", "project-ref");
    if (await exists(linkedRef)) {
      throw new Error("LOCAL_REPLAY_BLOCKED: temporary workdir unexpectedly contains a linked project ref.");
    }
    const configPath = join(root, "supabase", "config.toml");
    const projectId = `review-v3-${label}-${process.pid}`;
    const config = await readFile(configPath, "utf8");
    const portPattern =
      /^(\s*(?:port|shadow_port|smtp_port|pop3_port)\s*=\s*)\d+(\s*)$/gm;
    const ports = await allocateLoopbackPorts([...config.matchAll(portPattern)].length);
    let portIndex = 0;
    const isolatedConfig = (/^project_id\s*=.*$/m.test(config)
      ? config.replace(/^project_id\s*=.*$/m, `project_id = "${projectId}"`)
      : `project_id = "${projectId}"\n${config}`
    ).replace(
      portPattern,
      (_match, prefix, suffix) => `${prefix}${ports[portIndex++]}${suffix}`,
    );
    await writeFile(configPath, isolatedConfig, "utf8");
    return { root, projectId, started: false, loopbackProven: false };
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

async function proveLoopback(workdir) {
  const status = await runSupabase(
    ["status", "--output", "json", "--workdir", workdir.root],
    { cwd: workdir.root },
  );
  const parsed = JSON.parse(status.stdout);
  const databaseUrl =
    parsed.DB_URL ?? parsed.db_url ?? parsed.database_url ?? parsed.databaseUrl;
  if (!databaseUrl) throw new Error("LOCAL_REPLAY_BLOCKED: local status omitted DB URL.");
  const url = new URL(databaseUrl);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]", "::1"].includes(url.hostname)
  ) {
    throw new Error(`LOCAL_REPLAY_BLOCKED: database is not loopback (${url.hostname}).`);
  }
  if (await exists(join(workdir.root, "supabase", ".temp", "project-ref"))) {
    throw new Error("LOCAL_REPLAY_BLOCKED: linked project metadata appeared in temporary workdir.");
  }
  workdir.loopbackProven = true;
}

async function startAndProve(workdir) {
  // Start an empty local DB first; custom migrations are staged only after proof.
  workdir.started = true;
  await runSupabase(
    ["db", "start", "--workdir", workdir.root],
    { cwd: workdir.root },
  );
  await proveLoopback(workdir);
}

function selectedManifestSources(entries, scenario) {
  return entries
    .filter(
      (entry) =>
        !entry.scenario ||
        (entry.scenario === "legacy-data-only" && scenario === "legacy-data"),
    )
    .map((entry) => entry.path);
}

async function stageSources(
  workdir,
  sources,
  { preserveBasenames = false } = {},
) {
  const migrationDirectory = join(workdir.root, "supabase", "migrations");
  assertInside(workdir.root, migrationDirectory);
  await rm(migrationDirectory, { recursive: true, force: true });
  await mkdir(migrationDirectory, { recursive: true });
  for (const [index, sourcePath] of sources.entries()) {
    const source = resolve(repositoryRoot, sourcePath);
    assertInside(repositoryRoot, source);
    const version = String(20990101000000n + BigInt(index + 1));
    const destination = join(migrationDirectory, preserveBasenames
      ? basename(sourcePath)
      : `${version}_${basename(sourcePath)}`);
    assertInside(migrationDirectory, destination);
    await copyFile(source, destination);
  }
}

async function pushOnlyApprovedLocalEpoch(workdir) {
  if (!workdir.loopbackProven) {
    throw new Error("LOCAL_REPLAY_BLOCKED: local db push requires prior loopback proof.");
  }
  return runCommand(
    process.execPath,
    [
      supabaseCli,
      "db",
      "push",
      "--local",
      "--yes",
      "--workdir",
      workdir.root,
    ],
    { cwd: workdir.root, localDbPushRoot: workdir.root },
  );
}

async function resetLocal(workdir, { allowFailure = false } = {}) {
  return runSupabase(
    ["db", "reset", "--local", "--no-seed", "--workdir", workdir.root],
    { cwd: workdir.root, allowFailure },
  );
}

async function databaseContainerId(workdir) {
  const result = await runCommand("docker", [
    "ps",
    "--filter",
    `name=supabase_db_${workdir.projectId}`,
    "--format",
    "{{.ID}}",
  ]);
  const identifiers = result.stdout.trim().split(/\s+/).filter(Boolean);
  if (identifiers.length !== 1) {
    throw new Error(
      `LOCAL_REPLAY_BLOCKED: expected one isolated DB container, found ${identifiers.length}.`,
    );
  }
  return identifiers[0];
}

async function psql(workdir, sql, { allowFailure = false } = {}) {
  const containerId = await databaseContainerId(workdir);
  return runCommand(
    "docker",
    [
      "exec",
      "-i",
      containerId,
      "psql",
      "-X",
      "-q",
      "-A",
      "-t",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: sql, allowFailure },
  );
}

async function runSqlFile(workdir, path) {
  const sql = await readFile(resolve(repositoryRoot, path), "utf8");
  await psql(workdir, sql);
}

async function exportContracts(workdir) {
  const outputDirectory = join(workdir.root, "contracts");
  await mkdir(outputDirectory, { recursive: true });
  const exports = [
    ["database/replay/queries/schema-contract.sql", "production-review-schema-contracts.csv"],
    ["database/replay/queries/sync-contract.sql", "production-review-sync-contracts.csv"],
    ["database/replay/queries/runtime-contract.sql", "production-review-runtime-functions.csv"],
  ];
  for (const [queryPath, outputName] of exports) {
    const query = (await readFile(resolve(repositoryRoot, queryPath), "utf8"))
      .trim()
      .replace(/;$/, "");
    const result = await psql(
      workdir,
      `copy (${query}) to stdout with (format csv, header true);\n`,
    );
    await writeFile(join(outputDirectory, outputName), result.stdout, "utf8");
  }
  await runCommand(process.execPath, [
    join(repositoryRoot, "checks", "review-v3-contract-diff.mjs"),
    "--actual-dir",
    outputDirectory,
  ]);
}

async function cleanup(workdir) {
  if (!workdir) return;
  assertInside(tmpdir(), workdir.root);
  if (workdir.started) {
    await runSupabase(
      [
        "stop",
        "--no-backup",
        "--project-id",
        workdir.projectId,
        "--workdir",
        workdir.root,
      ],
      { cwd: workdir.root, allowFailure: true },
    );
  }
  await rm(workdir.root, { recursive: true, force: true });
}

async function runPositiveScenario(entries, scenario) {
  let workdir;
  try {
    workdir = await createLocalWorkdir(scenario);
    await startAndProve(workdir);
    await stageSources(workdir, selectedManifestSources(entries, scenario));
    await resetLocal(workdir);
    await exportContracts(workdir);
    if (scenario === "legacy-data") {
      await runSqlFile(workdir, "database/replay/assert-legacy-backfill.sql");
    } else {
      await runSqlFile(workdir, "database/replay/review-v3-behavior.sql");
    }
    console.log(`Review-v3 ${scenario} local replay passed.`);
  } finally {
    await cleanup(workdir);
  }
}

const negativeCases = [
  ["missing-target-baseline.sql", "REVIEW_V3_MISSING_QUESTION_BASELINE"],
  ["answer-parent-mismatch.sql", "REVIEW_V3_ANSWER_PARENT_MISMATCH"],
  ["override-without-baseline.sql", "REVIEW_V3_UNMAPPABLE_QUESTION_OVERRIDE"],
  ["reviewer-cap-exceeded.sql", "REVIEW_V3_REVIEWER_CAP_EXCEEDED"],
  ["duplicate-legacy-review.sql", "REVIEW_V3_DUPLICATE_LEGACY_REVIEW"],
  ["malformed-lifecycle.sql", "REVIEW_V3_MALFORMED_LIFECYCLE"],
];

const epochGuardNegativeCases = [
  ["missing-required-trigger.sql", "TRIGGER_CONTRACT"],
  ["forbidden-legacy-trigger.sql", "TRIGGER_CONTRACT"],
  ["missing-critical-function.sql", "FUNCTION_CONTRACT_OR_EXPOSURE"],
  ["invalid-active-source-version.sql", "ACTIVE_QUESTION_REVIEW_SOURCE_VERSION_MISMATCH"],
  ["reviewer-cap-exceeded.sql", "ACTIVE_REVIEWER_CAP_EXCEEDED"],
  ["malformed-lifecycle.sql", "MALFORMED_REVIEW_LIFECYCLE"],
  ["malformed-lifecycle-invalid-reason.sql", "MALFORMED_REVIEW_LIFECYCLE"],
  ["malformed-lifecycle-null-reason.sql", "MALFORMED_REVIEW_LIFECYCLE"],
  ["unsafe-review-write-policy.sql", "RLS_POLICY_CONTRACT"],
  ["unsafe-function-exposure.sql", "FUNCTION_CONTRACT_OR_EXPOSURE"],
];

async function runNegativeCases(entries) {
  const history = entries
    .filter((entry) => entry.order <= 100)
    .map((entry) => entry.path);
  let workdir;
  try {
    workdir = await createLocalWorkdir("negative");
    await startAndProve(workdir);
    for (const [file, expectedError] of negativeCases) {
      await stageSources(workdir, [
        ...history,
        fixturePath,
        `database/replay/fixtures/negative/${file}`,
        prerequisitePath,
      ]);
      const result = await resetLocal(workdir, { allowFailure: true });
      const output = `${result.stdout}\n${result.stderr}`;
      if (result.code === 0 || !output.includes(expectedError)) {
        throw new Error(
          `Negative replay ${file} did not fail with ${expectedError}.\n${output}`,
        );
      }
      const rollback = await psql(
        workdir,
        "select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'question_misconception_baselines' and column_name = 'source_version';\n",
      );
      if (rollback.stdout.trim() !== "0") {
        throw new Error(`Negative replay ${file} did not roll back prerequisite DDL.`);
      }
      console.log(`Review-v3 negative replay passed: ${file}`);
    }
  } finally {
    await cleanup(workdir);
  }
}

async function runEpochGuardNegativeCases(entries) {
  const guard = entries.find((entry) => entry.activeMigration === true);
  if (!guard) throw new Error("Epoch guard is not declared in the replay manifest.");
  const foundation = selectedManifestSources(entries, "empty").filter(
    (path) => path !== guard.path,
  );
  const guardSql = await readFile(resolve(repositoryRoot, guard.path), "utf8");
  let workdir;
  try {
    workdir = await createLocalWorkdir("epoch-negative");
    await startAndProve(workdir);
    for (const [file, expectedError] of epochGuardNegativeCases) {
      await stageSources(workdir, foundation);
      await resetLocal(workdir);
      await runSqlFile(
        workdir,
        `database/replay/fixtures/epoch-guard-negative/${file}`,
      );
      const result = await psql(workdir, guardSql, { allowFailure: true });
      const output = `${result.stdout}\n${result.stderr}`;
      if (result.code === 0 || !output.includes("MIGRATION_EPOCH_GUARD_FAILED") || !output.includes(expectedError)) {
        throw new Error(
          `Epoch guard negative ${file} did not fail closed with ${expectedError}.\n${output}`,
        );
      }
      console.log(`Migration epoch guard negative passed: ${file}`);
    }
  } finally {
    await cleanup(workdir);
  }
}

async function runAbsentLedgerRehearsal(entries) {
  const activeEntries = entries.filter((entry) => entry.activeMigration === true);
  if (activeEntries.length !== 1) {
    throw new Error(
      `Absent-ledger rehearsal requires one currently approved epoch migration; found ${activeEntries.length}.`,
    );
  }
  const guard = activeEntries[0];
  const foundation = selectedManifestSources(entries, "empty").filter(
    (path) => path !== guard.path,
  );
  let workdir;
  try {
    workdir = await createLocalWorkdir("absent-ledger");
    await startAndProve(workdir);
    await stageSources(workdir, foundation);
    await resetLocal(workdir);
    await exportContracts(workdir);

    await psql(workdir, "drop schema supabase_migrations cascade;\n");
    const absent = await psql(
      workdir,
      "select pg_catalog.to_regclass('supabase_migrations.schema_migrations') is null;\n",
    );
    if (absent.stdout.trim() !== "t") {
      throw new Error("Absent-ledger rehearsal could not prove the migration ledger was absent.");
    }

    await stageSources(workdir, [guard.path], { preserveBasenames: true });
    await pushOnlyApprovedLocalEpoch(workdir);

    const ledger = await psql(
      workdir,
      "select version || '|' || name from supabase_migrations.schema_migrations order by version;\n",
    );
    const ledgerRows = ledger.stdout.trim().split(/\r?\n/).filter(Boolean);
    if (
      ledgerRows.length !== 1 ||
      ledgerRows[0] !== "20260823000000|review_v3_epoch_guard"
    ) {
      throw new Error(
        `Absent-ledger rehearsal found an unexpected migration set: ${JSON.stringify(ledgerRows)}`,
      );
    }
    await exportContracts(workdir);
    console.log(
      "Absent-ledger local epoch rehearsal passed: only the guard was discovered and recorded.",
    );
  } finally {
    await cleanup(workdir);
  }
}

const options = process.argv.slice(2);
if (options.some((option) => option !== "--epoch-negative-only")) {
  throw new Error(`Unknown replay option: ${options.join(" ")}`);
}
const epochNegativeOnly = options.includes("--epoch-negative-only");

await runCommand(process.execPath, [
  join(repositoryRoot, "checks", "migration-epoch-layout.mjs"),
]);
await preflight();
const entries = await loadManifest();
if (epochNegativeOnly) {
  await runEpochGuardNegativeCases(entries);
  console.log("Migration epoch guard targeted negative suite passed.");
} else {
  await runPositiveScenario(entries, "empty");
  await runPositiveScenario(entries, "legacy-data");
  await runNegativeCases(entries);
  await runEpochGuardNegativeCases(entries);
  await runAbsentLedgerRehearsal(entries);
  console.log("Review-v3 disposable local replay suite passed.");
}
