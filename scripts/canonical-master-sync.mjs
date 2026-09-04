#!/usr/bin/env node
// Canonical Master Data sync to Production — with fail-closed gates for a strict
// expected-QID content-change allowlist.
//
// MUTATION: this tool's ONLY database write is a single call to
//   public.sync_master_relation_baselines_v2(jsonb, jsonb, text[])
// It never names or invokes the retired legacy v1 baseline mutation, and never
// issues any other RPC, insert, update, or delete. A static test
// (checks/canonical-master-sync.mjs) asserts the v1 name is unreferenced.
//
// Since 20260904000000_canonical_sync_keep_reviews_active.sql, ordinary content
// / misconception drift for an existing target refreshes the baseline content +
// source_fingerprint but does NOT rotate source_version and does NOT deactivate
// any lecturer review or delete any review-consensus override. The allowlist
// here therefore gates CONTENT CHANGES: the operator still declares exactly
// which questions they are editing, and the plan fails closed on drift outside
// that set. It also blocks ANY source_version rotation (a new / removed / re-
// parented target), because a canonical content edit must never rotate one.
//
// DEFAULT MODE is a read-only plan/preview. --apply is required to mutate, and
// --apply additionally requires ALL of:
//   * plan.planIsApplyable  (clean parity, 0 NULL baseline rows, exact question
//     content-change allowlist match, question change count <= max, 0 answer
//     changes / exact answer allowlist match, answer change count <= max, zero
//     source_version rotations, snapshot complete)
//   * --apply-bundle-hash equal to the SHA-256 the immediately-preceding plan
//     run printed for the frozen input bundle (current + proposed + oracle)
//   * --post-oracle <path>  (a fresh baseline export is polled for AFTER the
//     RPC and verified per-target: the approved fingerprints moved, NO
//     source_version rotated; RPC counts alone are never accepted)
//   * PRODUCTION_SUPABASE_URL that STRICTLY validates as https://<ref>.supabase.co
//     with no userinfo / port / path / query / fragment, and whose ref equals
//     --expect-ref (the service-role key is used only after this passes)
//   * PRODUCTION_SUPABASE_SERVICE_ROLE_KEY set
//   * CANONICAL_MASTER_SYNC_ENABLED === "true"
//
// INPUTS ARE FROZEN LOCAL FILES ONLY. This tool does not fetch the Google
// Sheet. Freeze the 5 CSVs (current + proposed) and export the Production
// baseline oracle before running it.
//
// USAGE
//   node scripts/canonical-master-sync.mjs \
//     --current  ./frozen/current \
//     --proposed ./frozen/proposed \
//     --oracle   ./frozen/production-baseline-state.json \
//     --allow    Q225,Q226,Q259 \
//     --max-question-changes 3 \
//     --expect-ref <production-project-ref> \
//     [--answer-allow ...] [--max-answer-changes 0] [--json]
//
//   node scripts/canonical-master-sync.mjs ...same... \
//     --apply --apply-bundle-hash <sha256-from-the-plan-run> \
//     --post-oracle ./frozen/production-baseline-state.after.json

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { argv as processArgv, env as processEnv, exit } from "node:process";
import { parseCsv, buildBaselineSnapshot } from "../database/staging/lib/build-baseline-snapshot.mjs";
import { buildCanonicalSyncPlan, validatePostApply } from "./lib/canonical-sync-plan.mjs";

export const SYNC_RPC = "sync_master_relation_baselines_v2";

const CSV_FILES = [
  "misconceptions.csv",
  "questions.csv",
  "answers.csv",
  "question_misconceptions.csv",
  "answer_misconceptions.csv",
];

// ---------------------------------------------------------------------------
// pure helpers
// ---------------------------------------------------------------------------
export function parseArgs(args) {
  const flags = new Set(["--apply", "--json"]);
  const out = { _: [], apply: false, json: false };
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      out._.push(token);
      continue;
    }
    if (flags.has(token)) {
      out[token.slice(2)] = true;
      continue;
    }
    const value = args[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`missing value for ${token}`);
    }
    out[token.slice(2).replace(/-/g, "_")] = value;
    i += 1;
  }
  return out;
}

