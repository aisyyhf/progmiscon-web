#!/usr/bin/env node
// Progmiscon — READ-ONLY Master Data sync impact preflight.
//
// WHAT IT ANSWERS
//   Before a canonical baseline sync (sync_master_relation_baselines_v2), tell
//   me exactly:
//     * which Question / Answer IDs would have their canonical content +
//       source_fingerprint refreshed (ordinary content drift — reviews stay
//       active, source_version is NOT rotated), and which canonical field moved,
//     * which Question / Answer IDs would ROTATE a source_version (a new,
//       removed or re-parented target) — the only case that still deactivates
//       reviews (inactive_reason = 'source_updated') and drops an override,
//     * for those rotations, how many active reviews / overrides are affected.
//
// IT MAKES ZERO WRITES.
//   * It NEVER calls sync_master_relation_baselines / _v2, and never calls any
//     save_/delete_/recompute_/publish_ RPC.
//   * It NEVER issues an HTTP verb other than GET.
//   * It NEVER modifies the Master Data CSV inputs.
//   * With --from-staging it refuses to connect to any project ref other than
//     the shared staging project. There is no --production flag.
//   * The default (offline) mode makes no network connection at all.
//
// INPUTS
//   --proposed <dir>   REQUIRED. Directory holding the candidate Master Data
//                      export: questions.csv, answers.csv,
//                      question_misconceptions.csv, answer_misconceptions.csv,
//                      misconceptions.csv
//   --current <dir>    OPTIONAL. Same five files for Master Data as it stands
//                      right now (a frozen export taken BEFORE editing). Used to
//                      name which canonical field moved. Without it, the tool
//                      still decides content_changed / version_rotates but the
//                      field list is coarser.
//   --baseline <file>  OPTIONAL. JSON snapshot of the live *_misconception_
//                      baselines rows + active review counts + override
//                      presence. Shape:
//                        { "questions": [ { "question_id", "source_version",
//                            "source_fingerprint", "misconception_ids": [],
//                            "active_review_count", "override_exists" } ],
//                          "answers":   [ { "answer_id", "question_id",
//                            "source_version", "source_fingerprint",
//                            "misconception_ids": [], "active_review_count",
//                            "override_exists" } ] }
//   --from-staging     OPTIONAL. Instead of --baseline, GET the same data from
//                      the shared staging project. Needs STAGING_SUPABASE_URL
//                      and STAGING_SUPABASE_SERVICE_ROLE_KEY (GET use only).
//   --json             OPTIONAL. Print machine-readable JSON after the report.
//
//   Provide at least one previous-state source: --baseline, --from-staging, or
//   --current. --baseline / --from-staging give exact review counts and match
//   the v2 bump decision precisely; --current alone gives a structural preview
//   with review impact reported as "unknown".
//
// EXAMPLES
//   node scripts/preview-baseline-sync-impact.mjs \
//     --current ./frozen-master --proposed ./candidate-master \
//     --baseline ./staging-baseline.json
//
//   STAGING_SUPABASE_URL=https://ineefknatilxkqatbbrm.supabase.co \
//   STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
//   node scripts/preview-baseline-sync-impact.mjs \
//     --current ./frozen-master --proposed ./candidate-master --from-staging

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { argv, env, exit } from "node:process";
import {
  parseCsv,
  buildBaselineSnapshot,
} from "../database/staging/lib/build-baseline-snapshot.mjs";
import { computeBaselineSyncImpact } from "./lib/baseline-sync-impact.mjs";
import { assertStagingRef, fetchBaselineStateFromStaging } from "./lib/staging-remote.mjs";

const CSV_FILES = {
  questions: "questions.csv",
  answers: "answers.csv",
  questionMisconceptions: "question_misconceptions.csv",
  answerMisconceptions: "answer_misconceptions.csv",
  misconceptions: "misconceptions.csv",
};

function getArg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
function fail(message) {
  console.error(`preview-baseline-sync-impact: ${message}`);
  exit(1);
}

function loadSnapshotDir(dir) {
  const table = (file) => {
    try {
      return parseCsv(readFileSync(join(dir, file), "utf8"));
    } catch (caught) {
      fail(`cannot read ${join(dir, file)}: ${caught.message}`);
      return [];
    }
  };
  return buildBaselineSnapshot({
    questions: table(CSV_FILES.questions),
    answers: table(CSV_FILES.answers),
    questionMisconceptions: table(CSV_FILES.questionMisconceptions),
    answerMisconceptions: table(CSV_FILES.answerMisconceptions),
    misconceptions: table(CSV_FILES.misconceptions),
  });
}

function loadBaselineFile(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch (caught) {
    fail(`cannot read baseline JSON ${file}: ${caught.message}`);
  }
  if (!parsed || !Array.isArray(parsed.questions) || !Array.isArray(parsed.answers)) {
    fail(`baseline JSON ${file} must have "questions" and "answers" arrays.`);
  }
  return parsed;
}

function fmt(value) {
  if (value === null || value === undefined) return "unknown";
  return String(value);
}

