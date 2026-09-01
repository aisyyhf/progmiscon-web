// Pure planning engine for a version-aware canonical Master Data sync to
// Production. NO I/O, NO network, NO Supabase client. Deterministic transform
// of already-parsed inputs.
//
// It answers, before any mutation: "if I sync this proposed snapshot against
// this Production baseline state, exactly which question/answer source_versions
// would bump, and is that safe to apply given a strict allowlist?"
//
// The bump prediction reuses computeBaselineSyncImpact(), which models
// public.sync_master_relation_baselines_v2 exactly:
//   target bumps IFF  stored.source_fingerprint  != incoming.source_fingerprint
//                 OR   stored.misconception_ids   != incoming.misconception_ids
//                 OR   (answers) stored.question_id != incoming.question_id
//                 OR   target present in the stored state, absent from incoming
//                 OR   target absent from the stored state (NEW)
//
// canonical-sync-plan adds, on top, the fail-closed gates required for a
// Production canonical edit:
//   * FULL fingerprint parity between the frozen "current" (unedited) snapshot
//     and the Production baseline oracle — proves build-baseline-snapshot.mjs
//     reproduces the values Production already stores (blocker E1);
//   * ZERO NULL-baseline rows (NULL source_version / source_fingerprint) — the
//     tool reports them and stops; it NEVER silently reconciles them (E2);
//   * exact question allowlist match (every predicted question bump is in the
//     allowlist AND every allowlisted question actually bumps);
//   * ZERO answer bumps for a question-only pilot (answerAllowlist defaults to
//     []), reported in preview and enforced before apply;
//   * a maximum bump count for questions and answers;
//   * snapshot completeness — the proposed snapshot must not silently drop an
//     active question/answer that Production's baseline knows about.

import { normalizeIds } from "../../database/staging/lib/build-baseline-snapshot.mjs";
import { computeBaselineSyncImpact } from "./baseline-sync-impact.mjs";

function idsEqual(a, b) {
  const left = normalizeIds(a ?? []);
  const right = normalizeIds(b ?? []);
  return left.length === right.length && left.every((v, i) => v === right[i]);
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

// ---------------------------------------------------------------------------
// oracle -> baselineState (the exact shape computeBaselineSyncImpact expects)
// ---------------------------------------------------------------------------
export function normalizeOracle(oracleRows) {
  if (!Array.isArray(oracleRows)) {
    throw new TypeError("oracle must be an array of baseline-state rows");
  }
  const questions = [];
  const answers = [];
  const nullBaselineRows = [];
  const seen = new Set();

  for (const [index, raw] of oracleRows.entries()) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new TypeError(`oracle row ${index + 1} must be an object`);
    }
    const targetType = String(raw.target_type ?? "").trim();
    const targetId = String(raw.target_id ?? "").trim();
    if (targetType !== "question" && targetType !== "answer") {
      throw new TypeError(`oracle row ${index + 1}: target_type must be "question" or "answer"`);
    }
    if (!targetId) throw new TypeError(`oracle row ${index + 1}: target_id is blank`);
    const key = `${targetType}:${targetId}`;
    if (seen.has(key)) throw new TypeError(`oracle: duplicate ${key}`);
    seen.add(key);

    const sourceVersion = raw.source_version == null ? null : String(raw.source_version).trim();
    const sourceFingerprint =
      raw.source_fingerprint == null ? null : String(raw.source_fingerprint).trim();
    const misconceptionIds = normalizeIds(
      Array.isArray(raw.misconception_ids) ? raw.misconception_ids : [],
    );
    const nullVersion = isBlank(sourceVersion);
    const nullFingerprint = isBlank(sourceFingerprint);
    if (nullVersion || nullFingerprint) {
      nullBaselineRows.push({
        target_type: targetType,
        target_id: targetId,
        null_source_version: nullVersion,
        null_source_fingerprint: nullFingerprint,
      });
    }

    const entry = {
      source_version: nullVersion ? null : sourceVersion,
      source_fingerprint: nullFingerprint ? null : sourceFingerprint,
      misconception_ids: misconceptionIds,
      active_review_count:
        raw.active_review_count == null ? null : Number(raw.active_review_count),
      override_exists: raw.override_exists === true,
    };
    if (targetType === "question") {
      questions.push({ question_id: targetId, ...entry });
    } else {
      answers.push({
        answer_id: targetId,
        question_id: raw.question_id == null ? null : String(raw.question_id).trim(),
        ...entry,
      });
    }
  }
  return { questions, answers, nullBaselineRows };
}

