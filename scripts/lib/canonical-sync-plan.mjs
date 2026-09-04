// Pure planning engine for a canonical Master Data sync to Production. NO I/O,
// NO network, NO Supabase client. Deterministic transform of already-parsed
// inputs.
//
// It answers, before any mutation: "if I sync this proposed snapshot against
// this Production baseline state, exactly which question / answer baselines
// would have their canonical content refreshed, is that the approved set, and
// would anything rotate a source_version (which would deactivate reviews)?"
//
// Since 20260904000000_canonical_sync_keep_reviews_active.sql, ordinary content
// / misconception drift for an existing target refreshes source_fingerprint and
// the baseline content but does NOT rotate source_version and does NOT touch any
// review or override. So the allowlist here gates CONTENT CHANGES: the operator
// still declares exactly which questions they are editing and the plan fails
// closed on any drift outside that set, or any allowlisted id that does not
// actually drift.
//
// A source_version rotation still happens for a NEW target, a REMOVED target or
// a REPARENTED answer, and those still deactivate reviews. The plan treats ANY
// such rotation as a hard blocker: a canonical content edit must never rotate a
// version.
//
// The bump/drift prediction reuses computeBaselineSyncImpact(), which models the
// deployed sync_master_relation_baselines_v2 exactly.
//
// canonical-sync-plan adds the fail-closed gates required for a Production
// canonical edit:
//   * FULL fingerprint parity between the frozen "current" (unedited) snapshot
//     and the Production baseline oracle — proves build-baseline-snapshot.mjs
//     reproduces the values Production already stores (blocker E1);
//   * ZERO NULL-baseline rows (NULL source_version / source_fingerprint) — the
//     tool reports them and stops; it NEVER silently reconciles them (E2);
//   * exact question CONTENT-CHANGE allowlist match;
//   * ZERO answer content changes for a question-only pilot (answerAllowlist
//     defaults to []);
//   * a maximum content-change count for questions and answers;
//   * ZERO source_version rotations (NEW / REMOVED / REPARENTED) — a content
//     edit must not rotate a version;
//   * snapshot completeness — the proposed snapshot must not silently drop or
//     add an active question / answer.

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
// completeness: proposed snapshot must not silently drop / add an active target
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
    if (!curQ.has(id)) violations.push({ target_type: "question", target_id: id, reason: "in the proposed snapshot, not in the current snapshot (a content edit must not add questions)" });
  }
  for (const id of propA) {
    if (!curA.has(id)) violations.push({ target_type: "answer", target_id: id, reason: "in the proposed snapshot, not in the current snapshot (a content edit must not add answers)" });
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
  const maxQuestionContentChanges = Number.isInteger(options.maxQuestionContentChanges)
    ? options.maxQuestionContentChanges
    : Number.isInteger(options.maxQuestionBumps)
      ? options.maxQuestionBumps
      : questionAllowlist.length;
  const maxAnswerContentChanges = Number.isInteger(options.maxAnswerContentChanges)
    ? options.maxAnswerContentChanges
    : Number.isInteger(options.maxAnswerBumps)
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

  const classify = (row, allow) => {
    if (row.version_rotates) return "VERSION_ROTATION";
    if (row.content_changed) return allow.has(row.id) ? "EXPECTED_CONTENT_CHANGE" : "UNEXPECTED_CONTENT_CHANGE";
    return allow.has(row.id) ? "MISSING_EXPECTED_CONTENT_CHANGE" : "UNCHANGED";
  };

  const questionRows = impact.questions.map((row) => ({
    id: row.id,
    status: row.status,
    content_changed: row.content_changed,
    version_rotates: row.version_rotates,
    would_bump: row.would_bump,
    in_allowlist: qAllow.has(row.id),
    current_source_version: row.current_source_version,
    active_reviews_affected: row.active_reviews_affected,
    override_invalidated: row.override_invalidated,
    changed_fields: row.changed_fields,
    classification: classify(row, qAllow),
  }));
  const answerRows = impact.answers.map((row) => ({
    id: row.id,
    parent_question_id: row.parent_question_id,
    status: row.status,
    content_changed: row.content_changed,
    version_rotates: row.version_rotates,
    would_bump: row.would_bump,
    in_allowlist: aAllow.has(row.id),
    current_source_version: row.current_source_version,
    active_reviews_affected: row.active_reviews_affected,
    override_invalidated: row.override_invalidated,
    changed_fields: row.changed_fields,
    classification: classify(row, aAllow),
  }));

  const idsWhere = (rows, klass) => rows.filter((r) => r.classification === klass).map((r) => r.id).sort();

  const expectedQuestionContentChangeIds = idsWhere(questionRows, "EXPECTED_CONTENT_CHANGE");
  const unexpectedQuestionContentChangeIds = idsWhere(questionRows, "UNEXPECTED_CONTENT_CHANGE");
  const missingExpectedQuestionContentChangeIds = idsWhere(questionRows, "MISSING_EXPECTED_CONTENT_CHANGE");
  const expectedAnswerContentChangeIds = idsWhere(answerRows, "EXPECTED_CONTENT_CHANGE");
  const unexpectedAnswerContentChangeIds = idsWhere(answerRows, "UNEXPECTED_CONTENT_CHANGE");
  const missingExpectedAnswerContentChangeIds = idsWhere(answerRows, "MISSING_EXPECTED_CONTENT_CHANGE");

  const questionVersionRotationIds = questionRows.filter((r) => r.version_rotates).map((r) => r.id).sort();
  const answerVersionRotationIds = answerRows.filter((r) => r.version_rotates).map((r) => r.id).sort();

  const parityFailures = checkParity(current, oracleQuestions, oracleAnswers);
  const completenessViolations = checkCompleteness(
    current,
    proposed,
    oracleQuestions,
    oracleAnswers,
  );

  const totalQuestionContentChanges =
    expectedQuestionContentChangeIds.length + unexpectedQuestionContentChangeIds.length;
  const totalAnswerContentChanges =
    expectedAnswerContentChangeIds.length + unexpectedAnswerContentChangeIds.length;

  const gates = {
    parity_clean: parityFailures.length === 0,
    zero_null_baseline_rows: nullBaselineRows.length === 0,
    question_content_allowlist_exact:
      unexpectedQuestionContentChangeIds.length === 0 &&
      missingExpectedQuestionContentChangeIds.length === 0,
    answer_content_allowlist_exact:
      unexpectedAnswerContentChangeIds.length === 0 &&
      missingExpectedAnswerContentChangeIds.length === 0,
    question_content_change_count_within_max:
      totalQuestionContentChanges <= maxQuestionContentChanges,
    answer_content_change_count_within_max:
      totalAnswerContentChanges <= maxAnswerContentChanges,
    zero_version_rotations:
      questionVersionRotationIds.length === 0 && answerVersionRotationIds.length === 0,
    snapshot_complete: completenessViolations.length === 0,
  };
  const blockingReasons = [];
  if (!gates.parity_clean) blockingReasons.push(`fingerprint parity failed for ${parityFailures.length} target(s)`);
  if (!gates.zero_null_baseline_rows) blockingReasons.push(`${nullBaselineRows.length} Production baseline row(s) have a NULL source_version/source_fingerprint`);
  if (unexpectedQuestionContentChangeIds.length) blockingReasons.push(`${unexpectedQuestionContentChangeIds.length} question content change(s) outside the allowlist: ${unexpectedQuestionContentChangeIds.join(", ")}`);
  if (missingExpectedQuestionContentChangeIds.length) blockingReasons.push(`${missingExpectedQuestionContentChangeIds.length} allowlisted question(s) show NO content change: ${missingExpectedQuestionContentChangeIds.join(", ")}`);
  if (unexpectedAnswerContentChangeIds.length) blockingReasons.push(`${unexpectedAnswerContentChangeIds.length} answer content change(s) outside the allowlist: ${unexpectedAnswerContentChangeIds.join(", ")}`);
  if (missingExpectedAnswerContentChangeIds.length) blockingReasons.push(`${missingExpectedAnswerContentChangeIds.length} allowlisted answer(s) show NO content change: ${missingExpectedAnswerContentChangeIds.join(", ")}`);
  if (!gates.question_content_change_count_within_max) blockingReasons.push(`predicted question content changes ${totalQuestionContentChanges} exceed --max-question-changes ${maxQuestionContentChanges}`);
  if (!gates.answer_content_change_count_within_max) blockingReasons.push(`predicted answer content changes ${totalAnswerContentChanges} exceed --max-answer-changes ${maxAnswerContentChanges}`);
  if (!gates.zero_version_rotations) blockingReasons.push(`${questionVersionRotationIds.length + answerVersionRotationIds.length} target(s) would ROTATE source_version (new / removed / re-parented) and deactivate reviews: ${[...questionVersionRotationIds, ...answerVersionRotationIds].join(", ")}`);
  if (!gates.snapshot_complete) blockingReasons.push(`${completenessViolations.length} snapshot completeness violation(s)`);

  const planIsApplyable = Object.values(gates).every(Boolean);

  return {
    options: {
      questionAllowlist,
      answerAllowlist,
      maxQuestionContentChanges,
      maxAnswerContentChanges,
    },
    questions: questionRows,
    answers: answerRows,
    expectedQuestionContentChangeIds,
    unexpectedQuestionContentChangeIds,
    missingExpectedQuestionContentChangeIds,
    expectedAnswerContentChangeIds,
    unexpectedAnswerContentChangeIds,
    missingExpectedAnswerContentChangeIds,
    questionVersionRotationIds,
    answerVersionRotationIds,
    nullBaselineRows,
    parityFailures,
    completenessViolations,
    counts: {
      predicted_question_content_changes: totalQuestionContentChanges,
      predicted_answer_content_changes: totalAnswerContentChanges,
      predicted_version_rotations:
        questionVersionRotationIds.length + answerVersionRotationIds.length,
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
// oracle re-export) against the approved plan.
//
// A canonical content edit must land EXACTLY as: the approved question / answer
// source_fingerprints move, NO source_version rotates anywhere, and the RPC
// reports zero version changes.
// ---------------------------------------------------------------------------
export function validatePostApply({ plan, rpcResult, preOracle, postOracle } = {}) {
  if (!plan || typeof plan !== "object") throw new TypeError("validatePostApply: `plan` is required");
  if (!rpcResult || typeof rpcResult !== "object") throw new TypeError("validatePostApply: `rpcResult` is required");
  const failures = [];

  const reportedQ = Number(rpcResult.question_versions_changed);
  const reportedA = Number(rpcResult.answer_versions_changed);

  // A content edit rotates nothing: the RPC's version-change counters must be 0.
  if (!Number.isInteger(reportedQ) || reportedQ !== 0) {
    failures.push(`RPC reported question_versions_changed=${rpcResult.question_versions_changed}; a canonical content edit must rotate 0 question source_versions`);
  }
  if (!Number.isInteger(reportedA) || reportedA !== 0) {
    failures.push(`RPC reported answer_versions_changed=${rpcResult.answer_versions_changed}; a canonical content edit must rotate 0 answer source_versions`);
  }

  let observedQuestionVersionChanges = null;
  let observedAnswerVersionChanges = null;
  let observedQuestionContentChanges = null;
  let observedAnswerContentChanges = null;

  if (!preOracle || !postOracle) {
    // per-target verification is mandatory for a Production apply
    failures.push("post-apply verification requires BOTH the pre-apply oracle and a fresh --post-oracle export");
  } else {
    const pre = normalizeOracle(preOracle);
    const post = normalizeOracle(postOracle);
    const preQ = new Map(pre.questions.map((r) => [r.question_id, r]));
    const postQ = new Map(post.questions.map((r) => [r.question_id, r]));
    const preA = new Map(pre.answers.map((r) => [r.answer_id, r]));
    const postA = new Map(post.answers.map((r) => [r.answer_id, r]));

    const allQ = new Set([...preQ.keys(), ...postQ.keys()]);
    const allA = new Set([...preA.keys(), ...postA.keys()]);

    const versionOf = (m, id) => (m.get(id)?.source_version ?? null);
    const fingerprintOf = (m, id) => (m.get(id)?.source_fingerprint ?? null);

    observedQuestionVersionChanges = [...allQ]
      .filter((id) => versionOf(preQ, id) !== versionOf(postQ, id))
      .sort()
      .map((id) => ({ id, old: versionOf(preQ, id), new: versionOf(postQ, id) }));
    observedAnswerVersionChanges = [...allA]
      .filter((id) => versionOf(preA, id) !== versionOf(postA, id))
      .sort()
      .map((id) => ({ id, old: versionOf(preA, id), new: versionOf(postA, id) }));
    observedQuestionContentChanges = [...allQ]
      .filter((id) => fingerprintOf(preQ, id) !== fingerprintOf(postQ, id))
      .sort()
      .map((id) => ({ id, old: fingerprintOf(preQ, id), new: fingerprintOf(postQ, id) }));
    observedAnswerContentChanges = [...allA]
      .filter((id) => fingerprintOf(preA, id) !== fingerprintOf(postA, id))
      .sort()
      .map((id) => ({ id, old: fingerprintOf(preA, id), new: fingerprintOf(postA, id) }));

    // 1. nothing may rotate its source_version
    for (const c of observedQuestionVersionChanges) {
      failures.push(`question ${c.id} source_version rotated (${c.old} -> ${c.new}); a canonical content edit must not rotate any version`);
    }
    for (const c of observedAnswerVersionChanges) {
      failures.push(`answer ${c.id} source_version rotated (${c.old} -> ${c.new}); a canonical content edit must not rotate any version`);
    }

    // 2. every observed fingerprint change must be an allowlisted content change
    const expQ = new Set(plan.expectedQuestionContentChangeIds);
    const expA = new Set(plan.expectedAnswerContentChangeIds);
    for (const c of observedQuestionContentChanges) {
      if (!expQ.has(c.id)) failures.push(`question ${c.id} source_fingerprint changed (${c.old} -> ${c.new}) but is NOT in the approved allowlist`);
    }
    for (const c of observedAnswerContentChanges) {
      if (!expA.has(c.id)) failures.push(`answer ${c.id} source_fingerprint changed (${c.old} -> ${c.new}) but is NOT in the approved allowlist`);
    }
    // 3. every allowlisted content change must have actually landed, old -> new,
    //    with the source_version held stable
    for (const id of plan.expectedQuestionContentChangeIds) {
      const c = observedQuestionContentChanges.find((x) => x.id === id);
      if (!c) failures.push(`allowlisted question ${id} source_fingerprint did NOT change`);
      else if (c.old != null && c.old === c.new) failures.push(`allowlisted question ${id} source_fingerprint unchanged (${c.old})`);
      if (versionOf(preQ, id) != null && versionOf(preQ, id) !== versionOf(postQ, id)) {
        failures.push(`allowlisted question ${id} source_version moved; a content edit must hold it stable`);
      }
    }
    for (const id of plan.expectedAnswerContentChangeIds) {
      const c = observedAnswerContentChanges.find((x) => x.id === id);
      if (!c) failures.push(`allowlisted answer ${id} source_fingerprint did NOT change`);
      else if (c.old != null && c.old === c.new) failures.push(`allowlisted answer ${id} source_fingerprint unchanged (${c.old})`);
      if (versionOf(preA, id) != null && versionOf(preA, id) !== versionOf(postA, id)) {
        failures.push(`allowlisted answer ${id} source_version moved; a content edit must hold it stable`);
      }
    }
    // 4. RPC-reported version counts must match the fresh post-oracle (both 0)
    if (Number.isInteger(reportedQ) && reportedQ !== observedQuestionVersionChanges.length) {
      failures.push(`RPC question_versions_changed=${reportedQ} but the fresh post-oracle shows ${observedQuestionVersionChanges.length} question source_version change(s)`);
    }
    if (Number.isInteger(reportedA) && reportedA !== observedAnswerVersionChanges.length) {
      failures.push(`RPC answer_versions_changed=${reportedA} but the fresh post-oracle shows ${observedAnswerVersionChanges.length} answer source_version change(s)`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    reported: { question_versions_changed: reportedQ, answer_versions_changed: reportedA },
    observedQuestionVersionChanges,
    observedAnswerVersionChanges,
    observedQuestionContentChanges,
    observedAnswerContentChanges,
  };
}
