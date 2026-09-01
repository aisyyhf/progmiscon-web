// Unit tests for the pure planning engine scripts/lib/canonical-sync-plan.mjs.
// No I/O beyond reading the committed fixtures; no network; no Supabase.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCsv, buildBaselineSnapshot } from "../database/staging/lib/build-baseline-snapshot.mjs";
import {
  buildCanonicalSyncPlan,
  normalizeOracle,
  validatePostApply,
} from "../scripts/lib/canonical-sync-plan.mjs";

const FIX = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "canonical-sync");
function snapshot(dir) {
  const t = (name) => parseCsv(readFileSync(join(FIX, dir, name), "utf8"));
  return buildBaselineSnapshot({
    misconceptions: t("misconceptions.csv"),
    questions: t("questions.csv"),
    answers: t("answers.csv"),
    questionMisconceptions: t("question_misconceptions.csv"),
    answerMisconceptions: t("answer_misconceptions.csv"),
  });
}
const oracle = (name) => JSON.parse(readFileSync(join(FIX, `${name}.json`), "utf8"));

const current = snapshot("current");

// ---------------------------------------------------------------------------
// 1. zero-change current snapshot -> applyable, 0 bumps
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-identical"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: [], answerAllowlist: [], maxQuestionBumps: 0, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, true, "identical snapshot is applyable");
  assert.deepEqual(plan.expectedQuestionBumpIds, []);
  assert.deepEqual(plan.unexpectedQuestionBumpIds, []);
  assert.deepEqual(plan.expectedAnswerBumpIds, []);
  assert.deepEqual(plan.unexpectedAnswerBumpIds, []);
  assert.equal(plan.parityFailures.length, 0);
  assert.equal(plan.nullBaselineRows.length, 0);
  assert.equal(plan.counts.predicted_question_bumps, 0);
  assert.equal(plan.counts.predicted_answer_bumps, 0);
}

// ---------------------------------------------------------------------------
// 2. one expected question bump + zero answer bump -> applyable
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-ok"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionBumps: 3, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, true, "one allowlisted bump is applyable");
  assert.deepEqual(plan.expectedQuestionBumpIds, ["Q2"]);
  assert.deepEqual(plan.unexpectedQuestionBumpIds, []);
  assert.deepEqual(plan.missingExpectedQuestionIds, []);
  assert.deepEqual(plan.expectedAnswerBumpIds, []);
  assert.deepEqual(plan.unexpectedAnswerBumpIds, []);
  assert.equal(plan.counts.predicted_question_bumps, 1);
  assert.equal(plan.counts.predicted_answer_bumps, 0);
  // review-count / override math comes from the oracle
  assert.equal(plan.counts.predicted_active_question_reviews_invalidated, 2);
  assert.equal(plan.counts.predicted_question_overrides_invalidated, 1);
}

// ---------------------------------------------------------------------------
// 3. unexpected extra question bump -> blocked
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-extra-question"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionBumps: 3, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "unexpected question bump blocks");
  assert.deepEqual(plan.unexpectedQuestionBumpIds, ["Q3"]);
  assert.equal(plan.gates.question_allowlist_exact, false);
  assert.ok(plan.blockingReasons.some((r) => r.includes("Q3")));
}

// ---------------------------------------------------------------------------
// 4a. unexpected ANSWER bump (answerAllowlist []) -> blocked
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-answer-bump"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionBumps: 3, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "any answer bump blocks a question-only pilot");
  assert.deepEqual(plan.unexpectedAnswerBumpIds, ["A1"]);
  assert.equal(plan.gates.answer_allowlist_exact, false);
  assert.equal(plan.gates.answer_bump_count_within_max, false);
  assert.equal(plan.counts.predicted_answer_bumps, 1);
}

// 4b. same edit but with the answer explicitly allowlisted -> applyable
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-answer-bump"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: ["A1"], maxQuestionBumps: 3, maxAnswerBumps: 1 },
  });
  assert.equal(plan.planIsApplyable, true, "an explicitly allowlisted answer bump is allowed");
  assert.deepEqual(plan.expectedAnswerBumpIds, ["A1"]);
}

// ---------------------------------------------------------------------------
// 5. NULL baseline row -> blocked, reported, never reconciled
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-ok"),
    current,
    oracle: oracle("oracle-null"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionBumps: 3, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "a NULL baseline row blocks");
  assert.equal(plan.gates.zero_null_baseline_rows, false);
  assert.equal(plan.nullBaselineRows.length, 1);
  assert.equal(plan.nullBaselineRows[0].target_id, "Q1");
  assert.equal(plan.nullBaselineRows[0].null_source_fingerprint, true);
}