export function parseIdList(value) {
  return String(value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Strict, fail-closed validation of the Production project URL. The project ref
// is extracted ONLY after the ENTIRE URL has passed every check, so a
// misconfigured or hostile PRODUCTION_SUPABASE_URL can never reach the
// service-role client.
//
//   * scheme MUST be https:
//   * no userinfo (username / password)
//   * no port (no sanctioned path needs one)
//   * no path / query / fragment
//   * host MUST be EXACTLY  <ref>.supabase.co
//     (ref = 16+ lowercase alphanumerics; suffix tricks like
//      "<ref>.supabase.co.evil.example" or "<ref>.attacker.net" are rejected
//      because the anchored regex requires ".supabase.co" to end the host)
//
// The staging seeder (database/staging/seed-baselines.mjs) also tolerates
// *.supabase.{in,net}; the Production MUTATION path here is deliberately
// narrower — no repo evidence shows Production on anything but *.supabase.co.
const PRODUCTION_HOST = /^([a-z0-9]{16,})\.supabase\.co$/;

export function projectRef(url) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch {
    throw new Error(`PRODUCTION_SUPABASE_URL is not a valid URL: ${String(url)}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`PRODUCTION_SUPABASE_URL must use https: (got ${parsed.protocol || "no scheme"})`);
  }
  if (parsed.username || parsed.password) {
    throw new Error("PRODUCTION_SUPABASE_URL must not contain a username or password");
  }
  if (parsed.port) {
    throw new Error(`PRODUCTION_SUPABASE_URL must not specify a port (got :${parsed.port})`);
  }
  if (parsed.pathname !== "/" || parsed.search || parsed.hash) {
    throw new Error("PRODUCTION_SUPABASE_URL must have no path, query string, or fragment");
  }
  const match = PRODUCTION_HOST.exec(parsed.hostname);
  if (!match) {
    throw new Error(
      `PRODUCTION_SUPABASE_URL host must be exactly <project-ref>.supabase.co (got "${parsed.hostname}")`,
    );
  }
  return match[1];
}

// Bundle hash: SHA-256 over a length-prefixed, label-ordered concatenation of
// EVERY frozen input — current/*.csv, proposed/*.csv, and the oracle file.
// Changing any byte of any input changes the hash.
export function computeBundleHash({ currentFiles, proposedFiles, oracleBytes }) {
  const hash = createHash("sha256");
  const put = (label, bytes) => {
    hash.update(`${label}:${bytes.length}\n`);
    hash.update(bytes);
    hash.update("\n");
  };
  for (const name of CSV_FILES) put(`current/${name}`, currentFiles[name]);
  for (const name of CSV_FILES) put(`proposed/${name}`, proposedFiles[name]);
  put("oracle", oracleBytes);
  return `sha256:${hash.digest("hex")}`;
}

function loadSnapshotDir(readFile, dir) {
  const files = {};
  for (const name of CSV_FILES) files[name] = readFile(join(dir, name));
  const table = (name) => parseCsv(new TextDecoder("utf-8", { fatal: true }).decode(files[name]));
  const snapshot = buildBaselineSnapshot({
    misconceptions: table("misconceptions.csv"),
    questions: table("questions.csv"),
    answers: table("answers.csv"),
    questionMisconceptions: table("question_misconceptions.csv"),
    answerMisconceptions: table("answer_misconceptions.csv"),
  });
  return { files, snapshot };
}

// ---------------------------------------------------------------------------
// default real dependency: the ONE mutation call
// ---------------------------------------------------------------------------
async function defaultCallSyncRpc({ url, serviceRoleKey, payload }) {
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc(SYNC_RPC, payload);
  if (error) throw new Error(`${SYNC_RPC} failed: ${error.message ?? "unknown error"}`);
  return Array.isArray(data) ? data[0] : data;
}

// ---------------------------------------------------------------------------
// core (testable) — returns { exitCode, report }
// ---------------------------------------------------------------------------
export async function runCanonicalMasterSync({
  argv = [],
  env = {},
  deps = {},
} = {}) {
  const readFile = deps.readFile ?? ((p) => readFileSync(p));
  const callSyncRpc = deps.callSyncRpc ?? defaultCallSyncRpc;
  const log = deps.log ?? ((line) => console.log(line));
  const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  const pollIntervalMs = Number(deps.postOraclePollMs ?? 3000);
  const pollMaxAttempts = Number(deps.postOraclePollMax ?? 40);

  const args = parseArgs(argv);
  for (const required of ["current", "proposed", "oracle", "expect_ref"]) {
    if (!args[required]) return fail(`--${required.replace(/_/g, "-")} is required`);
  }

  const { files: currentFiles, snapshot: current } = loadSnapshotDir(readFile, args.current);
  const { files: proposedFiles, snapshot: proposed } = loadSnapshotDir(readFile, args.proposed);
  const oracleBytes = readFile(args.oracle);
  let oracle;
  try {
    oracle = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(oracleBytes));
  } catch (caught) {
    return fail(`cannot parse oracle JSON ${args.oracle}: ${caught.message}`);
  }

  const bundleHash = computeBundleHash({ currentFiles, proposedFiles, oracleBytes });

  const questionAllowlist = parseIdList(args.allow);
  const answerAllowlist = parseIdList(args.answer_allow);
  // --max-question-changes is the current name; --max-question-bumps is kept as
  // a backward-compatible alias.
  const rawMaxQuestion = args.max_question_changes ?? args.max_question_bumps;
  const rawMaxAnswer = args.max_answer_changes ?? args.max_answer_bumps;
  const maxQuestionContentChanges = rawMaxQuestion !== undefined
    ? Number(rawMaxQuestion)
    : questionAllowlist.length;
  const maxAnswerContentChanges = rawMaxAnswer !== undefined
    ? Number(rawMaxAnswer)
    : answerAllowlist.length;

  let plan;
  try {
    plan = buildCanonicalSyncPlan({
      proposed,
      current,
      oracle,
      options: {
        questionAllowlist,
        answerAllowlist,
        maxQuestionContentChanges,
        maxAnswerContentChanges,
      },
    });
  } catch (caught) {
    return fail(`plan build failed: ${caught.message}`);
  }

  const report = {
    mode: args.apply ? "apply" : "plan",
    bundle_hash: bundleHash,
    expect_ref: args.expect_ref,
    options: plan.options,
    predicted: {
      question_content_changes: plan.expectedQuestionContentChangeIds,
      unexpected_question_content_changes: plan.unexpectedQuestionContentChangeIds,
      missing_expected_question_content_changes: plan.missingExpectedQuestionContentChangeIds,
      answer_content_changes: plan.expectedAnswerContentChangeIds,
      unexpected_answer_content_changes: plan.unexpectedAnswerContentChangeIds,
      missing_expected_answer_content_changes: plan.missingExpectedAnswerContentChangeIds,
      question_version_rotations: plan.questionVersionRotationIds,
      answer_version_rotations: plan.answerVersionRotationIds,
      null_baseline_rows: plan.nullBaselineRows,
      parity_failures: plan.parityFailures,
      completeness_violations: plan.completenessViolations,
      counts: plan.counts,
    },
    gates: plan.gates,
    blocking_reasons: plan.blockingReasons,
    plan_is_applyable: plan.planIsApplyable,
  };

  const emit = () => {
    if (args.json) {
      log(JSON.stringify(report, null, 2));
    } else {
      renderHuman(log, report);
    }
  };

  // -------------------------------------------------------------- plan mode
  if (!args.apply) {
    emit();
    log("");
    log(plan.planIsApplyable
      ? `PLAN OK — applyable. To apply, re-run with:\n  --apply --apply-bundle-hash ${bundleHash}`
      : `PLAN BLOCKED — not applyable. Reasons:\n${plan.blockingReasons.map((r) => `  - ${r}`).join("\n")}`);
    return { exitCode: plan.planIsApplyable ? 0 : 1, report };
  }

  // -------------------------------------------------------------- apply mode
  const applyBlockers = [];
  if (!plan.planIsApplyable) applyBlockers.push("plan is not applyable");
  if (!args.apply_bundle_hash) applyBlockers.push("--apply-bundle-hash is required for --apply");
  else if (args.apply_bundle_hash !== bundleHash) {
    applyBlockers.push(
      `--apply-bundle-hash mismatch: frozen inputs changed since the plan run (got ${args.apply_bundle_hash}, computed ${bundleHash})`,
    );
  }
  // F2: a fresh post-apply oracle export is mandatory for per-target verification
  if (!args.post_oracle) {
    applyBlockers.push("--post-oracle <path> is required for --apply (per-target verification, not RPC counts alone)");
  }
  if ((env.CANONICAL_MASTER_SYNC_ENABLED ?? "").trim().toLowerCase() !== "true") {
    applyBlockers.push("CANONICAL_MASTER_SYNC_ENABLED must be exactly 'true'");
  }
  // F1: strict, fail-closed validation of the Production URL. The ref is
  // extracted only after the ENTIRE URL passes; the service-role key is read
  // and used only past the applyBlockers gate below.
  const url = (env.PRODUCTION_SUPABASE_URL ?? "").trim();
  let validatedRef = null;
  if (!url) applyBlockers.push("PRODUCTION_SUPABASE_URL is not set");
  else {
    try {
      validatedRef = projectRef(url);
      if (validatedRef !== args.expect_ref) {
        applyBlockers.push(`PRODUCTION_SUPABASE_URL ref "${validatedRef}" != --expect-ref "${args.expect_ref}"`);
        validatedRef = null;
      }
    } catch (caught) {
      applyBlockers.push(caught.message);
    }
  }
  const serviceRoleKey = (env.PRODUCTION_SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  if (!serviceRoleKey) applyBlockers.push("PRODUCTION_SUPABASE_SERVICE_ROLE_KEY is not set");

  if (applyBlockers.length > 0) {
    report.apply_blocked = true;
    report.apply_blockers = applyBlockers;
    emit();
    log("");
    log(`APPLY REFUSED (before any mutation):\n${applyBlockers.map((r) => `  - ${r}`).join("\n")}`);
    return { exitCode: 1, report };
  }

  // F1 defense-in-depth: re-validate the URL immediately before the key is used,
  // so no refactor of the gate above can ever send it to an unvalidated host.
  if (projectRef(url) !== args.expect_ref) {
    report.apply_error = "PRODUCTION_SUPABASE_URL failed re-validation before mutation";
    emit();
    return { exitCode: 1, report };
  }

  emit();
  log("");
  log(`Applying: one ${SYNC_RPC} call to ${args.expect_ref} …`);

  let rpcResult;
  try {
    rpcResult = await callSyncRpc({
      url,
      serviceRoleKey,
      payload: {
        input_question_baselines: proposed.questionBaselines,
        input_answer_baselines: proposed.answerBaselines,
        input_misconception_ids: proposed.misconceptionIds,
      },
    });
  } catch (caught) {
    report.apply_error = caught.message;
    emit();
    return { exitCode: 1, report };
  }

  // F2: block on a FRESH post-apply oracle. It must exist, parse, and differ
  // from the pre-apply oracle (proving it reflects the mutation just made).
  log("");
  log(`MUTATION APPLIED. Export a fresh Production baseline oracle now to:\n  ${args.post_oracle}`);
  let postOracle = null;
  let postOracleError = `no fresh --post-oracle appeared at ${args.post_oracle} within ${Math.round((pollIntervalMs * pollMaxAttempts) / 1000)}s`;
  for (let attempt = 1; attempt <= pollMaxAttempts; attempt += 1) {
    let bytes = null;
    try {
      bytes = readFile(args.post_oracle);
    } catch {
      bytes = null;
    }
    if (bytes) {
      const identicalToPre = Buffer.isBuffer(bytes) && Buffer.isBuffer(oracleBytes)
        ? bytes.equals(oracleBytes)
        : String(bytes) === String(oracleBytes);
      if (identicalToPre) {
        postOracleError = `--post-oracle at ${args.post_oracle} is byte-identical to the pre-apply oracle — export a fresh one`;
      } else {
        try {
          postOracle = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
          break;
        } catch (caught) {
          postOracleError = `--post-oracle at ${args.post_oracle} is present but not valid JSON: ${caught.message}`;
        }
      }
    }
    if (attempt < pollMaxAttempts) await sleep(pollIntervalMs);
  }

  report.rpc_result = {
    question_count: rpcResult?.question_count ?? null,
    answer_count: rpcResult?.answer_count ?? null,
    misconception_count: rpcResult?.misconception_count ?? null,
    question_versions_changed: rpcResult?.question_versions_changed ?? null,
    answer_versions_changed: rpcResult?.answer_versions_changed ?? null,
    synced_at: rpcResult?.synced_at ?? null,
  };

  if (!postOracle) {
    report.post_apply = { ok: false, failures: [postOracleError] };
    emit();
    log("");
    log(`APPLY VERIFICATION FAILED / ALERT — the mutation ran but could not be verified:\n  - ${postOracleError}`);
    return { exitCode: 1, report };
  }

  const postApply = validatePostApply({ plan, rpcResult, preOracle: oracle, postOracle });
  report.post_apply = postApply;
  emit();
  log("");
  if (postApply.ok) {
    const fpChanges = (postApply.observedQuestionContentChanges ?? [])
      .map((c) => `${c.id} ${c.old} -> ${c.new}`)
      .join(", ") || "none";
    log(`APPLY VERIFIED — ${(postApply.observedQuestionContentChanges ?? []).length} question and ${(postApply.observedAnswerContentChanges ?? []).length} answer source_fingerprint(s) refreshed [${fpChanges}], all within the approved allowlist; NO source_version rotated; reviews untouched; RPC counts match.`);
  } else {
    log(`APPLY VERIFICATION FAILED / ALERT:\n${postApply.failures.map((f) => `  - ${f}`).join("\n")}`);
  }
  return { exitCode: postApply.ok ? 0 : 1, report };

  function fail(message) {
    log(`canonical-master-sync: ${message}`);
    return { exitCode: 2, report: { mode: "error", error: message } };
  }
}

function renderHuman(log, report) {
  const p = report.predicted;
  log(`mode: ${report.mode}   bundle: ${report.bundle_hash}`);
  log(`allowlist (question): ${report.options.questionAllowlist.join(", ") || "(none)"}   max changes: ${report.options.maxQuestionContentChanges}`);
  log(`allowlist (answer):   ${report.options.answerAllowlist.join(", ") || "(none)"}   max changes: ${report.options.maxAnswerContentChanges}`);
  log("");
  log(`predicted question content changes : ${p.question_content_changes.join(", ") || "(none)"}`);
  log(`unexpected question content changes: ${p.unexpected_question_content_changes.join(", ") || "(none)"}`);
  log(`allowlisted questions with NO change: ${p.missing_expected_question_content_changes.join(", ") || "(none)"}`);
  log(`predicted answer content changes   : ${p.answer_content_changes.join(", ") || "(none)"}`);
  log(`unexpected answer content changes  : ${p.unexpected_answer_content_changes.join(", ") || "(none)"}`);
  log(`source_version ROTATIONS (blocker) : ${[...p.question_version_rotations, ...p.answer_version_rotations].join(", ") || "(none)"}`);
  log(`NULL baseline rows        : ${p.null_baseline_rows.length}`);
  log(`parity failures           : ${p.parity_failures.length}`);
  log(`completeness violations   : ${p.completeness_violations.length}`);
  log(`predicted active question reviews invalidated: ${p.counts.predicted_active_question_reviews_invalidated ?? "unknown"} (content edits invalidate 0)`);
  log(`predicted question overrides invalidated     : ${p.counts.predicted_question_overrides_invalidated ?? "unknown"}`);
  log("");
  log("gates:");
  for (const [name, pass] of Object.entries(report.gates)) log(`  ${pass ? "PASS" : "FAIL"}  ${name}`);
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------
const invokedDirectly = processArgv[1] &&
  resolve(processArgv[1]) === resolve(fileURLToPath(import.meta.url));
if (invokedDirectly) {
  runCanonicalMasterSync({ argv: processArgv.slice(2), env: processEnv })
    .then(({ exitCode }) => exit(exitCode))
    .catch((caught) => {
      console.error(`canonical-master-sync: ${caught?.message ?? caught}`);
      exit(2);
    });
}
