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
    "--max-question-changes", max,
    "--expect-ref", REF,
  ];
}
async function run(argv, { env = {}, callSyncRpc } = {}) {
  const lines = [];
  const deps = {
    log: (l) => lines.push(l),
    sleep: () => Promise.resolve(), // never wall-clock wait in tests
    postOraclePollMs: 0,
    postOraclePollMax: 3,
  };
  if (callSyncRpc) deps.callSyncRpc = callSyncRpc;
  const result = await runCanonicalMasterSync({ argv, env, deps });
  return { ...result, output: lines.join("\n") };
}
const post = (name) => join(FIX, `${name}.json`);

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
assert.deepEqual(parseArgs(["--current", "a", "--apply", "--json"]), {
  _: [], apply: true, json: true, current: "a",
});
assert.throws(() => parseArgs(["--current"]), /missing value/);

// ---------------------------------------------------------------------------
// F1 — strict Production URL validation (fail-closed)
// ---------------------------------------------------------------------------
{
  // exactly one valid Production-style URL passes
  assert.equal(projectRef(`https://${REF}.supabase.co`), REF);
  assert.equal(projectRef(`https://${REF}.supabase.co/`), REF, "a bare trailing slash is fine");

  const rejected = [
    [`https://${REF}.supabase.co.evil.example`, /host must be exactly/],
    [`https://${REF}.attacker.net`, /host must be exactly/],
    [`https://evil${REF}.supabase.co.attacker.io`, /host must be exactly/],
    [`http://${REF}.supabase.co`, /must use https:/],
    [`https://user:pass@${REF}.supabase.co`, /username or password/],
    [`https://${REF}.supabase.co:5432`, /must not specify a port/],
    [`https://${REF}.supabase.co/rest/v1`, /no path, query string, or fragment/],
    [`https://${REF}.supabase.co?x=1`, /no path, query string, or fragment/],
    [`https://${REF}.supabase.co#frag`, /no path, query string, or fragment/],
    [`https://sub.${REF}.supabase.co`, /host must be exactly/],
    [`https://short.supabase.co`, /host must be exactly/],       // ref too short
    ["not a url", /not a valid URL/],
    ["ftp://x", /must use https:/],
    ["", /not a valid URL/],
  ];
  for (const [input, pattern] of rejected) {
    assert.throws(() => projectRef(input), pattern, `projectRef must reject ${JSON.stringify(input)}`);
  }
  // URL parser lowercases the host, so an uppercase ref normalises rather than
  // throwing; the CLI's ref-equality check is what rejects a mismatch.
  assert.equal(projectRef(`https://${REF.toUpperCase()}.supabase.co`), REF);
}

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
  const rpc = fakeRpc({ question_versions_changed: 0, answer_versions_changed: 0 });
  const answerBump = await run(baseArgs({ proposed: "proposed-answer-bump" }), { callSyncRpc: rpc });
  assert.equal(answerBump.exitCode, 1, "any answer content change blocks a question-only edit");
  assert.deepEqual(answerBump.report.predicted.unexpected_answer_content_changes, ["A1"]);
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

const APPLY_TAIL = ["--apply", "--apply-bundle-hash", "PLACEHOLDER", "--post-oracle", post("oracle-after-q2-edit")];
const withHash = (h) => APPLY_TAIL.map((t) => (t === "PLACEHOLDER" ? h : t));