// ---------------------------------------------------------------------------
// parity: frozen "current" snapshot must reproduce the Production oracle
// ---------------------------------------------------------------------------
function checkParity(currentSnapshot, oracleQuestions, oracleAnswers) {
  const failures = [];
  const curQ = new Map(currentSnapshot.questionBaselines.map((r) => [r.question_id, r]));
  const curA = new Map(currentSnapshot.answerBaselines.map((r) => [r.answer_id, r]));
  const oracleQ = new Map(oracleQuestions.map((r) => [r.question_id, r]));
  const oracleA = new Map(oracleAnswers.map((r) => [r.answer_id, r]));

  for (const [id, oracleRow] of oracleQ) {
    const cur = curQ.get(id);
    if (!cur) {
      failures.push({ target_type: "question", target_id: id, reason: "in Production baseline, absent from the frozen current snapshot" });
      continue;
    }
    if (oracleRow.source_fingerprint == null) continue; // NULL handled separately
    if (cur.source_fingerprint !== oracleRow.source_fingerprint) {
      failures.push({ target_type: "question", target_id: id, reason: "source_fingerprint differs: current snapshot vs Production baseline" });
    }
    if (!idsEqual(cur.misconception_ids, oracleRow.misconception_ids)) {
      failures.push({ target_type: "question", target_id: id, reason: "misconception_ids differ: current snapshot vs Production baseline" });
    }
  }
  for (const [id, oracleRow] of oracleA) {
    const cur = curA.get(id);
    if (!cur) {
      failures.push({ target_type: "answer", target_id: id, reason: "in Production baseline, absent from the frozen current snapshot" });
      continue;
    }
    if (oracleRow.source_fingerprint == null) continue;
    if (cur.source_fingerprint !== oracleRow.source_fingerprint) {
      failures.push({ target_type: "answer", target_id: id, reason: "source_fingerprint differs: current snapshot vs Production baseline" });
    }
    if (!idsEqual(cur.misconception_ids, oracleRow.misconception_ids)) {
      failures.push({ target_type: "answer", target_id: id, reason: "misconception_ids differ: current snapshot vs Production baseline" });
    }
    if (oracleRow.question_id != null && cur.question_id !== oracleRow.question_id) {
      failures.push({ target_type: "answer", target_id: id, reason: "parent question_id differs: current snapshot vs Production baseline" });
    }
  }
  return failures;
}