// ---------------------------------------------------------------------------
// 6. parity failure (Production fingerprint != current snapshot) -> blocked
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-ok"),
    current,
    oracle: oracle("oracle-parity-mismatch"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionBumps: 3, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "parity failure blocks");
  assert.equal(plan.gates.parity_clean, false);
  assert.ok(plan.parityFailures.some((f) => f.target_id === "Q1"));
}

// ---------------------------------------------------------------------------
// 7. max bump count
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-extra-question"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2", "Q3"], answerAllowlist: [], maxQuestionBumps: 1, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "exceeding --max-question-bumps blocks even when allowlisted");
  assert.equal(plan.gates.question_bump_count_within_max, false);
  assert.deepEqual(plan.expectedQuestionBumpIds, ["Q2", "Q3"]);
  assert.deepEqual(plan.unexpectedQuestionBumpIds, []);
}

// ---------------------------------------------------------------------------
// 8. snapshot completeness — a dropped active question blocks
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-drop-question"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionBumps: 3, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "dropping an active question blocks");
  assert.equal(plan.gates.snapshot_complete, false);
  assert.ok(plan.completenessViolations.some((v) => v.target_id === "Q3"));
}

// ---------------------------------------------------------------------------
// 9. missing-expected — an allowlisted question that does NOT bump blocks
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-ok"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2", "Q3"], answerAllowlist: [], maxQuestionBumps: 3, maxAnswerBumps: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "an allowlisted question that would not bump blocks");
  assert.deepEqual(plan.missingExpectedQuestionIds, ["Q3"]);
  assert.equal(plan.gates.question_allowlist_exact, false);
}

// ---------------------------------------------------------------------------
// normalizeOracle input validation
// ---------------------------------------------------------------------------
assert.throws(() => normalizeOracle({}), /must be an array/);
assert.throws(() => normalizeOracle([{ target_type: "x", target_id: "Q1" }]), /target_type/);
assert.throws(() => normalizeOracle([{ target_type: "question", target_id: "" }]), /target_id is blank/);
assert.throws(
  () => normalizeOracle([
    { target_type: "question", target_id: "Q1", source_version: "v", source_fingerprint: "f", misconception_ids: [] },
    { target_type: "question", target_id: "Q1", source_version: "v", source_fingerprint: "f", misconception_ids: [] },
  ]),
  /duplicate/,
);

// ---------------------------------------------------------------------------
// validatePostApply
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-ok"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionBumps: 3, maxAnswerBumps: 0 },
  });

  // exact match: 1 question, 0 answers, post-oracle shows only Q2 moved
  const good = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 1, answer_versions_changed: 0 },
    preOracle: oracle("oracle-clean"),
    postOracle: oracle("oracle-after-q2-bump"),
  });
  assert.equal(good.ok, true, JSON.stringify(good.failures));
  assert.deepEqual(good.observedQuestionBumpIds, ["Q2"]);
  assert.deepEqual(good.observedAnswerBumpIds, []);

  // RPC reports an unexpected ANSWER version change -> fail/alert
  const answerAlert = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 1, answer_versions_changed: 2 },
  });
  assert.equal(answerAlert.ok, false);
  assert.ok(answerAlert.failures.some((f) => /answer/i.test(f)));

  // RPC reports more question bumps than planned -> fail/alert
  const tooMany = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 5, answer_versions_changed: 0 },
  });
  assert.equal(tooMany.ok, false);
  assert.ok(tooMany.failures.some((f) => /question_versions_changed/.test(f)));

  // post-oracle shows a question bumped that is NOT in the allowlist -> fail
  const rogue = oracle("oracle-after-q2-bump").map((r) =>
    r.target_id === "Q1" ? { ...r, source_version: "aaaaaaaa-0000-4000-8000-000000000001" } : r,
  );
  const rogueResult = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 1, answer_versions_changed: 0 },
    preOracle: oracle("oracle-clean"),
    postOracle: rogue,
  });
  assert.equal(rogueResult.ok, false);
  assert.ok(rogueResult.failures.some((f) => /Q1 bumped but is NOT in the approved allowlist/.test(f)));
}

console.log("canonical-sync-plan checks passed");
