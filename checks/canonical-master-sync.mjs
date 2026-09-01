// CLI + integration tests for scripts/canonical-master-sync.mjs.
//
// NO real network and NO real Supabase: the mutation RPC is always injected
// (deps.callSyncRpc). File reads use the committed offline fixtures only.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  computeBundleHash,
  parseArgs,
  parseIdList,
  projectRef,
  runCanonicalMasterSync,
  SYNC_RPC,
} from "../scripts/canonical-master-sync.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const FIX = join(repoRoot, "checks", "fixtures", "canonical-sync");
const REF = "abcdefghijklmnop";
const APPLY_ENV = {
  CANONICAL_MASTER_SYNC_ENABLED: "true",
  PRODUCTION_SUPABASE_URL: `https://${REF}.supabase.co`,
  PRODUCTION_SUPABASE_SERVICE_ROLE_KEY: "test-service-role-key",
};

function baseArgs({ proposed = "proposed-ok", oracle = "oracle-clean", allow = "Q2", max = "3" } = {}) {
  return [
    "--current", join(FIX, "current"),
    "--proposed", join(FIX, proposed),
    "--oracle", join(FIX, `${oracle}.json`),
    "--allow", allow,
    "--max-question-bumps", max,
    "--expect-ref", REF,
  ];
}
async function run(argv, { env = {}, callSyncRpc } = {}) {
  const lines = [];
  const deps = { log: (l) => lines.push(l) };
  if (callSyncRpc) deps.callSyncRpc = callSyncRpc;
  const result = await runCanonicalMasterSync({ argv, env, deps });
  return { ...result, output: lines.join("\n") };
}

// A mutation RPC that records that it was called and returns a canned row.
function fakeRpc(row) {
  const calls = [];
  const fn = async (input) => {
    calls.push(input);
    return row;
  };
  fn.calls = calls;
  return fn;
}

// ---------------------------------------------------------------------------
// pure helpers
// ---------------------------------------------------------------------------
assert.deepEqual(parseIdList("Q225, Q226 ,Q259,"), ["Q225", "Q226", "Q259"]);
assert.equal(projectRef(`https://${REF}.supabase.co`), REF);
assert.throws(() => projectRef("https://x.example.com"), /could not extract/);
assert.deepEqual(parseArgs(["--current", "a", "--apply", "--json"]), {
  _: [], apply: true, json: true, current: "a",
});
assert.throws(() => parseArgs(["--current"]), /missing value/);

// ---------------------------------------------------------------------------
// 1. plan mode — applyable / blocked exit codes, no RPC ever called
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 1, answer_versions_changed: 0 });
  const ok = await run(baseArgs(), { callSyncRpc: rpc });
  assert.equal(ok.exitCode, 0, "applyable plan exits 0");
  assert.equal(ok.report.plan_is_applyable, true);
  assert.match(ok.output, /--apply-bundle-hash sha256:/);
  assert.equal(rpc.calls.length, 0, "plan mode never calls the RPC");

  const blocked = await run(baseArgs({ proposed: "proposed-extra-question" }), { callSyncRpc: rpc });
  assert.equal(blocked.exitCode, 1, "blocked plan exits 1");
  assert.equal(blocked.report.plan_is_applyable, false);
  assert.equal(rpc.calls.length, 0);
}

// ---------------------------------------------------------------------------
// 2. answer fail-closed gates in the CLI
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 1, answer_versions_changed: 0 });
  const answerBump = await run(baseArgs({ proposed: "proposed-answer-bump" }), { callSyncRpc: rpc });
  assert.equal(answerBump.exitCode, 1, "any answer bump blocks the question-only pilot");
  assert.deepEqual(answerBump.report.predicted.unexpected_answer_bumps, ["A1"]);
  assert.equal(rpc.calls.length, 0);
}

// ---------------------------------------------------------------------------
// 3. apply is refused before any mutation for every missing precondition
// ---------------------------------------------------------------------------
async function applyRefused(name, { argv, env }) {
  const rpc = fakeRpc({ question_versions_changed: 1, answer_versions_changed: 0 });
  const res = await run(argv, { env, callSyncRpc: rpc });
  assert.equal(res.exitCode, 1, `${name}: apply refused -> exit 1`);
  assert.equal(rpc.calls.length, 0, `${name}: RPC MUST NOT be called`);
  assert.equal(res.report.apply_blocked, true, `${name}: apply_blocked flag set`);
  return res;
}

// need a valid bundle hash for the "everything else present" cases
const goodBundleHash = computeBundleHash({
  currentFiles: readDir(join(FIX, "current")),
  proposedFiles: readDir(join(FIX, "proposed-ok")),
  oracleBytes: readFileSync(join(FIX, "oracle-clean.json")),
});

