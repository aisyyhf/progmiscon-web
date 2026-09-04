// Focused tests for the read-only Master Data sync impact preflight.
//
// Since 20260904000000_canonical_sync_keep_reviews_active.sql, ordinary content
// / misconception drift for an existing target (parent unchanged) refreshes the
// baseline content + source_fingerprint but does NOT rotate source_version and
// does NOT deactivate a review or delete an override. The engine marks these
// rows content_changed = true, version_rotates = false. source_version rotation
// (and the review deactivation that comes with it) is left ONLY for a NEW,
// REMOVED or REPARENTED target.
//
// Covers:
//   1  identical snapshot                -> no change
//   2  question_ind changes              -> content drift, no rotation
//   3  question_en changes               -> content drift, no rotation
//   4  question_code changes             -> content drift, no rotation
//   5  direct question misconception ids -> content drift, no rotation
//   6  content_blocks_ind changes        -> NOT a v2 fingerprint input, no change
//   7  answer_text changes               -> answer content drift, not question
//   8  answer misconception relation     -> answer content drift, not question
//   9  question removed                  -> version rotation + review deactivation
//   10 answer parent changes             -> answer version rotation (re-parent)
//   11 CRLF / NFC / whitespace           -> no false change
//   12 content-change / rotation math
//   13 staging-ref guard refuses non-staging refs
//   14 the preflight contains no write/mutation path

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildBaselineSnapshot } from "../database/staging/lib/build-baseline-snapshot.mjs";
import { computeBaselineSyncImpact } from "../scripts/lib/baseline-sync-impact.mjs";
import { assertStagingRef, parseSupabaseRef, STAGING_REF } from "../scripts/lib/staging-remote.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------
// fixture helpers
// ---------------------------------------------------------------------------
const BASE = {
  misconceptions: [{ misconception_id: "IO-01" }, { misconception_id: "IO-02" }, { misconception_id: "CO-01" }],
  questions: [
    {
      question_id: "Q001",
      active: "true",
      question_ind: "Cetak bilangan n.",
      question_en: "Print café n.".normalize("NFC"),
      question_code: "READ n\nWRITE n",
      content_blocks_ind: '[{"type":"text","content":"Cetak bilangan n."}]',
    },
    {
      question_id: "Q002",
      active: "true",
      question_ind: "Hitung faktorial.",
      question_en: "Compute factorial.",
      question_code: "READ n\nfact <- 1",
      content_blocks_ind: "",
    },
  ],
  answers: [
    { answer_id: "A001-A", question_id: "Q001", active: "true", answer_text: "8" },
    { answer_id: "A001-B", question_id: "Q001", active: "true", answer_text: "9" },
    { answer_id: "A002-A", question_id: "Q002", active: "true", answer_text: "120" },
  ],
  questionMisc: [
    { question_id: "Q001", misconception_id: "IO-01", active: "true" },
    { question_id: "Q002", misconception_id: "CO-01", active: "true" },
  ],
  answerMisc: [{ answer_id: "A001-B", misconception_id: "IO-02", active: "true" }],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toSnapshot(fixture) {
  return buildBaselineSnapshot({
    questions: fixture.questions,
    answers: fixture.answers,
    questionMisconceptions: fixture.questionMisc,
    answerMisconceptions: fixture.answerMisc,
    misconceptions: fixture.misconceptions,
  });
}

// derive an authoritative "live baseline" state from a snapshot so that an
// unedited target is UNCHANGED and edits show up.
function baselineFromSnapshot(snapshot, { questionReviewCounts = {}, answerReviewCounts = {}, questionOverrides = [], answerOverrides = [] } = {}) {
  const qOverride = new Set(questionOverrides);
  const aOverride = new Set(answerOverrides);
  return {
    questions: snapshot.questionBaselines.map((q) => ({
      question_id: q.question_id,
      source_version: `qv-${q.question_id}`,
      source_fingerprint: q.source_fingerprint,
      misconception_ids: q.misconception_ids,
      active_review_count: questionReviewCounts[q.question_id] ?? 0,
      override_exists: qOverride.has(q.question_id),
    })),
    answers: snapshot.answerBaselines.map((a) => ({
      answer_id: a.answer_id,
      question_id: a.question_id,
      source_version: `av-${a.answer_id}`,
      source_fingerprint: a.source_fingerprint,
      misconception_ids: a.misconception_ids,
      active_review_count: answerReviewCounts[a.answer_id] ?? 0,
      override_exists: aOverride.has(a.answer_id),
    })),
  };
}

const currentSnapshot = toSnapshot(BASE);
const baselineState = baselineFromSnapshot(currentSnapshot, {
  questionReviewCounts: { Q001: 2, Q002: 1 },
  answerReviewCounts: { "A001-B": 3 },
  questionOverrides: ["Q001"],
  answerOverrides: ["A001-B"],
});

function impactFor(mutate) {
  const proposedFixture = clone(BASE);
  mutate(proposedFixture);
  return computeBaselineSyncImpact({
    proposed: toSnapshot(proposedFixture),
    current: currentSnapshot,
    baselineState,
  });
}

function questionRow(impact, id) {
  return impact.questions.find((row) => row.id === id);
}
function answerRow(impact, id) {
  return impact.answers.find((row) => row.id === id);
}

// ---------------------------------------------------------------------------
// 1. identical snapshot -> no change
// ---------------------------------------------------------------------------
{
  const impact = impactFor(() => {});
  assert.equal(impact.summary.questions_changed, 0, "identical snapshot: no question changes");
  assert.equal(impact.summary.answers_changed, 0, "identical snapshot: no answer changes");
  assert.equal(impact.summary.question_content_changes, 0);
  assert.equal(impact.summary.question_version_rotations, 0);
  assert.deepEqual(impact.summary.drift_warnings, []);
  assert.ok(
    impact.questions.every(
      (r) => r.status === "UNCHANGED" && r.content_changed === false && r.version_rotates === false,
    ),
  );
}

// ---------------------------------------------------------------------------
// 2-4. canonical text fields -> content drift, NOT a version rotation
// ---------------------------------------------------------------------------
for (const [field, column] of [
  ["question_ind", "question_ind"],
  ["question_en", "question_en"],
  ["question_code", "question_code"],
]) {
  const impact = impactFor((fx) => {
    fx.questions[0][column] = `${fx.questions[0][column]} (revised)`;
  });
  const row = questionRow(impact, "Q001");
  assert.equal(row.status, "CHANGED", `${field}: Q001 status CHANGED`);
  assert.equal(row.content_changed, true, `${field} change is content drift for Q001`);
  assert.equal(row.version_rotates, false, `${field} change does NOT rotate Q001 source_version`);
  assert.equal(row.would_bump, false);
  assert.deepEqual(row.changed_fields, [field], `${field} is named as the only changed field`);
  assert.equal(row.active_reviews_affected, 0, `${field}: no review is deactivated (2 stay active)`);
  assert.equal(row.override_invalidated, false, `${field}: Q001 override is NOT invalidated`);
  assert.equal(questionRow(impact, "Q002").content_changed, false, `${field}: Q002 untouched`);
  assert.equal(impact.summary.answers_changed, 0, `${field}: no answer change`);
  assert.equal(impact.summary.active_question_reviews_affected, 0, `${field}: 0 reviews affected`);
}

// ---------------------------------------------------------------------------
// 5. direct question misconception ids -> content drift, no rotation
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.questionMisc.push({ question_id: "Q001", misconception_id: "IO-02", active: "true" });
  });
  const row = questionRow(impact, "Q001");
  assert.equal(row.content_changed, true, "adding a direct question misconception is content drift for Q001");
  assert.equal(row.version_rotates, false);
  assert.deepEqual(row.changed_fields, ["misconception_ids"]);
  assert.equal(impact.summary.answers_changed, 0);
}

