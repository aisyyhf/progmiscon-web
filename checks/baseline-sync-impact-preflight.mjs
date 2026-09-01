// Focused tests for the read-only Master Data sync impact preflight.
//
// Covers the scenarios in the task brief:
//   1  identical snapshot                -> no bump
//   2  question_ind changes              -> question bump
//   3  question_en changes               -> question bump
//   4  question_code changes             -> question bump
//   5  direct question misconception ids -> question bump
//   6  content_blocks_ind changes        -> NOT a v2 fingerprint input, no bump
//   7  answer_text changes               -> answer bump, not question bump
//   8  answer misconception relation     -> answer bump, not question bump
//   9  question removed                  -> predicted invalidation
//   10 answer parent changes             -> answer bump
//   11 CRLF / NFC / whitespace           -> no false bump
//   12 review-count / override math
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
// unedited target is UNCHANGED and edits show up as bumps.
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
// 1. identical snapshot -> no bump
// ---------------------------------------------------------------------------
{
  const impact = impactFor(() => {});
  assert.equal(impact.summary.questions_changed, 0, "identical snapshot: no question changes");
  assert.equal(impact.summary.answers_changed, 0, "identical snapshot: no answer changes");
  assert.deepEqual(impact.summary.drift_warnings, []);
  assert.ok(impact.questions.every((r) => r.status === "UNCHANGED" && r.would_bump === false));
}

// ---------------------------------------------------------------------------
// 2-4. canonical text fields
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
  assert.equal(row.would_bump, true, `${field} change bumps Q001`);
  assert.deepEqual(row.changed_fields, [field], `${field} is named as the only changed field`);
  assert.equal(row.active_reviews_affected, 2, `${field}: Q001 has 2 active reviews`);
  assert.equal(row.override_invalidated, true, `${field}: Q001 override invalidated`);
  assert.equal(questionRow(impact, "Q002").would_bump, false, `${field}: Q002 untouched`);
  assert.equal(impact.summary.answers_changed, 0, `${field}: no answer bump`);
}

// ---------------------------------------------------------------------------
// 5. direct question misconception ids
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.questionMisc.push({ question_id: "Q001", misconception_id: "IO-02", active: "true" });
  });
  const row = questionRow(impact, "Q001");
  assert.equal(row.would_bump, true, "adding a direct question misconception bumps Q001");
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
// 7. answer_text -> answer bump, not question bump
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.answers[1].answer_text = "nine";
  });
  assert.equal(impact.summary.questions_changed, 0, "answer_text edit does not bump the parent question");
  const row = answerRow(impact, "A001-B");
  assert.equal(row.would_bump, true);
  assert.deepEqual(row.changed_fields, ["answer_text"]);
  assert.equal(row.active_reviews_affected, 3);
  assert.equal(row.override_invalidated, true);
  assert.equal(row.parent_question_id, "Q001");
}

// ---------------------------------------------------------------------------
// 8. answer misconception relation -> answer bump, not question bump
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.answerMisc.push({ answer_id: "A001-A", misconception_id: "IO-01", active: "true" });
  });
  assert.equal(impact.summary.questions_changed, 0);
  const row = answerRow(impact, "A001-A");
  assert.equal(row.would_bump, true);
  assert.deepEqual(row.changed_fields, ["misconception_ids"]);
}

// ---------------------------------------------------------------------------
// 9. question removed -> predicted invalidation
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.questions[1].active = "false"; // Q002 leaves the active snapshot
  });
  const row = questionRow(impact, "Q002");
  assert.equal(row.status, "REMOVED");
  assert.equal(row.would_bump, true);
  assert.equal(row.active_reviews_affected, 1, "Q002 had 1 active review");
  // its answer also drops
  const droppedAnswer = answerRow(impact, "A002-A");
  assert.equal(droppedAnswer.status, "REMOVED");
  assert.equal(droppedAnswer.would_bump, true);
}

// ---------------------------------------------------------------------------
// 10. answer parent changes -> answer bump
// ---------------------------------------------------------------------------
{
  const impact = impactFor((fx) => {
    fx.answers[0].question_id = "Q002"; // A001-A reparented Q001 -> Q002
  });
  const row = answerRow(impact, "A001-A");
  assert.equal(row.would_bump, true, "reparenting an answer bumps it");
  assert.ok(row.changed_fields.includes("question_id"), "question_id is flagged");
  assert.equal(row.parent_question_id, "Q002");
  assert.equal(impact.summary.questions_changed, 0, "reparent alone does not bump either question");
}

// ---------------------------------------------------------------------------
// 11. CRLF / NFC / whitespace normalization -> no false bump
// ---------------------------------------------------------------------------
{
  // CRLF vs LF, trailing whitespace, and NFD vs NFC of the SAME text ("café"):
  // all collapse under canonText, so no false bump.
  const impact = impactFor((fx) => {
    fx.questions[0].question_en = "Print café n.".normalize("NFD") + "\r\n   ";
  });
  assert.notEqual(
    "Print café n.".normalize("NFD"),
    "Print café n.".normalize("NFC"),
    "fixture sanity: the two Unicode forms really differ byte-wise",
  );
  assert.equal(
    questionRow(impact, "Q001").would_bump,
    false,
    "CRLF + trailing whitespace + NFD form do not bump",
  );
  // sanity: a genuinely different accented character still bumps
  const accent = impactFor((fx) => {
    fx.questions[0].question_en = "Print the numbér n.";
  });
  assert.equal(questionRow(accent, "Q001").would_bump, true);
}

// ---------------------------------------------------------------------------
// 12. review-count / override math with structural-only mode (no baselineState)
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
  assert.equal(row.would_bump, true, "structural mode still detects the bump");
  assert.equal(row.active_reviews_affected, null, "structural mode cannot know review counts");
  assert.equal(structuralOnly.summary.review_counts_known, false);
  assert.equal(structuralOnly.summary.previous_state, "snapshot");
}

// baselineState math
{
  const impact = impactFor((fx) => {
    fx.questions[0].question_ind += " x";
    fx.questions[1].question_en += " y";
  });
  assert.equal(impact.summary.questions_bumping, 2);
  assert.equal(impact.summary.active_question_reviews_affected, 3, "2 + 1 active reviews");
  assert.equal(impact.summary.question_overrides_invalidated, 1, "only Q001 has an override");
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
  assert.equal(impact.questions.find((r) => r.id === "Q001").would_bump, true, "drift alone forces a bump");
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
  assert.match(out, /=== QUESTION VERSION IMPACT ===/);
  assert.match(out, /Q038/);
  assert.match(out, /would bump source_version: YES/);
  const jsonStart = out.indexOf("{");
  const parsed = JSON.parse(out.slice(jsonStart));
  assert.ok(Array.isArray(parsed.questions));
  assert.equal(parsed.summary.review_counts_known, true);

  // no-diff path prints SAFE
  const safe = execFileSync(
    "node",
    [cli, "--current", join(fixtures, "current"), "--proposed", join(fixtures, "current"), "--baseline", join(fixtures, "baseline.json")],
    { encoding: "utf8" },
  );
  assert.match(safe, /SAFE: proposed snapshot matches current baseline version inputs\./);
}

console.log("baseline sync impact preflight checks passed.");
