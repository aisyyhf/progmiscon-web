// Pure diff engine for the read-only Master Data sync impact preflight.
//
// Given:
//   * `proposed` — a buildBaselineSnapshot() result for the candidate Master
//     Data (the edit you are about to sync),
//   * `current`  — an optional buildBaselineSnapshot() result for Master Data
//     as it stands right now (a frozen export taken before editing), used only
//     to name which canonical field moved, and
//   * `baselineState` — an optional read-only snapshot of the live
//     *_misconception_baselines rows (+ active review counts + override
//     presence), used as the authoritative "previous" state exactly the way
//     sync_master_relation_baselines_v2 reads it,
//
// this module reproduces the v2 bump decision and reports the impact. It makes
// no I/O and no network calls.
//
// v2 bump rule (public.sync_master_relation_baselines_v2, staging-bootstrap.sql):
//   question bumps IF  previous.source_fingerprint  != incoming.source_fingerprint
//                  OR  previous.misconception_ids   != incoming.misconception_ids
//                  OR  question is absent from the incoming active snapshot
//   answer  bumps IF  previous.source_fingerprint  != incoming.source_fingerprint
//                  OR  previous.misconception_ids   != incoming.misconception_ids
//                  OR  previous.question_id         != incoming.question_id
//                  OR  answer is absent from the incoming active snapshot
//   a brand-new target is inserted with a fresh source_version (treated here as
//   would_bump = true, status NEW, 0 reviews affected).

import { normalizeIds } from "../../database/staging/lib/build-baseline-snapshot.mjs";

