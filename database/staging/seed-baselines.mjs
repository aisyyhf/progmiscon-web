#!/usr/bin/env node
// Progmiscon — STAGING baseline/catalog seed helper.
//
// WHAT IT DOES
//   Builds a master-content snapshot and calls ONE database function on the
//   staging project:  public.sync_master_relation_baselines_v2(jsonb, jsonb, text[])
//   That RPC (service_role only) creates/refreshes:
//     - question_misconception_baselines   (assigns source_version + source_fingerprint)
//     - answer_misconception_baselines     (assigns source_version + source_fingerprint)
//     - master_misconception_catalog
//   It writes NOTHING else. This script never touches question_reviews,
//   answer_reviews, review_audit_log, *_overrides, or *_content_overrides, and
//   never targets production.
//
// WHEN TO RUN
//   AFTER a staging Supabase project exists and staging-bootstrap.sql +
//   20260823000000_review_v3_epoch_guard.sql have been applied. Run it from an
//   operator machine / CI job — never from browser code.
//
// SAFETY
//   * Requires explicit STAGING_* environment variables; fails closed otherwise.
//   * Refuses to run if the target URL looks like the production project
//     (matches PRODUCTION_SUPABASE_URL / VITE_SUPABASE_URL when those are set).
//   * Requires --confirm <project-ref> on the CLI to equal the ref in
//     STAGING_SUPABASE_URL.
//   * Dry-run by default. Pass --apply to actually call the RPC.
//   * The service-role key is read from the environment only and is never
//     printed or written anywhere.
//
// USAGE
//   Dry run from live master sheets:
//     STAGING_SUPABASE_URL=https://<ref>.supabase.co \
//     STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
//     STAGING_SHEET_QUESTIONS_URL=... (+ the other STAGING_SHEET_* or VITE_SHEET_*) \
//     node database/staging/seed-baselines.mjs --confirm <ref> --source sheets
//
//   Apply from a local frozen master fixture directory:
//     STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
//     node database/staging/seed-baselines.mjs --confirm <ref> \
//       --source frozen --dir /path/to/frozen-master --apply
//
// FINGERPRINT DESIGN (source_fingerprint)
//   Purpose: give sync_master_relation_baselines_v2 a value that changes iff the
//   source content of a row changes, so it can bump source_version and retire
//   stale reviews. Staging does NOT need to reproduce production fingerprint
//   values — only stable, deterministic change detection.
//
//   The canonical snapshot + fingerprint implementation lives in
//   ./lib/build-baseline-snapshot.mjs and is shared verbatim with the
//   read-only impact preflight (scripts/preview-baseline-sync-impact.mjs) so a
//   preview and a real seed can never disagree about which rows change.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { argv, env, exit } from "node:process";
import {
  parseCsv,
  buildBaselineSnapshot,
} from "./lib/build-baseline-snapshot.mjs";

// ---------------------------------------------------------------------------
// arguments + environment
// ---------------------------------------------------------------------------
function getArg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const APPLY = argv.includes("--apply");
const SOURCE = getArg("--source") ?? "sheets";
const FROZEN_DIR = getArg("--dir");
const CONFIRM_REF = getArg("--confirm");

function fail(message) {
  console.error(`seed-baselines: ${message}`);
  exit(1);
}

const STAGING_URL = env.STAGING_SUPABASE_URL?.trim();
const STAGING_KEY = env.STAGING_SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!STAGING_URL) fail("STAGING_SUPABASE_URL is not set (fail closed).");
if (!STAGING_KEY) fail("STAGING_SUPABASE_SERVICE_ROLE_KEY is not set (fail closed).");
if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)\/?$/i.test(STAGING_URL)) {
  fail(`STAGING_SUPABASE_URL does not look like a Supabase project URL: ${STAGING_URL}`);
}

const stagingRef = new URL(STAGING_URL).host.split(".")[0];

if (!CONFIRM_REF) fail("pass --confirm <project-ref> matching STAGING_SUPABASE_URL.");
if (CONFIRM_REF !== stagingRef) {
  fail(`--confirm "${CONFIRM_REF}" does not match STAGING_SUPABASE_URL ref "${stagingRef}".`);
}