// ---------------------------------------------------------------------------
// 6. content_blocks_ind is NOT a v2 fingerprint input
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.questions[0].content_blocks_ind = '[{"type":"code","content":"READ n"},{"type":"code","content":"WRITE n"}]';
  });
  assert.equal(impact.summary.questions_changed, 0, "content_blocks_ind edit does not change the v2 fingerprint");
  assert.equal(impact.summary.answers_changed, 0);
}

// ---------------------------------------------------------------------------
// 7. answer_text -> answer content drift, not question
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.answers[1].answer_text = "nine";
  });
  assert.equal(impact.summary.questions_changed, 0, "answer_text edit does not touch the parent question");
  const row = answerRow(impact, "A001-B");
  assert.equal(row.status, "CHANGED");
  assert.equal(row.content_changed, true);
  assert.equal(row.version_rotates, false);
  assert.deepEqual(row.changed_fields, ["answer_text"]);
  assert.equal(row.active_reviews_affected, 0, "the 3 Answer Reviews stay active");
  assert.equal(row.override_invalidated, false);
  assert.equal(row.parent_question_id, "Q001");
}

// ---------------------------------------------------------------------------
// 8. answer misconception relation -> answer content drift, not question
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.answerMisc.push({ answer_id: "A001-A", misconception_id: "IO-01", active: "true" });
  });
  assert.equal(impact.summary.questions_changed, 0);
  const row = answerRow(impact, "A001-A");
  assert.equal(row.content_changed, true);
  assert.equal(row.version_rotates, false);
  assert.deepEqual(row.changed_fields, ["misconception_ids"]);
}