await applyRefused("plan not applyable", {
  argv: [...baseArgs({ proposed: "proposed-extra-question" }), ...withHash("sha256:whatever")],
  env: APPLY_ENV,
});
await applyRefused("missing --apply-bundle-hash", {
  argv: [...baseArgs(), "--apply", "--post-oracle", post("oracle-after-q2-edit")],
  env: APPLY_ENV,
});
await applyRefused("F2: missing --post-oracle", {
  argv: [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash],
  env: APPLY_ENV,
}).then((res) => {
  assert.ok(res.report.apply_blockers.some((b) => /--post-oracle .* is required/.test(b)), "F2 blocker named");
});
await applyRefused("snapshot changed after preview (hash mismatch)", {
  argv: [...baseArgs(), ...withHash(`sha256:${"1".repeat(64)}`)],
  env: APPLY_ENV,
});
await applyRefused("F1: hostile PRODUCTION_SUPABASE_URL (suffix trick)", {
  argv: [...baseArgs(), ...withHash(goodBundleHash)],
  env: { ...APPLY_ENV, PRODUCTION_SUPABASE_URL: `https://${REF}.supabase.co.evil.example` },
}).then((res) => {
  assert.ok(res.report.apply_blockers.some((b) => /host must be exactly/.test(b)), "F1: host rejected");
});
await applyRefused("F1: hostile PRODUCTION_SUPABASE_URL (other TLD)", {
  argv: [...baseArgs(), ...withHash(goodBundleHash)],
  env: { ...APPLY_ENV, PRODUCTION_SUPABASE_URL: `https://${REF}.attacker.net` },
});
await applyRefused("F1: http:// PRODUCTION_SUPABASE_URL", {
  argv: [...baseArgs(), ...withHash(goodBundleHash)],
  env: { ...APPLY_ENV, PRODUCTION_SUPABASE_URL: `http://${REF}.supabase.co` },
});
await applyRefused("F1: credentialed PRODUCTION_SUPABASE_URL", {
  argv: [...baseArgs(), ...withHash(goodBundleHash)],
  env: { ...APPLY_ENV, PRODUCTION_SUPABASE_URL: `https://u:p@${REF}.supabase.co` },
});
await applyRefused("wrong Production ref", {
  argv: [...baseArgs(), ...withHash(goodBundleHash)],
  env: { ...APPLY_ENV, PRODUCTION_SUPABASE_URL: "https://someotherprojectxxxx.supabase.co" },
});
await applyRefused("enable flag not exactly 'true'", {
  argv: [...baseArgs(), ...withHash(goodBundleHash)],
  env: { ...APPLY_ENV, CANONICAL_MASTER_SYNC_ENABLED: "yes" },
});
await applyRefused("missing service role key", {
  argv: [...baseArgs(), ...withHash(goodBundleHash)],
  env: { ...APPLY_ENV, PRODUCTION_SUPABASE_SERVICE_ROLE_KEY: "" },
});

// ---------------------------------------------------------------------------
// 4. successful apply — fresh post-oracle shows exactly the allowlisted content
//    change with NO source_version rotation
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({
    question_count: 3, answer_count: 2, misconception_count: 3,
    question_versions_changed: 0, answer_versions_changed: 0,
    synced_at: "2026-09-01T00:00:00Z",
  });
  const res = await run(
    [...baseArgs(), ...withHash(goodBundleHash)], // APPLY_TAIL uses oracle-after-q2-edit as --post-oracle
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 0, res.output);
  assert.equal(rpc.calls.length, 1, "exactly one RPC call");
  const payload = rpc.calls[0].payload;
  assert.ok(Array.isArray(payload.input_question_baselines));
  assert.ok(Array.isArray(payload.input_answer_baselines));
  assert.ok(Array.isArray(payload.input_misconception_ids));
  assert.equal(res.report.post_apply.ok, true);
  assert.deepEqual(res.report.post_apply.observedQuestionVersionChanges, []);
  assert.deepEqual(res.report.post_apply.observedAnswerVersionChanges, []);
  assert.deepEqual(
    res.report.post_apply.observedQuestionContentChanges.map((c) => c.id),
    ["Q2"],
    "the allowlisted Q2 fingerprint refresh is observed",
  );
  assert.match(res.output, /APPLY VERIFIED — 1 question and 0 answer source_fingerprint\(s\) refreshed/);
  assert.match(res.output, /NO source_version rotated/);
}