for (const guardName of ["PRODUCTION_SUPABASE_URL", "VITE_SUPABASE_URL"]) {
  const guardValue = env[guardName]?.trim();
  if (guardValue && new URL(guardValue).host === new URL(STAGING_URL).host) {
    fail(`refusing to run: STAGING_SUPABASE_URL host matches ${guardName}. This must be a dedicated staging project.`);
  }
}

// ---------------------------------------------------------------------------
// load master content
// ---------------------------------------------------------------------------
async function loadCsvBySource(logicalName, envNames, frozenFile) {
  if (SOURCE === "frozen") {
    if (!FROZEN_DIR) fail("--source frozen requires --dir <frozen-master-dir>.");
    return parseCsv(readFileSync(join(FROZEN_DIR, frozenFile), "utf8"));
  }
  if (SOURCE === "sheets") {
    const url = envNames.map((n) => env[n]?.trim()).find(Boolean);
    if (!url) fail(`no URL for ${logicalName}: set one of ${envNames.join(" / ")}.`);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) fail(`fetch ${logicalName} failed: HTTP ${response.status}`);
    return parseCsv(await response.text());
  }
  fail(`unknown --source "${SOURCE}" (expected "sheets" or "frozen").`);
  return [];
}

const [questions, answers, questionMisc, answerMisc, misconceptions] = await Promise.all([
  loadCsvBySource("questions", ["STAGING_SHEET_QUESTIONS_URL", "VITE_SHEET_QUESTIONS_URL"], "questions.csv"),
  loadCsvBySource("answers", ["STAGING_SHEET_ANSWERS_URL", "VITE_SHEET_ANSWERS_URL"], "answers.csv"),
  loadCsvBySource("question_misconceptions", ["STAGING_SHEET_QUESTION_MISCONCEPTIONS_URL", "VITE_SHEET_QUESTION_MISCONCEPTIONS_URL"], "question_misconceptions.csv"),
  loadCsvBySource("answer_misconceptions", ["STAGING_SHEET_ANSWER_MISCONCEPTIONS_URL", "VITE_SHEET_ANSWER_MISCONCEPTIONS_URL"], "answer_misconceptions.csv"),
  loadCsvBySource("misconceptions", ["STAGING_SHEET_MISCONCEPTIONS_URL", "VITE_SHEET_MISCONCEPTIONS_URL"], "misconceptions.csv"),
]);

// ---------------------------------------------------------------------------
// build the v2 payload (canonical logic lives in ./lib/build-baseline-snapshot.mjs
// and is shared with scripts/preview-baseline-sync-impact.mjs)
// ---------------------------------------------------------------------------
const { misconceptionIds, questionBaselines, answerBaselines } = buildBaselineSnapshot({
  questions,
  answers,
  questionMisconceptions: questionMisc,
  answerMisconceptions: answerMisc,
  misconceptions,
});

console.log(
  `built snapshot: ${questionBaselines.length} questions, ${answerBaselines.length} answers, ${misconceptionIds.length} misconceptions`,
);
console.log(`target: ${stagingRef}.supabase.co   source: ${SOURCE}   mode: ${APPLY ? "APPLY" : "dry-run"}`);

if (!APPLY) {
  console.log("dry run — no RPC call made. Re-run with --apply to sync.");
  console.log(
    JSON.stringify(
      {
        sample_question: questionBaselines[0],
        sample_answer: answerBaselines[0],
      },
      null,
      2,
    ),
  );
  exit(0);
}

// ---------------------------------------------------------------------------
// apply — the ONLY write this script performs
// ---------------------------------------------------------------------------
const { createClient } = await import("@supabase/supabase-js");
const client = createClient(STAGING_URL, STAGING_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SEED_RPC = "sync_master_relation_baselines_v2";
const { data, error } = await client.rpc(SEED_RPC, {
  input_question_baselines: questionBaselines,
  input_answer_baselines: answerBaselines,
  input_misconception_ids: misconceptionIds,
});

if (error) {
  console.error(`${SEED_RPC} failed: ${error.message}`);
  exit(1);
}

console.log(`${SEED_RPC} ok:`, JSON.stringify(data));
