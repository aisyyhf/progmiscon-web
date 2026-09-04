// Unit tests for the pure planning engine scripts/lib/canonical-sync-plan.mjs.
// No I/O beyond reading the committed fixtures; no network; no Supabase.
//
// Since 20260904000000_canonical_sync_keep_reviews_active.sql, ordinary content
// / misconception drift for an existing target refreshes source_fingerprint but
// does NOT rotate source_version and does NOT deactivate a review or delete an
// override. The allowlist gates CONTENT CHANGES; a source_version rotation
// (new / removed / re-parented target) is a hard blocker.
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
// 1. zero-change current snapshot -> applyable, 0 content changes, 0 rotations
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-identical"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: [], answerAllowlist: [], maxQuestionContentChanges: 0, maxAnswerContentChanges: 0 },
  });
  assert.equal(plan.planIsApplyable, true, "identical snapshot is applyable");
  assert.deepEqual(plan.expectedQuestionContentChangeIds, []);
  assert.deepEqual(plan.unexpectedQuestionContentChangeIds, []);
  assert.deepEqual(plan.questionVersionRotationIds, []);
  assert.deepEqual(plan.answerVersionRotationIds, []);
  assert.equal(plan.parityFailures.length, 0);
  assert.equal(plan.nullBaselineRows.length, 0);
  assert.equal(plan.counts.predicted_question_content_changes, 0);
  assert.equal(plan.counts.predicted_version_rotations, 0);
}

// ---------------------------------------------------------------------------
// 2. one allowlisted question content change -> applyable, 0 reviews touched
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-ok"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionContentChanges: 3, maxAnswerContentChanges: 0 },
  });
  assert.equal(plan.planIsApplyable, true, "one allowlisted content change is applyable");
  assert.deepEqual(plan.expectedQuestionContentChangeIds, ["Q2"]);
  assert.deepEqual(plan.unexpectedQuestionContentChangeIds, []);
  assert.deepEqual(plan.missingExpectedQuestionContentChangeIds, []);
  assert.deepEqual(plan.expectedAnswerContentChangeIds, []);
  assert.deepEqual(plan.questionVersionRotationIds, []);
  assert.equal(plan.counts.predicted_question_content_changes, 1);
  assert.equal(plan.counts.predicted_version_rotations, 0);
  // a content edit never deactivates a review or drops an override
  assert.equal(plan.counts.predicted_active_question_reviews_invalidated, 0);
  assert.equal(plan.counts.predicted_question_overrides_invalidated, 0);
  const q2 = plan.questions.find((r) => r.id === "Q2");
  assert.equal(q2.content_changed, true);
  assert.equal(q2.version_rotates, false);
  assert.equal(q2.active_reviews_affected, 0);
  assert.equal(q2.classification, "EXPECTED_CONTENT_CHANGE");
}

// ---------------------------------------------------------------------------
// 3. content change outside the allowlist -> blocked
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-extra-question"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionContentChanges: 3, maxAnswerContentChanges: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "an unexpected content change blocks");
  assert.deepEqual(plan.unexpectedQuestionContentChangeIds, ["Q3"]);
  assert.equal(plan.gates.question_content_allowlist_exact, false);
  assert.ok(plan.blockingReasons.some((r) => r.includes("Q3")));
}

// ---------------------------------------------------------------------------
// 4a. unexpected ANSWER content change (answerAllowlist []) -> blocked
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-answer-bump"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionContentChanges: 3, maxAnswerContentChanges: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "any answer content change blocks a question-only edit");
  assert.deepEqual(plan.unexpectedAnswerContentChangeIds, ["A1"]);
  assert.equal(plan.gates.answer_content_allowlist_exact, false);
  assert.equal(plan.gates.answer_content_change_count_within_max, false);
  assert.equal(plan.counts.predicted_answer_content_changes, 1);
  // the A1 change is content drift, not a re-parent: nothing rotates
  assert.deepEqual(plan.answerVersionRotationIds, []);
  const a1 = plan.answers.find((r) => r.id === "A1");
  assert.equal(a1.content_changed, true);
  assert.equal(a1.version_rotates, false);
}

// 4b. same edit but with the answer explicitly allowlisted -> applyable
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-answer-bump"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: ["A1"], maxQuestionContentChanges: 3, maxAnswerContentChanges: 1 },
  });
  assert.equal(plan.planIsApplyable, true, "an explicitly allowlisted answer content change is allowed");
  assert.deepEqual(plan.expectedAnswerContentChangeIds, ["A1"]);
}

// ---------------------------------------------------------------------------
// 5. NULL baseline row -> blocked, reported, never reconciled
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-ok"),
    current,
    oracle: oracle("oracle-null"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionContentChanges: 3, maxAnswerContentChanges: 0 },
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
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionContentChanges: 3, maxAnswerContentChanges: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "parity failure blocks");
  assert.equal(plan.gates.parity_clean, false);
  assert.ok(plan.parityFailures.some((f) => f.target_id === "Q1"));
}