await applyRefused("plan not applyable", {
  argv: [...baseArgs({ proposed: "proposed-extra-question" }), "--apply", "--apply-bundle-hash", "sha256:whatever"],
  env: APPLY_ENV,
});
await applyRefused("missing --apply-bundle-hash", {
  argv: [...baseArgs(), "--apply"],
  env: APPLY_ENV,
});
await applyRefused("snapshot changed after preview (hash mismatch)", {
  argv: [...baseArgs(), "--apply", "--apply-bundle-hash", `sha256:${"1".repeat(64)}`],
  env: APPLY_ENV,
});
await applyRefused("wrong Production ref", {
  argv: [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash],
  env: { ...APPLY_ENV, PRODUCTION_SUPABASE_URL: "https://someotherproject.supabase.co" },
});
await applyRefused("enable flag not exactly 'true'", {
  argv: [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash],
  env: { ...APPLY_ENV, CANONICAL_MASTER_SYNC_ENABLED: "yes" },
});
await applyRefused("missing service role key", {
  argv: [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash],
  env: { ...APPLY_ENV, PRODUCTION_SUPABASE_SERVICE_ROLE_KEY: "" },
});

// ---------------------------------------------------------------------------
// 4. successful apply — injected RPC, post-oracle verification, exit 0
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({
    question_count: 3, answer_count: 2, misconception_count: 3,
    question_versions_changed: 1, answer_versions_changed: 0,
    synced_at: "2026-09-01T00:00:00Z",
  });
  const res = await run(
    [
      ...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash,
      "--post-oracle", join(FIX, "oracle-after-q2-bump.json"),
    ],
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 0, res.output);
  assert.equal(rpc.calls.length, 1, "exactly one RPC call");
  const payload = rpc.calls[0].payload;
  assert.ok(Array.isArray(payload.input_question_baselines));
  assert.ok(Array.isArray(payload.input_answer_baselines));
  assert.ok(Array.isArray(payload.input_misconception_ids));
  assert.equal(res.report.post_apply.ok, true);
  assert.deepEqual(res.report.post_apply.observedQuestionBumpIds, ["Q2"]);
  assert.deepEqual(res.report.post_apply.observedAnswerBumpIds, []);
  assert.match(res.output, /APPLY VERIFIED/);
}

// ---------------------------------------------------------------------------
// 5. apply where the RPC reports an unexpected answer bump -> non-zero
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 1, answer_versions_changed: 2, synced_at: "x" });
  const res = await run(
    [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash],
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 1, "RPC-reported answer bump -> non-zero exit");
  assert.equal(res.report.post_apply.ok, false);
  assert.ok(res.report.post_apply.failures.some((f) => /answer/i.test(f)));
  assert.match(res.output, /APPLY VERIFICATION FAILED/);
}

// ---------------------------------------------------------------------------
// 6. apply where the RPC reports more question bumps than planned -> non-zero
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 4, answer_versions_changed: 0, synced_at: "x" });
  const res = await run(
    [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash],
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 1);
  assert.ok(res.report.post_apply.failures.some((f) => /question_versions_changed/.test(f)));
}

// ---------------------------------------------------------------------------
// 7. legacy v1 must be unreachable from PR-1 code
// ---------------------------------------------------------------------------
{
  // The TOOL (CLI + pure module) must never name or invoke the retired v1
  // baseline mutation. The needle is assembled from fragments so this test file
  // does not itself contain the contiguous forbidden token.
  const V1 = ["sync", "master", "relation", "baselines"].join("_");
  const V2 = `${V1}_v2`;
  const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
  for (const rel of ["scripts/canonical-master-sync.mjs", "scripts/lib/canonical-sync-plan.mjs"]) {
    const code = stripComments(readFileSync(join(repoRoot, rel), "utf8"));
    let scan = code;
    while (scan.includes(V1)) {
      const at = scan.indexOf(V1);
      assert.equal(
        scan.slice(at, at + V2.length),
        V2,
        `${rel}: every "${V1}" occurrence (comments stripped) must be the _v2 form`,
      );
      scan = scan.slice(at + V2.length);
    }
  }
  assert.equal(SYNC_RPC, V2);
  // the CLI makes exactly one .rpc() call, and its argument is SYNC_RPC
  const cli = stripComments(readFileSync(join(repoRoot, "scripts/canonical-master-sync.mjs"), "utf8"));
  const rpcArgs = [...cli.matchAll(/\.rpc\s*\(\s*([A-Za-z_]\w*|["'`][^"'`]+["'`])/g)].map((m) => m[1]);
  assert.deepEqual(rpcArgs, ["SYNC_RPC"], "the CLI makes exactly one .rpc() call, to SYNC_RPC");
}

// ---------------------------------------------------------------------------
// 8. fixture drift guard — re-running generate.mjs must not change a byte
// ---------------------------------------------------------------------------
{
  const before = walk(FIX)
    .filter((p) => !p.endsWith("generate.mjs"))
    .map((p) => [relative(FIX, p), readFileSync(p)]);
  execFileSync("node", [join(FIX, "generate.mjs")], { stdio: "pipe" });
  for (const [rel, bytes] of before) {
    assert.ok(
      readFileSync(join(FIX, rel)).equals(bytes),
      `committed fixture ${rel} differs from a fresh generate.mjs run`,
    );
  }
}

console.log("canonical-master-sync checks passed");

// ---------------------------------------------------------------------------
function readDir(dir) {
  const out = {};
  for (const name of readdirSync(dir)) out[name] = readFileSync(join(dir, name));
  return out;
}
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}
