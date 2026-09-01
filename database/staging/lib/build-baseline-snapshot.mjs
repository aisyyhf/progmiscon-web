// Progmiscon — canonical Master Data baseline snapshot builder.
//
// This module is the single source of truth for the values that
// public.sync_master_relation_baselines_v2(jsonb, jsonb, text[]) consumes:
//
//   * the per-row `source_fingerprint` string, and
//   * the normalized `misconception_ids` array
//
// It is imported by BOTH:
//   * database/staging/seed-baselines.mjs      (the staging seeder / applier)
//   * scripts/preview-baseline-sync-impact.mjs (the read-only impact preflight)
//
// so that a preview and a real seed can never disagree about which rows change.
//
// PURE MODULE: no I/O, no network, no process/env access, no Supabase client.
// Everything here is a deterministic transform of already-parsed CSV rows.
//
// ---------------------------------------------------------------------------
// FINGERPRINT DESIGN (source_fingerprint) — unchanged from the original
// seed-baselines.mjs implementation.
//
//   Value: lowercase hex SHA-256 of a canonical JSON string.
//
//   Question row canonical object:
//     { "k": "question",
//       "question_id": <trimmed>,
//       "misconception_ids": <normalized: trim each, drop blanks, dedupe, sort ascending>,
//       "question_ind": <canonical text or null>,
//       "question_en":  <canonical text or null>,
//       "question_code":<canonical text or null> }
//
//   Answer row canonical object:
//     { "k": "answer",
//       "answer_id": <trimmed>,
//       "question_id": <trimmed>,
//       "misconception_ids": <normalized as above>,
//       "answer_text": <canonical text or null> }
//
//   Text canonicalization: Unicode NFC, CRLF/CR -> LF, strip a UTF-8 BOM,
//   trim leading/trailing whitespace; empty -> null.
//   JSON: keys emitted in the fixed order shown above; arrays already sorted;
//   JSON.stringify with no spaces. Same input bytes => same fingerprint on any
//   machine and any run.
// ---------------------------------------------------------------------------

import { createHash } from "node:crypto";

// ---------------------------------------------------------------------------
// tiny CSV reader (no external dependency; master sheets are simple CSV)
// ---------------------------------------------------------------------------
export function parseCsv(text) {
  const rows = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      record.push(field); field = "";
      if (record.length > 1 || record[0] !== "") rows.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || record.length > 0) { record.push(field); rows.push(record); }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = r[idx] ?? ""; });
    return obj;
  });
}

// ---------------------------------------------------------------------------
// canonicalization primitives
// ---------------------------------------------------------------------------
export function canonText(value) {
  if (value === undefined || value === null) return null;
  const s = String(value)
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .trim();
  return s.length === 0 ? null : s;
}

export function normalizeIds(ids) {
  return [...new Set(ids.map((x) => String(x).trim()).filter((x) => x.length > 0))]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

export function fingerprint(canonicalObject) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalObject), "utf8")
    .digest("hex");
}

export function isTruthyActive(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "" || v === "1" || v === "true" || v === "yes" || v === "y" || v === "active";
}

export function pick(row, ...names) {
  for (const n of names) {
    if (row[n] !== undefined && String(row[n]).trim() !== "") return String(row[n]).trim();
  }
  return "";
}

// ---------------------------------------------------------------------------
// canonical-object builders (the exact objects that get hashed)
// ---------------------------------------------------------------------------
export function buildQuestionCanonical({
  questionId,
  misconceptionIds,
  questionInd,
  questionEn,
  questionCode,
}) {
  return {
    k: "question",
    question_id: questionId,
    misconception_ids: normalizeIds(misconceptionIds ?? []),
    question_ind: questionInd ?? null,
    question_en: questionEn ?? null,
    question_code: questionCode ?? null,
  };
}

export function buildAnswerCanonical({
  answerId,
  questionId,
  misconceptionIds,
  answerText,
}) {
  return {
    k: "answer",
    answer_id: answerId,
    question_id: questionId,
    misconception_ids: normalizeIds(misconceptionIds ?? []),
    answer_text: answerText ?? null,
  };
}