// ---------------------------------------------------------------------------
// completeness: proposed snapshot must not silently drop an active target
// ---------------------------------------------------------------------------
function checkCompleteness(currentSnapshot, proposedSnapshot, oracleQuestions, oracleAnswers) {
  const violations = [];
  const propQ = new Set(proposedSnapshot.questionBaselines.map((r) => r.question_id));
  const propA = new Set(proposedSnapshot.answerBaselines.map((r) => r.answer_id));
  const curQ = new Set(currentSnapshot.questionBaselines.map((r) => r.question_id));
  const curA = new Set(currentSnapshot.answerBaselines.map((r) => r.answer_id));

  for (const r of oracleQuestions) {
    if (!propQ.has(r.question_id)) {
      violations.push({ target_type: "question", target_id: r.question_id, reason: "in Production baseline, absent from the proposed snapshot (would deactivate its reviews)" });
    }
  }
  for (const r of oracleAnswers) {
    if (!propA.has(r.answer_id)) {
      violations.push({ target_type: "answer", target_id: r.answer_id, reason: "in Production baseline, absent from the proposed snapshot (would deactivate its reviews)" });
    }
  }
  for (const id of curQ) {
    if (!propQ.has(id)) violations.push({ target_type: "question", target_id: id, reason: "active in the current snapshot, absent from the proposed snapshot" });
  }
  for (const id of curA) {
    if (!propA.has(id)) violations.push({ target_type: "answer", target_id: id, reason: "active in the current snapshot, absent from the proposed snapshot" });
  }
  for (const id of propQ) {
    if (!curQ.has(id)) violations.push({ target_type: "question", target_id: id, reason: "in the proposed snapshot, not in the current snapshot (question-only pilot must not add questions)" });
  }
  for (const id of propA) {
    if (!curA.has(id)) violations.push({ target_type: "answer", target_id: id, reason: "in the proposed snapshot, not in the current snapshot (question-only pilot must not add answers)" });
  }
  // de-dupe
  const seen = new Set();
  return violations.filter((v) => {
    const k = `${v.target_type}:${v.target_id}:${v.reason}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

// ---------------------------------------------------------------------------
// main planner
// ---------------------------------------------------------------------------
export function buildCanonicalSyncPlan({
  proposed,
  current,
  oracle,
  options = {},
} = {}) {
  if (!proposed || !Array.isArray(proposed.questionBaselines)) {
    throw new TypeError("buildCanonicalSyncPlan: `proposed` must be a buildBaselineSnapshot() result.");
  }
  if (!current || !Array.isArray(current.questionBaselines)) {
    throw new TypeError("buildCanonicalSyncPlan: `current` must be a buildBaselineSnapshot() result.");
  }

  const questionAllowlist = normalizeIds(options.questionAllowlist ?? []);
  const answerAllowlist = normalizeIds(options.answerAllowlist ?? []);
  const maxQuestionBumps = Number.isInteger(options.maxQuestionBumps)
    ? options.maxQuestionBumps
    : questionAllowlist.length;
  const maxAnswerBumps = Number.isInteger(options.maxAnswerBumps)
    ? options.maxAnswerBumps
    : answerAllowlist.length;

  const { questions: oracleQuestions, answers: oracleAnswers, nullBaselineRows } =
    normalizeOracle(oracle);

  const impact = computeBaselineSyncImpact({
    proposed,
    current,
    baselineState: { questions: oracleQuestions, answers: oracleAnswers },
  });

  const qAllow = new Set(questionAllowlist);
  const aAllow = new Set(answerAllowlist);

  const questionRows = impact.questions.map((row) => ({
    id: row.id,
    status: row.status,
    would_bump: row.would_bump,
    in_allowlist: qAllow.has(row.id),
    current_source_version: row.current_source_version,
    active_reviews_affected: row.active_reviews_affected,
    override_invalidated: row.override_invalidated,
    changed_fields: row.changed_fields,
    classification: !row.would_bump
      ? (qAllow.has(row.id) ? "MISSING_EXPECTED" : "UNCHANGED")
      : (qAllow.has(row.id) ? "EXPECTED_BUMP" : "UNEXPECTED_BUMP"),
  }));
  const answerRows = impact.answers.map((row) => ({
    id: row.id,
    parent_question_id: row.parent_question_id,
    status: row.status,
    would_bump: row.would_bump,
    in_allowlist: aAllow.has(row.id),
    current_source_version: row.current_source_version,
    active_reviews_affected: row.active_reviews_affected,
    override_invalidated: row.override_invalidated,
    changed_fields: row.changed_fields,
    classification: !row.would_bump
      ? (aAllow.has(row.id) ? "MISSING_EXPECTED" : "UNCHANGED")
      : (aAllow.has(row.id) ? "EXPECTED_BUMP" : "UNEXPECTED_BUMP"),
  }));

  const expectedQuestionBumpIds = questionRows
    .filter((r) => r.classification === "EXPECTED_BUMP")
    .map((r) => r.id)
    .sort();
  const unexpectedQuestionBumpIds = questionRows
    .filter((r) => r.classification === "UNEXPECTED_BUMP")
    .map((r) => r.id)
    .sort();
  const missingExpectedQuestionIds = questionRows
    .filter((r) => r.classification === "MISSING_EXPECTED")
    .map((r) => r.id)
    .sort();
  const expectedAnswerBumpIds = answerRows
    .filter((r) => r.classification === "EXPECTED_BUMP")
    .map((r) => r.id)
    .sort();
  const unexpectedAnswerBumpIds = answerRows
    .filter((r) => r.classification === "UNEXPECTED_BUMP")
    .map((r) => r.id)
    .sort();
  const missingExpectedAnswerIds = answerRows
    .filter((r) => r.classification === "MISSING_EXPECTED")
    .map((r) => r.id)
    .sort();

  const parityFailures = checkParity(current, oracleQuestions, oracleAnswers);
  const completenessViolations = checkCompleteness(
    current,
    proposed,
    oracleQuestions,
    oracleAnswers,
  );

  const totalQuestionBumps = expectedQuestionBumpIds.length + unexpectedQuestionBumpIds.length;
  const totalAnswerBumps = expectedAnswerBumpIds.length + unexpectedAnswerBumpIds.length;

  const gates = {
    parity_clean: parityFailures.length === 0,
    zero_null_baseline_rows: nullBaselineRows.length === 0,
    question_allowlist_exact:
      unexpectedQuestionBumpIds.length === 0 && missingExpectedQuestionIds.length === 0,
    answer_allowlist_exact:
      unexpectedAnswerBumpIds.length === 0 && missingExpectedAnswerIds.length === 0,
    question_bump_count_within_max: totalQuestionBumps <= maxQuestionBumps,
    answer_bump_count_within_max: totalAnswerBumps <= maxAnswerBumps,
    snapshot_complete: completenessViolations.length === 0,
  };
  const blockingReasons = [];
  if (!gates.parity_clean) blockingReasons.push(`fingerprint parity failed for ${parityFailures.length} target(s)`);
  if (!gates.zero_null_baseline_rows) blockingReasons.push(`${nullBaselineRows.length} Production baseline row(s) have a NULL source_version/source_fingerprint`);
  if (unexpectedQuestionBumpIds.length) blockingReasons.push(`${unexpectedQuestionBumpIds.length} question bump(s) outside the allowlist: ${unexpectedQuestionBumpIds.join(", ")}`);
  if (missingExpectedQuestionIds.length) blockingReasons.push(`${missingExpectedQuestionIds.length} allowlisted question(s) would NOT bump: ${missingExpectedQuestionIds.join(", ")}`);
  if (unexpectedAnswerBumpIds.length) blockingReasons.push(`${unexpectedAnswerBumpIds.length} answer bump(s) outside the allowlist: ${unexpectedAnswerBumpIds.join(", ")}`);
  if (missingExpectedAnswerIds.length) blockingReasons.push(`${missingExpectedAnswerIds.length} allowlisted answer(s) would NOT bump: ${missingExpectedAnswerIds.join(", ")}`);
  if (!gates.question_bump_count_within_max) blockingReasons.push(`predicted question bumps ${totalQuestionBumps} exceed --max-question-bumps ${maxQuestionBumps}`);
  if (!gates.answer_bump_count_within_max) blockingReasons.push(`predicted answer bumps ${totalAnswerBumps} exceed --max-answer-bumps ${maxAnswerBumps}`);
  if (!gates.snapshot_complete) blockingReasons.push(`${completenessViolations.length} snapshot completeness violation(s)`);

  const planIsApplyable = Object.values(gates).every(Boolean);

  return {
    options: {
      questionAllowlist,
      answerAllowlist,
      maxQuestionBumps,
      maxAnswerBumps,
    },
    questions: questionRows,
    answers: answerRows,
    expectedQuestionBumpIds,
    unexpectedQuestionBumpIds,
    missingExpectedQuestionIds,
    expectedAnswerBumpIds,
    unexpectedAnswerBumpIds,
    missingExpectedAnswerIds,
    nullBaselineRows,
    parityFailures,
    completenessViolations,
    counts: {
      predicted_question_bumps: totalQuestionBumps,
      predicted_answer_bumps: totalAnswerBumps,
      predicted_active_question_reviews_invalidated: impact.summary.active_question_reviews_affected,
      predicted_active_answer_reviews_invalidated: impact.summary.active_answer_reviews_affected,
      predicted_question_overrides_invalidated: impact.summary.question_overrides_invalidated,
      predicted_answer_overrides_invalidated: impact.summary.answer_overrides_invalidated,
      review_counts_known: impact.summary.review_counts_known,
    },
    gates,
    blockingReasons,
    planIsApplyable,
  };
}

// ---------------------------------------------------------------------------
// post-apply validation — compare the RPC result (and an optional post-apply
// oracle re-export) against the approved plan
// ---------------------------------------------------------------------------
export function validatePostApply({ plan, rpcResult, preOracle, postOracle } = {}) {
  if (!plan || typeof plan !== "object") throw new TypeError("validatePostApply: `plan` is required");
  if (!rpcResult || typeof rpcResult !== "object") throw new TypeError("validatePostApply: `rpcResult` is required");
  const failures = [];

  const reportedQ = Number(rpcResult.question_versions_changed);
  const reportedA = Number(rpcResult.answer_versions_changed);
  const expectedQ = plan.expectedQuestionBumpIds.length;
  const expectedA = plan.expectedAnswerBumpIds.length;

  if (!Number.isInteger(reportedQ) || reportedQ !== expectedQ) {
    failures.push(`RPC reported question_versions_changed=${rpcResult.question_versions_changed}, plan expected ${expectedQ}`);
  }
  if (!Number.isInteger(reportedA) || reportedA !== expectedA) {
    failures.push(`RPC reported answer_versions_changed=${rpcResult.answer_versions_changed}, plan expected ${expectedA}`);
  }
  if (expectedA === 0 && reportedA !== 0) {
    failures.push(`question-only pilot: RPC reported ${rpcResult.answer_versions_changed} answer version change(s); expected 0`);
  }

  let observedQuestionBumpIds = null;
  let observedAnswerBumpIds = null;
  let observedQuestionChanges = null;
  let observedAnswerChanges = null;

  if (!preOracle || !postOracle) {
    // per-target verification is mandatory for a Production apply
    failures.push("post-apply verification requires BOTH the pre-apply oracle and a fresh --post-oracle export");
  } else {
    const pre = normalizeOracle(preOracle);
    const post = normalizeOracle(postOracle);
    const preQ = new Map(pre.questions.map((r) => [r.question_id, r.source_version]));
    const postQ = new Map(post.questions.map((r) => [r.question_id, r.source_version]));
    const preA = new Map(pre.answers.map((r) => [r.answer_id, r.source_version]));
    const postA = new Map(post.answers.map((r) => [r.answer_id, r.source_version]));

    // every target that appears in either export, in case one side inserted/removed a row
    const allQ = new Set([...preQ.keys(), ...postQ.keys()]);
    const allA = new Set([...preA.keys(), ...postA.keys()]);

    observedQuestionChanges = [...allQ]
      .filter((id) => (preQ.get(id) ?? null) !== (postQ.get(id) ?? null))
      .sort()
      .map((id) => ({ id, old: preQ.get(id) ?? null, new: postQ.get(id) ?? null }));
    observedAnswerChanges = [...allA]
      .filter((id) => (preA.get(id) ?? null) !== (postA.get(id) ?? null))
      .sort()
      .map((id) => ({ id, old: preA.get(id) ?? null, new: postA.get(id) ?? null }));
    observedQuestionBumpIds = observedQuestionChanges.map((c) => c.id);
    observedAnswerBumpIds = observedAnswerChanges.map((c) => c.id);

    // 1. every observed change must be an allowlisted target
    const expQ = new Set(plan.expectedQuestionBumpIds);
    const expA = new Set(plan.expectedAnswerBumpIds);
    for (const c of observedQuestionChanges) {
      if (!expQ.has(c.id)) failures.push(`question ${c.id} source_version changed (${c.old} -> ${c.new}) but is NOT in the approved allowlist`);
    }
    for (const c of observedAnswerChanges) {
      if (!expA.has(c.id)) failures.push(`answer ${c.id} source_version changed (${c.old} -> ${c.new}) but is NOT in the approved allowlist`);
    }
    // 2. every allowlisted target must have actually changed, old -> new
    for (const id of plan.expectedQuestionBumpIds) {
      const c = observedQuestionChanges.find((x) => x.id === id);
      if (!c) failures.push(`allowlisted question ${id} did NOT change source_version`);
      else if (c.old != null && c.old === c.new) failures.push(`allowlisted question ${id} source_version unchanged (${c.old})`);
    }
    for (const id of plan.expectedAnswerBumpIds) {
      const c = observedAnswerChanges.find((x) => x.id === id);
      if (!c) failures.push(`allowlisted answer ${id} did NOT change source_version`);
      else if (c.old != null && c.old === c.new) failures.push(`allowlisted answer ${id} source_version unchanged (${c.old})`);
    }
    // 3. RPC-reported counts must match the observed post-oracle changes
    if (Number.isInteger(reportedQ) && reportedQ !== observedQuestionChanges.length) {
      failures.push(`RPC question_versions_changed=${reportedQ} but the fresh post-oracle shows ${observedQuestionChanges.length} question source_version change(s)`);
    }
    if (Number.isInteger(reportedA) && reportedA !== observedAnswerChanges.length) {
      failures.push(`RPC answer_versions_changed=${reportedA} but the fresh post-oracle shows ${observedAnswerChanges.length} answer source_version change(s)`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    reported: { question_versions_changed: reportedQ, answer_versions_changed: reportedA },
    expected: { question_versions_changed: expectedQ, answer_versions_changed: expectedA },
    observedQuestionBumpIds,
    observedAnswerBumpIds,
    observedQuestionChanges,
    observedAnswerChanges,
  };
}