// ---------------------------------------------------------------------------
// 5. RPC counts are 0 but the fresh post-oracle shows the WRONG question rotated
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 0, answer_versions_changed: 0, synced_at: "x" });
  const res = await run(
    [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash, "--post-oracle", post("oracle-after-wrong-q1")],
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 1, "count 0 + rogue Q1 rotation -> failure");
  assert.equal(res.report.post_apply.ok, false);
  assert.ok(res.report.post_apply.failures.some((f) => /Q1 source_version rotated/.test(f)));
  assert.ok(res.report.post_apply.failures.some((f) => /allowlisted question Q2 source_fingerprint did NOT change/.test(f)));
  assert.match(res.output, /APPLY VERIFICATION FAILED/);
}

// ---------------------------------------------------------------------------
// 5b. fresh post-oracle shows an unexpected ANSWER rotated
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 0, answer_versions_changed: 0, synced_at: "x" });
  const res = await run(
    [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash, "--post-oracle", post("oracle-after-answer-rotated")],
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 1, "unexpected answer rotation in post-oracle -> failure");
  assert.ok(res.report.post_apply.failures.some((f) => /answer A1 source_version rotated/.test(f)));
  assert.ok(res.report.post_apply.failures.some((f) => /answer_versions_changed=0 but the fresh post-oracle shows 1/.test(f)));
}

// ---------------------------------------------------------------------------
// 5c. RPC claims a version rotated when a content edit must rotate 0
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 0, answer_versions_changed: 2, synced_at: "x" });
  const res = await run(
    [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash, "--post-oracle", post("oracle-after-q2-edit")],
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 1);
  assert.ok(res.report.post_apply.failures.some((f) => /must rotate 0 answer source_versions/.test(f)));
  assert.ok(res.report.post_apply.failures.some((f) => /answer_versions_changed=2 but the fresh post-oracle shows 0/.test(f)));
}

// ---------------------------------------------------------------------------
// 6. RPC claims a question rotation the post-oracle does not corroborate
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 4, answer_versions_changed: 0, synced_at: "x" });
  const res = await run(
    [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash, "--post-oracle", post("oracle-after-q2-edit")],
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 1);
  assert.ok(res.report.post_apply.failures.some((f) => /must rotate 0 question source_versions/.test(f)));
  assert.ok(res.report.post_apply.failures.some((f) => /question_versions_changed=4 but the fresh post-oracle shows 0/.test(f)));
}

// ---------------------------------------------------------------------------
// 6b. --post-oracle byte-identical to the pre-apply oracle -> not a fresh export
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 1, answer_versions_changed: 0, synced_at: "x" });
  const res = await run(
    [...baseArgs(), "--apply", "--apply-bundle-hash", goodBundleHash, "--post-oracle", post("oracle-clean")],
    { env: APPLY_ENV, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 1, "stale (identical) post-oracle -> verification failure");
  assert.equal(rpc.calls.length, 1, "mutation still happened; verification then failed");
  assert.ok(res.report.post_apply.failures.some((f) => /byte-identical to the pre-apply oracle/.test(f)));
}

// ---------------------------------------------------------------------------
// 6c. --apply with a green plan but env pointing at a suffix-trick host:
//     the RPC is never called (F1 blocks before mutation)
// ---------------------------------------------------------------------------
{
  const rpc = fakeRpc({ question_versions_changed: 1, answer_versions_changed: 0 });
  const res = await run(
    [...baseArgs(), ...withHash(goodBundleHash)],
    { env: { ...APPLY_ENV, PRODUCTION_SUPABASE_URL: `https://${REF}.supabase.co.evil.example` }, callSyncRpc: rpc },
  );
  assert.equal(res.exitCode, 1);
  assert.equal(rpc.calls.length, 0, "F1: service-role key never sent to a suffix-trick host");
  assert.equal(res.report.apply_blocked, true);
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