// ---------------------------------------------------------------------------
// snapshot builder
//
// Input: the five already-parsed Master Data tables (arrays of header->value
// row objects), exactly as seed-baselines.mjs loads them.
//
// Output:
//   {
//     misconceptionIds: string[],
//     questionBaselines: [{ question_id, misconception_ids, source_fingerprint }],
//     answerBaselines:   [{ answer_id, question_id, misconception_ids, source_fingerprint }],
//     questionCanonicals: Map<question_id, canonicalObject>,
//     answerCanonicals:   Map<answer_id,   canonicalObject>,
//   }
//
// `questionBaselines` / `answerBaselines` are byte-for-byte what the seeder
// sends to sync_master_relation_baselines_v2. The `*Canonicals` maps are the
// pre-hash objects, exposed so the preflight can explain which field moved.
// ---------------------------------------------------------------------------
export function buildBaselineSnapshot({
  questions = [],
  answers = [],
  questionMisconceptions = [],
  answerMisconceptions = [],
  misconceptions = [],
} = {}) {
  const misconceptionIds = normalizeIds(
    misconceptions.map((m) => pick(m, "misconception_id", "id", "kode", "code")),
  );
  const misconceptionSet = new Set(misconceptionIds);

  const activeQuestionIds = new Set(
    questions
      .filter((q) => isTruthyActive(q.active ?? q.is_active))
      .map((q) => pick(q, "question_id", "id"))
      .filter(Boolean),
  );

  const questionMiscMap = new Map();
  for (const rel of questionMisconceptions) {
    const qid = pick(rel, "question_id");
    const mid = pick(rel, "misconception_id");
    if (!activeQuestionIds.has(qid) || !misconceptionSet.has(mid)) continue;
    if (!isTruthyActive(rel.active ?? rel.is_active)) continue;
    if (!questionMiscMap.has(qid)) questionMiscMap.set(qid, []);
    questionMiscMap.get(qid).push(mid);
  }

  const answerParent = new Map();
  for (const a of answers) {
    const aid = pick(a, "answer_id", "id");
    const qid = pick(a, "question_id");
    if (!aid || !activeQuestionIds.has(qid)) continue;
    if (!isTruthyActive(a.active ?? a.is_active)) continue;
    answerParent.set(aid, {
      questionId: qid,
      text: canonText(pick(a, "answer_text", "text", "jawaban")),
    });
  }

  const answerMiscMap = new Map();
  for (const rel of answerMisconceptions) {
    const aid = pick(rel, "answer_id");
    const mid = pick(rel, "misconception_id");
    if (!answerParent.has(aid) || !misconceptionSet.has(mid)) continue;
    if (!isTruthyActive(rel.active ?? rel.is_active)) continue;
    if (!answerMiscMap.has(aid)) answerMiscMap.set(aid, []);
    answerMiscMap.get(aid).push(mid);
  }

  const questionContent = new Map(
    questions.map((q) => [
      pick(q, "question_id", "id"),
      {
        ind: canonText(pick(q, "question_ind", "soal_ind", "pertanyaan_ind")),
        en: canonText(pick(q, "question_en", "soal_en", "pertanyaan_en")),
        code: canonText(pick(q, "question_code", "kode", "pseudocode")),
      },
    ]),
  );

  const questionCanonicals = new Map();
  const questionBaselines = [...activeQuestionIds].sort().map((questionId) => {
    const ids = normalizeIds(questionMiscMap.get(questionId) ?? []);
    const content = questionContent.get(questionId) ?? { ind: null, en: null, code: null };
    const canonical = buildQuestionCanonical({
      questionId,
      misconceptionIds: ids,
      questionInd: content.ind,
      questionEn: content.en,
      questionCode: content.code,
    });
    questionCanonicals.set(questionId, canonical);
    return {
      question_id: questionId,
      misconception_ids: ids,
      source_fingerprint: fingerprint(canonical),
    };
  });

  const answerCanonicals = new Map();
  const answerBaselines = [...answerParent.keys()].sort().map((answerId) => {
    const parent = answerParent.get(answerId);
    const ids = normalizeIds(answerMiscMap.get(answerId) ?? []);
    const canonical = buildAnswerCanonical({
      answerId,
      questionId: parent.questionId,
      misconceptionIds: ids,
      answerText: parent.text,
    });
    answerCanonicals.set(answerId, canonical);
    return {
      answer_id: answerId,
      question_id: parent.questionId,
      misconception_ids: ids,
      source_fingerprint: fingerprint(canonical),
    };
  });

  return {
    misconceptionIds,
    questionBaselines,
    answerBaselines,
    questionCanonicals,
    answerCanonicals,
  };
}