function renderReport(impact, { previousStateLabel }) {
  const lines = [];
  const q = impact.questions.filter((r) => r.status !== "UNCHANGED");
  const a = impact.answers.filter((r) => r.status !== "UNCHANGED");

  const effect = (row) =>
    row.version_rotates
      ? "ROTATES source_version + deactivates reviews (new / removed / re-parented)"
      : "content drift only — source_version stable, reviews stay active";

  lines.push("=== QUESTION SYNC IMPACT ===");
  if (q.length === 0) {
    lines.push("  (no question would change)");
  } else {
    for (const row of q) {
      lines.push("");
      lines.push(`  ${row.id}`);
      lines.push(`    status: ${row.status}`);
      lines.push("    changed fields:");
      for (const field of row.changed_fields) lines.push(`      - ${field}`);
      lines.push(`    current source_version: ${fmt(row.current_source_version)}`);
      lines.push(`    effect: ${effect(row)}`);
      lines.push(`    would rotate source_version: ${row.version_rotates ? "YES" : "NO"}`);
      lines.push(`    active Question Reviews affected: ${row.version_rotates ? fmt(row.active_reviews_affected) : "0"}`);
      lines.push(`    override would be invalidated: ${row.override_invalidated ? "YES" : "NO"}`);
    }
  }

  lines.push("");
  lines.push("=== ANSWER SYNC IMPACT (legacy Answer Review data) ===");
  if (a.length === 0) {
    lines.push("  (no answer would change)");
  } else {
    for (const row of a) {
      lines.push("");
      lines.push(`  ${row.id}  (parent ${fmt(row.parent_question_id)})`);
      lines.push(`    status: ${row.status}`);
      lines.push("    changed fields:");
      for (const field of row.changed_fields) lines.push(`      - ${field}`);
      lines.push(`    current source_version: ${fmt(row.current_source_version)}`);
      lines.push(`    effect: ${effect(row)}`);
      lines.push(`    would rotate source_version: ${row.version_rotates ? "YES" : "NO"}`);
      lines.push(`    active Answer Reviews affected: ${row.version_rotates ? fmt(row.active_reviews_affected) : "0"}`);
      lines.push(`    override would be invalidated: ${row.override_invalidated ? "YES" : "NO"}`);
    }
  }

  const s = impact.summary;
  lines.push("");
  lines.push("=== SUMMARY ===");
  lines.push(`  previous state: ${previousStateLabel}`);
  lines.push(`  question content changes: ${s.question_content_changes}   version rotations: ${s.question_version_rotations}`);
  lines.push(
    `  active Question Reviews that would become source_updated: ${
      s.review_counts_known ? s.active_question_reviews_affected : "unknown (no baseline state)"
    }  (ordinary content edits: 0)`,
  );
  lines.push(`  question overrides invalidated: ${s.review_counts_known ? s.question_overrides_invalidated : "unknown"}`);
  lines.push(`  answer content changes: ${s.answer_content_changes}   version rotations: ${s.answer_version_rotations}`);
  lines.push(
    `  active Answer Reviews that would become source_updated: ${
      s.review_counts_known ? s.active_answer_reviews_affected : "unknown (no baseline state)"
    }  (ordinary content edits: 0)`,
  );
  for (const warning of s.drift_warnings) lines.push(`  ! drift: ${warning}`);

  if (q.length === 0 && a.length === 0) {
    lines.push("");
    lines.push("SAFE: proposed snapshot matches current baseline version inputs.");
    lines.push("No reviews would become stale.");
  } else if (s.question_version_rotations === 0 && s.answer_version_rotations === 0) {
    lines.push("");
    lines.push("Content drift only: no source_version would rotate, no review would become stale.");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
const proposedDir = getArg("--proposed");
const currentDir = getArg("--current");
const baselineFile = getArg("--baseline");
const fromStaging = argv.includes("--from-staging");
const emitJson = argv.includes("--json");

if (argv.includes("--production") || argv.includes("--prod")) {
  fail("there is no production mode. This preflight only reads local fixtures or the shared staging project.");
}
if (!proposedDir) fail("--proposed <dir> is required.");
if (baselineFile && fromStaging) fail("pass either --baseline <file> or --from-staging, not both.");
if (!baselineFile && !fromStaging && !currentDir) {
  fail("provide a previous state: --baseline <file>, --from-staging, or (structural only) --current <dir>.");
}

const proposed = loadSnapshotDir(proposedDir);
const current = currentDir ? loadSnapshotDir(currentDir) : null;

let baselineState = null;
let previousStateLabel = "frozen --current snapshot (structural preview; review counts unknown)";

if (baselineFile) {
  baselineState = loadBaselineFile(baselineFile);
  previousStateLabel = `--baseline file ${baselineFile}`;
} else if (fromStaging) {
  const stagingUrl = env.STAGING_SUPABASE_URL?.trim();
  if (!stagingUrl) fail("--from-staging needs STAGING_SUPABASE_URL.");
  try {
    assertStagingRef(stagingUrl);
  } catch (caught) {
    fail(caught.message);
  }
  try {
    baselineState = await fetchBaselineStateFromStaging({
      url: stagingUrl,
      key: env.STAGING_SUPABASE_SERVICE_ROLE_KEY?.trim(),
    });
  } catch (caught) {
    fail(`staging read failed: ${caught.message}`);
  }
  previousStateLabel = "shared staging project (read-only GET)";
}

const impact = computeBaselineSyncImpact({ proposed, current, baselineState });

console.log(renderReport(impact, { previousStateLabel }));

if (emitJson) {
  console.log("");
  console.log(JSON.stringify(impact, null, 2));
}

exit(0);