// ---------------------------------------------------------------------------
// 7. max content-change count
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-extra-question"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2", "Q3"], answerAllowlist: [], maxQuestionContentChanges: 1, maxAnswerContentChanges: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "exceeding --max-question-changes blocks even when allowlisted");
  assert.equal(plan.gates.question_content_change_count_within_max, false);
  assert.deepEqual(plan.expectedQuestionContentChangeIds, ["Q2", "Q3"]);
  assert.deepEqual(plan.unexpectedQuestionContentChangeIds, []);
}

// ---------------------------------------------------------------------------
// 8. snapshot completeness / version rotation — a dropped active question
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-drop-question"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionContentChanges: 3, maxAnswerContentChanges: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "dropping an active question blocks");
  assert.equal(plan.gates.snapshot_complete, false);
  assert.equal(plan.gates.zero_version_rotations, false, "a removed question rotates its source_version");
  assert.ok(plan.completenessViolations.some((v) => v.target_id === "Q3"));
  assert.ok(plan.questionVersionRotationIds.includes("Q3"));
  assert.ok(plan.blockingReasons.some((r) => /ROTATE source_version/.test(r)));
}

// ---------------------------------------------------------------------------
// 9. missing-expected — an allowlisted question that shows NO content change
// ---------------------------------------------------------------------------
{
  const plan = buildCanonicalSyncPlan({
    proposed: snapshot("proposed-ok"),
    current,
    oracle: oracle("oracle-clean"),
    options: { questionAllowlist: ["Q2", "Q3"], answerAllowlist: [], maxQuestionContentChanges: 3, maxAnswerContentChanges: 0 },
  });
  assert.equal(plan.planIsApplyable, false, "an allowlisted question with no content change blocks");
  assert.deepEqual(plan.missingExpectedQuestionContentChangeIds, ["Q3"]);
  assert.equal(plan.gates.question_content_allowlist_exact, false);
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
    options: { questionAllowlist: ["Q2"], answerAllowlist: [], maxQuestionContentChanges: 3, maxAnswerContentChanges: 0 },
  });

  // per-target verification is MANDATORY — no post-oracle -> not ok
  const noPost = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 0, answer_versions_changed: 0 },
  });
  assert.equal(noPost.ok, false, "count-only verification is never accepted");
  assert.ok(noPost.failures.some((f) => /requires BOTH the pre-apply oracle and a fresh --post-oracle/.test(f)));

  // exact match: RPC 0/0, post-oracle shows Q2's fingerprint refreshed and its
  // source_version held stable
  const good = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 0, answer_versions_changed: 0 },
    preOracle: oracle("oracle-clean"),
    postOracle: oracle("oracle-after-q2-edit"),
  });
  assert.equal(good.ok, true, JSON.stringify(good.failures));
  assert.deepEqual(good.observedQuestionVersionChanges, []);
  assert.deepEqual(good.observedQuestionContentChanges.map((c) => c.id), ["Q2"]);
  assert.deepEqual(good.observedAnswerVersionChanges, []);

  // RPC claims a version rotated -> fail
  const rpcRotated = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 1, answer_versions_changed: 0 },
    preOracle: oracle("oracle-clean"),
    postOracle: oracle("oracle-after-q2-edit"),
  });
  assert.equal(rpcRotated.ok, false);
  assert.ok(rpcRotated.failures.some((f) => /must rotate 0 question source_versions/.test(f)));

  // post-oracle shows Q2's source_version ALSO rotated -> ALERT
  const q2Rotated = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 0, answer_versions_changed: 0 },
    preOracle: oracle("oracle-clean"),
    postOracle: oracle("oracle-after-q2-rotated"),
  });
  assert.equal(q2Rotated.ok, false);
  assert.ok(q2Rotated.failures.some((f) => /Q2 source_version rotated/.test(f)));

  // post-oracle shows the WRONG question rotated, and Q2's edit did not land
  const rogue = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 0, answer_versions_changed: 0 },
    preOracle: oracle("oracle-clean"),
    postOracle: oracle("oracle-after-wrong-q1"),
  });
  assert.equal(rogue.ok, false);
  assert.ok(rogue.failures.some((f) => /Q1 source_version rotated/.test(f)));
  assert.ok(rogue.failures.some((f) => /allowlisted question Q2 source_fingerprint did NOT change/.test(f)));

  // post-oracle shows an unexpected ANSWER rotated
  const answerRotated = validatePostApply({
    plan,
    rpcResult: { question_versions_changed: 0, answer_versions_changed: 0 },
    preOracle: oracle("oracle-clean"),
    postOracle: oracle("oracle-after-answer-rotated"),
  });
  assert.equal(answerRotated.ok, false);
  assert.ok(answerRotated.failures.some((f) => /answer A1 source_version rotated/.test(f)));
}

console.log("canonical-sync-plan checks passed");