// ---------------------------------------------------------------------------
// 9. question removed -> version rotation + review deactivation (preserved)
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.questions[1].active = "false"; // Q002 leaves the active snapshot
  });
  const row = questionRow(impact, "Q002");
  assert.equal(row.status, "REMOVED");
  assert.equal(row.version_rotates, true);
  assert.equal(row.would_bump, true);
  assert.equal(row.active_reviews_affected, 1, "Q002 had 1 active review");
  // its answer also drops
  const droppedAnswer = answerRow(impact, "A002-A");
  assert.equal(droppedAnswer.status, "REMOVED");
  assert.equal(droppedAnswer.version_rotates, true);
  assert.equal(impact.summary.active_question_reviews_affected, 1);
}

// ---------------------------------------------------------------------------
// 10. answer parent changes -> answer version rotation (re-parent, preserved)
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.answers[0].question_id = "Q002"; // A001-A reparented Q001 -> Q002
  });
  const row = answerRow(impact, "A001-A");
  assert.equal(row.status, "REPARENTED");
  assert.equal(row.version_rotates, true, "re-parenting an answer rotates its source_version");
  assert.equal(row.would_bump, true);
  assert.ok(row.changed_fields.includes("question_id"), "question_id is flagged");
  assert.equal(row.parent_question_id, "Q002");
  assert.equal(impact.summary.questions_changed, 0, "re-parent alone does not change either question");
  assert.equal(impact.summary.answer_version_rotations, 1);
}

// ---------------------------------------------------------------------------
// 11. CRLF / NFC / whitespace normalization -> no false change
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.questions[0].question_en = "Print café n.".normalize("NFD") + "\r\n   ";
  });
  assert.notEqual(
    "Print café n.".normalize("NFD"),
    "Print café n.".normalize("NFC"),
    "fixture sanity: the two Unicode forms really differ byte-wise",
  );
  assert.equal(
    questionRow(impact, "Q001").content_changed,
    false,
    "CRLF + trailing whitespace + NFD form do not register as a change",
  );
  // sanity: a genuinely different accented character still registers
  const accent = impactFor((fx) => {
    fx.questions[0].question_en = "Print the numbér n.";
  });
  assert.equal(questionRow(accent, "Q001").content_changed, true);
  assert.equal(questionRow(accent, "Q001").version_rotates, false);
}

// ---------------------------------------------------------------------------
// 12. content-change / rotation math
// ---------------------------------------------------------------------------
{
  const proposedFixture = clone(BASE);
  proposedFixture.questions[0].question_code = "READ n\nPRINT n";
  const structuralOnly = computeBaselineSyncImpact({
    proposed: toSnapshot(proposedFixture),
    current: currentSnapshot,
    baselineState: null,
  });
  const row = questionRow(structuralOnly, "Q001");
  assert.equal(row.content_changed, true, "structural mode still detects the content change");
  assert.equal(row.version_rotates, false);
  assert.equal(row.active_reviews_affected, 0, "content drift affects 0 reviews");
  assert.equal(structuralOnly.summary.review_counts_known, false);
  assert.equal(structuralOnly.summary.previous_state, "snapshot");
}

// baselineState math: two question content edits, nothing rotates
{
  const impact = impactFor((fx) => {
    fx.questions[0].question_ind += " x";
    fx.questions[1].question_en += " y";
  });
  assert.equal(impact.summary.question_content_changes, 2);
  assert.equal(impact.summary.question_version_rotations, 0);
  assert.equal(impact.summary.active_question_reviews_affected, 0, "content edits deactivate 0 reviews");
  assert.equal(impact.summary.question_overrides_invalidated, 0, "content edits invalidate 0 overrides");
  assert.equal(impact.summary.review_counts_known, true);
}

// drift warning: frozen --current disagrees with the live baseline row
{
  const drifted = {
    questions: baselineState.questions.map((q) =>
      q.question_id === "Q001" ? { ...q, source_fingerprint: "0".repeat(64) } : q,
    ),
    answers: baselineState.answers,
  };
  const impact = computeBaselineSyncImpact({
    proposed: currentSnapshot,
    current: currentSnapshot,
    baselineState: drifted,
  });
  const q1 = impact.questions.find((r) => r.id === "Q001");
  assert.equal(q1.content_changed, true, "a fingerprint mismatch against the live baseline is content drift");
  assert.equal(q1.version_rotates, false);
  assert.ok(impact.summary.drift_warnings.some((w) => w.startsWith("Q001:")));
}