function idsEqual(a, b) {
  const left = normalizeIds(a ?? []);
  const right = normalizeIds(b ?? []);
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

function baselineMapFromState(entries, idKey) {
  const map = new Map();
  for (const row of entries ?? []) {
    const id = String(row[idKey] ?? "").trim();
    if (!id) continue;
    map.set(id, {
      source_version: row.source_version ?? null,
      source_fingerprint: row.source_fingerprint ?? null,
      question_id: row.question_id != null ? String(row.question_id).trim() : undefined,
      misconception_ids: normalizeIds(row.misconception_ids ?? []),
      active_review_count:
        row.active_review_count == null ? null : Number(row.active_review_count),
      override_exists: row.override_exists === true,
    });
  }
  return map;
}

function questionFieldDiff(currentCanonical, proposedCanonical) {
  if (!currentCanonical || !proposedCanonical) return null;
  const fields = [];
  for (const key of ["question_ind", "question_en", "question_code"]) {
    if ((currentCanonical[key] ?? null) !== (proposedCanonical[key] ?? null)) fields.push(key);
  }
  if (!idsEqual(currentCanonical.misconception_ids, proposedCanonical.misconception_ids)) {
    fields.push("misconception_ids");
  }
  return fields;
}

function answerFieldDiff(currentCanonical, proposedCanonical) {
  if (!currentCanonical || !proposedCanonical) return null;
  const fields = [];
  if ((currentCanonical.answer_text ?? null) !== (proposedCanonical.answer_text ?? null)) {
    fields.push("answer_text");
  }
  if (!idsEqual(currentCanonical.misconception_ids, proposedCanonical.misconception_ids)) {
    fields.push("misconception_ids");
  }
  if ((currentCanonical.question_id ?? null) !== (proposedCanonical.question_id ?? null)) {
    fields.push("question_id");
  }
  return fields;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
export function computeBaselineSyncImpact({ proposed, current = null, baselineState = null } = {}) {
  if (!proposed || !Array.isArray(proposed.questionBaselines)) {
    throw new Error("computeBaselineSyncImpact: `proposed` must be a buildBaselineSnapshot() result.");
  }

  const dbQuestions = baselineState
    ? baselineMapFromState(baselineState.questions, "question_id")
    : null;
  const dbAnswers = baselineState ? baselineMapFromState(baselineState.answers, "answer_id") : null;

  let previousSource;
  if (dbQuestions) previousSource = "db";
  else if (current) previousSource = "snapshot";
  else {
    throw new Error(
      "computeBaselineSyncImpact: provide `baselineState` (live baseline rows) or `current` (frozen snapshot) as the previous state.",
    );
  }

  const currentQuestionFp = new Map(
    (current?.questionBaselines ?? []).map((q) => [q.question_id, q]),
  );
  const currentAnswerFp = new Map((current?.answerBaselines ?? []).map((a) => [a.answer_id, a]));

  const driftWarnings = [];

  // ---- questions -----------------------------------------------------------
  const questionRows = [];
  const proposedQuestionIds = new Set();

  for (const incoming of proposed.questionBaselines) {
    proposedQuestionIds.add(incoming.question_id);
    const proposedCanonical = proposed.questionCanonicals?.get(incoming.question_id) ?? null;

    const prevDb = dbQuestions?.get(incoming.question_id) ?? null;
    const prevSnap = currentQuestionFp.get(incoming.question_id) ?? null;
    const prev =
      previousSource === "db"
        ? prevDb
          ? {
              source_version: prevDb.source_version,
              source_fingerprint: prevDb.source_fingerprint,
              misconception_ids: prevDb.misconception_ids,
              active_review_count: prevDb.active_review_count,
              override_exists: prevDb.override_exists,
            }
          : null
        : prevSnap
          ? {
              source_version: null,
              source_fingerprint: prevSnap.source_fingerprint,
              misconception_ids: prevSnap.misconception_ids,
              active_review_count: null,
              override_exists: false,
            }
          : null;

    if (!prev) {
      questionRows.push({
        id: incoming.question_id,
        target: "question",
        status: "NEW",
        changed_fields: ["(new question — inserted with a fresh source_version)"],
        current_source_version: null,
        would_bump: true,
        active_reviews_affected: 0,
        override_invalidated: false,
      });
      continue;
    }

    // drift: frozen "current" snapshot disagrees with the live baseline row
    if (previousSource === "db" && prevSnap) {
      if (
        prevSnap.source_fingerprint !== prevDb.source_fingerprint ||
        !idsEqual(prevSnap.misconception_ids, prevDb.misconception_ids)
      ) {
        driftWarnings.push(
          `${incoming.question_id}: frozen --current snapshot does not match the live baseline row; ` +
            "bump decision uses the live baseline (authoritative), field list may be partial.",
        );
      }
    }

    const fpChanged = prev.source_fingerprint !== incoming.source_fingerprint;
    const idsChanged = !idsEqual(prev.misconception_ids, incoming.misconception_ids);
    const wouldBump = fpChanged || idsChanged;

    let changedFields = questionFieldDiff(
      currentQuestionCanonical(current, incoming.question_id),
      proposedCanonical,
    );
    if (changedFields == null) {
      changedFields = [];
      if (idsChanged) changedFields.push("misconception_ids");
      if (fpChanged && !idsChanged) {
        changedFields.push("(question_ind, question_en and/or question_code — provide --current to pinpoint)");
      }
    }

    questionRows.push({
      id: incoming.question_id,
      target: "question",
      status: wouldBump ? "CHANGED" : "UNCHANGED",
      changed_fields: changedFields,
      current_source_version: prev.source_version,
      would_bump: wouldBump,
      active_reviews_affected: wouldBump ? prev.active_review_count : 0,
      override_invalidated: wouldBump && prev.override_exists === true,
    });
  }

  // removed questions (present in previous state, gone from incoming snapshot)
  const previousQuestionIds =
    previousSource === "db"
      ? [...dbQuestions.keys()]
      : [...currentQuestionFp.keys()];
  for (const removedId of previousQuestionIds) {
    if (proposedQuestionIds.has(removedId)) continue;
    const prevDb = dbQuestions?.get(removedId) ?? null;
    questionRows.push({
      id: removedId,
      target: "question",
      status: "REMOVED",
      changed_fields: ["(no longer in the active Master Data snapshot)"],
      current_source_version: prevDb?.source_version ?? null,
      would_bump: true,
      active_reviews_affected: prevDb ? prevDb.active_review_count : null,
      override_invalidated: prevDb?.override_exists === true,
    });
  }

  // ---- answers ------------------------------------------------------------
  const answerRows = [];
  const proposedAnswerIds = new Set();

  for (const incoming of proposed.answerBaselines) {
    proposedAnswerIds.add(incoming.answer_id);
    const proposedCanonical = proposed.answerCanonicals?.get(incoming.answer_id) ?? null;

    const prevDb = dbAnswers?.get(incoming.answer_id) ?? null;
    const prevSnap = currentAnswerFp.get(incoming.answer_id) ?? null;
    const prev =
      previousSource === "db"
        ? prevDb
          ? {
              source_version: prevDb.source_version,
              source_fingerprint: prevDb.source_fingerprint,
              misconception_ids: prevDb.misconception_ids,
              question_id: prevDb.question_id ?? null,
              active_review_count: prevDb.active_review_count,
              override_exists: prevDb.override_exists,
            }
          : null
        : prevSnap
          ? {
              source_version: null,
              source_fingerprint: prevSnap.source_fingerprint,
              misconception_ids: prevSnap.misconception_ids,
              question_id: prevSnap.question_id ?? null,
              active_review_count: null,
              override_exists: false,
            }
          : null;

    if (!prev) {
      answerRows.push({
        id: incoming.answer_id,
        target: "answer",
        parent_question_id: incoming.question_id,
        status: "NEW",
        changed_fields: ["(new answer — inserted with a fresh source_version)"],
        current_source_version: null,
        would_bump: true,
        active_reviews_affected: 0,
        override_invalidated: false,
      });
      continue;
    }

    const fpChanged = prev.source_fingerprint !== incoming.source_fingerprint;
    const idsChanged = !idsEqual(prev.misconception_ids, incoming.misconception_ids);
    const parentChanged =
      prev.question_id != null && prev.question_id !== incoming.question_id;
    const wouldBump = fpChanged || idsChanged || parentChanged;

    let changedFields = answerFieldDiff(
      currentAnswerCanonical(current, incoming.answer_id),
      proposedCanonical,
    );
    if (changedFields == null) {
      changedFields = [];
      if (idsChanged) changedFields.push("misconception_ids");
      if (parentChanged) changedFields.push("question_id");
      if (fpChanged && !idsChanged && !parentChanged) {
        changedFields.push("(answer_text — provide --current to pinpoint)");
      }
    } else if (parentChanged && !changedFields.includes("question_id")) {
      changedFields.push("question_id");
    }

    answerRows.push({
      id: incoming.answer_id,
      target: "answer",
      parent_question_id: incoming.question_id,
      status: wouldBump ? "CHANGED" : "UNCHANGED",
      changed_fields: changedFields,
      current_source_version: prev.source_version,
      would_bump: wouldBump,
      active_reviews_affected: wouldBump ? prev.active_review_count : 0,
      override_invalidated: wouldBump && prev.override_exists === true,
    });
  }

  const previousAnswerIds =
    previousSource === "db" ? [...dbAnswers.keys()] : [...currentAnswerFp.keys()];
  for (const removedId of previousAnswerIds) {
    if (proposedAnswerIds.has(removedId)) continue;
    const prevDb = dbAnswers?.get(removedId) ?? null;
    answerRows.push({
      id: removedId,
      target: "answer",
      parent_question_id: prevDb?.question_id ?? null,
      status: "REMOVED",
      changed_fields: ["(no longer in the active Master Data snapshot)"],
      current_source_version: prevDb?.source_version ?? null,
      would_bump: true,
      active_reviews_affected: prevDb ? prevDb.active_review_count : null,
      override_invalidated: prevDb?.override_exists === true,
    });
  }

  // ---- ordering + summary ------------------------------------------------
  const statusRank = { CHANGED: 0, REMOVED: 1, NEW: 2, UNCHANGED: 3 };
  const order = (a, b) =>
    statusRank[a.status] - statusRank[b.status] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  questionRows.sort(order);
  answerRows.sort(order);

  const changedQuestions = questionRows.filter((r) => r.status !== "UNCHANGED");
  const changedAnswers = answerRows.filter((r) => r.status !== "UNCHANGED");
  const sumReviews = (rows) =>
    rows.reduce((total, r) => total + (r.would_bump ? Number(r.active_reviews_affected) || 0 : 0), 0);

  return {
    questions: questionRows,
    answers: answerRows,
    summary: {
      previous_state: previousSource,
      questions_changed: changedQuestions.length,
      questions_bumping: changedQuestions.filter((r) => r.would_bump).length,
      active_question_reviews_affected: sumReviews(changedQuestions),
      question_overrides_invalidated: changedQuestions.filter((r) => r.override_invalidated).length,
      answers_changed: changedAnswers.length,
      answers_bumping: changedAnswers.filter((r) => r.would_bump).length,
      active_answer_reviews_affected: sumReviews(changedAnswers),
      answer_overrides_invalidated: changedAnswers.filter((r) => r.override_invalidated).length,
      review_counts_known: previousSource === "db",
      drift_warnings: driftWarnings,
    },
  };
}

function currentQuestionCanonical(current, questionId) {
  return current?.questionCanonicals?.get(questionId) ?? null;
}
function currentAnswerCanonical(current, answerId) {
  return current?.answerCanonicals?.get(answerId) ?? null;
}