// ---------------------------------------------------------------------------
// 13. staging-ref guard
// ---------------------------------------------------------------------------
{
  assert.equal(parseSupabaseRef(`https://${STAGING_REF}.supabase.co`), STAGING_REF);
  assert.equal(assertStagingRef(`https://${STAGING_REF}.supabase.co/`), STAGING_REF);
  assert.throws(
    () => assertStagingRef("https://abcdefghijklmnop.supabase.co"),
    /not the shared staging ref/,
    "a non-staging ref is refused",
  );
  assert.throws(() => assertStagingRef("https://prod.example.com"), /could not extract/);
}

// CLI refuses --from-staging against a non-staging URL, and refuses --production
{
  const cli = join(repoRoot, "scripts", "preview-baseline-sync-impact.mjs");
  const proposedDir = join(repoRoot, "checks", "fixtures", "baseline-preflight", "current");
  assert.throws(
    () =>
      execFileSync("node", [cli, "--proposed", proposedDir, "--from-staging"], {
        env: { ...process.env, STAGING_SUPABASE_URL: "https://someotherproject.supabase.co" },
        stdio: "pipe",
      }),
    /not the shared staging ref/,
  );
  assert.throws(
    () => execFileSync("node", [cli, "--proposed", proposedDir, "--production"], { stdio: "pipe" }),
    /no production mode/,
  );
}

// ---------------------------------------------------------------------------
// 14. no write / mutation path anywhere in the preflight
// ---------------------------------------------------------------------------
{
  const preflightFiles = [
    "scripts/preview-baseline-sync-impact.mjs",
    "scripts/lib/baseline-sync-impact.mjs",
    "scripts/lib/staging-remote.mjs",
    "database/staging/lib/build-baseline-snapshot.mjs",
  ];
  const forbidden = [
    /@supabase\/supabase-js/,
    /\bcreateClient\s*\(/,
    /\.rpc\s*\(/,
    /\.(insert|upsert|delete)\s*\(/,
    /\.from\s*\([^)]*\)\s*\.\s*update\s*\(/,
    /["'`]sync_master_relation_baselines(_v2)?["'`]/,
    /["'`](save|delete)_(question|answer)_review[a-z0-9_]*["'`]/,
    /["'`]recompute_(question|answer)_review_consensus_v3["'`]/,
    /["'`]publish_(question|answer)_misconception_override["'`]/,
    /\/rpc\//,
    /method:\s*["'`](POST|PUT|PATCH|DELETE)["'`]/i,
  ];
  // strip // and /* */ comments so we only scan executable code, not prose
  const stripComments = (src) =>
    src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

  for (const rel of preflightFiles) {
    const code = stripComments(readFileSync(join(repoRoot, rel), "utf8"));
    for (const pattern of forbidden) {
      assert.doesNotMatch(code, pattern, `${rel} (code, comments stripped) must not contain ${pattern}`);
    }
    // every fetch() in the preflight is an explicit GET
    if (/fetch\s*\(/.test(code)) {
      assert.match(code, /method:\s*["'`]GET["'`]/, `${rel}: fetch present but no explicit GET`);
      assert.doesNotMatch(code, /fetch\s*\([^)]*method:\s*["'`](?!GET)/i, `${rel}: non-GET fetch`);
    }
  }
}

// ---------------------------------------------------------------------------
// CLI smoke: human report renders, JSON is valid, exit 0
// ---------------------------------------------------------------------------
{
  const cli = join(repoRoot, "scripts", "preview-baseline-sync-impact.mjs");
  const fixtures = join(repoRoot, "checks", "fixtures", "baseline-preflight");
  const out = execFileSync(
    "node",
    [
      cli,
      "--current",
      join(fixtures, "current"),
      "--proposed",
      join(fixtures, "proposed"),
      "--baseline",
      join(fixtures, "baseline.json"),
      "--json",
    ],
    { encoding: "utf8" },
  );
  assert.match(out, /=== QUESTION SYNC IMPACT ===/);
  assert.match(out, /Q038/);
  assert.match(out, /would rotate source_version: NO/);
  assert.match(out, /Content drift only: no source_version would rotate/);
  const jsonStart = out.indexOf("{");
  const parsed = JSON.parse(out.slice(jsonStart));
  assert.ok(Array.isArray(parsed.questions));
  assert.equal(parsed.summary.review_counts_known, true);
  assert.equal(parsed.summary.question_version_rotations, 0);
  assert.equal(parsed.summary.active_question_reviews_affected, 0);

  // no-diff path prints SAFE
  const safe = execFileSync(
    "node",
    [cli, "--current", join(fixtures, "current"), "--proposed", join(fixtures, "current"), "--baseline", join(fixtures, "baseline.json")],
    { encoding: "utf8" },
  );
  assert.match(safe, /SAFE: proposed snapshot matches current baseline version inputs\./);
}

console.log("baseline sync impact preflight checks passed.");
