// Regression guard for the extraction of the canonical fingerprint / snapshot
// logic out of database/staging/seed-baselines.mjs into
// database/staging/lib/build-baseline-snapshot.mjs.
//
// Proves TWO things:
//   1. GOLDEN: buildBaselineSnapshot() emits exact, known SHA-256 fingerprints
//      for a fixed fixture. If the canonical scheme ever changes by accident,
//      this fails.
//   2. EQUIVALENCE: buildBaselineSnapshot() is byte-for-byte identical to a
//      verbatim copy of the pre-refactor seed-baselines.mjs logic, for the RPC
//      payload the seeder sends (questionBaselines / answerBaselines /
//      misconceptionIds). This is the "zero behaviour change" proof.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  parseCsv,
  buildBaselineSnapshot,
} from "../database/staging/lib/build-baseline-snapshot.mjs";

// ---------------------------------------------------------------------------
// verbatim copy of the pre-refactor seed-baselines.mjs snapshot logic
// (git blame: database/staging/seed-baselines.mjs @ 2a196e0, lines 114-297)
// ---------------------------------------------------------------------------
function legacyCanonText(value) {
  if (value === undefined || value === null) return null;
  const s = String(value)
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .trim();
  return s.length === 0 ? null : s;
}
function legacyNormalizeIds(ids) {
  return [...new Set(ids.map((x) => String(x).trim()).filter((x) => x.length > 0))]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
function legacyFingerprint(canonicalObject) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalObject), "utf8")
    .digest("hex");
}
function legacyIsTruthyActive(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "" || v === "1" || v === "true" || v === "yes" || v === "y" || v === "active";
}
function legacyPick(row, ...names) {
  for (const n of names) if (row[n] !== undefined && String(row[n]).trim() !== "") return String(row[n]).trim();
  return "";
}
function legacyBuild({ questions, answers, questionMisc, answerMisc, misconceptions }) {
  const misconceptionIds = legacyNormalizeIds(
    misconceptions.map((m) => legacyPick(m, "misconception_id", "id", "kode", "code")),
  );
  const misconceptionSet = new Set(misconceptionIds);

  const activeQuestionIds = new Set(
    questions
      .filter((q) => legacyIsTruthyActive(q.active ?? q.is_active))
      .map((q) => legacyPick(q, "question_id", "id"))
      .filter(Boolean),
  );

  const questionMiscMap = new Map();
  for (const rel of questionMisc) {
    const qid = legacyPick(rel, "question_id");
    const mid = legacyPick(rel, "misconception_id");
    if (!activeQuestionIds.has(qid) || !misconceptionSet.has(mid)) continue;
    if (!legacyIsTruthyActive(rel.active ?? rel.is_active)) continue;
    if (!questionMiscMap.has(qid)) questionMiscMap.set(qid, []);
    questionMiscMap.get(qid).push(mid);
  }

  const answerParent = new Map();
  for (const a of answers) {
    const aid = legacyPick(a, "answer_id", "id");
    const qid = legacyPick(a, "question_id");
    if (!aid || !activeQuestionIds.has(qid)) continue;
    if (!legacyIsTruthyActive(a.active ?? a.is_active)) continue;
    answerParent.set(aid, { questionId: qid, text: legacyCanonText(legacyPick(a, "answer_text", "text", "jawaban")) });
  }

  const answerMiscMap = new Map();
  for (const rel of answerMisc) {
    const aid = legacyPick(rel, "answer_id");
    const mid = legacyPick(rel, "misconception_id");
    if (!answerParent.has(aid) || !misconceptionSet.has(mid)) continue;
    if (!legacyIsTruthyActive(rel.active ?? rel.is_active)) continue;
    if (!answerMiscMap.has(aid)) answerMiscMap.set(aid, []);
    answerMiscMap.get(aid).push(mid);
  }

  const questionContent = new Map(
    questions.map((q) => [
      legacyPick(q, "question_id", "id"),
      {
        ind: legacyCanonText(legacyPick(q, "question_ind", "soal_ind", "pertanyaan_ind")),
        en: legacyCanonText(legacyPick(q, "question_en", "soal_en", "pertanyaan_en")),
        code: legacyCanonText(legacyPick(q, "question_code", "kode", "pseudocode")),
      },
    ]),
  );

  const questionBaselines = [...activeQuestionIds].sort().map((questionId) => {
    const ids = legacyNormalizeIds(questionMiscMap.get(questionId) ?? []);
    const content = questionContent.get(questionId) ?? { ind: null, en: null, code: null };
    const canonical = {
      k: "question",
      question_id: questionId,
      misconception_ids: ids,
      question_ind: content.ind,
      question_en: content.en,
      question_code: content.code,
    };
    return { question_id: questionId, misconception_ids: ids, source_fingerprint: legacyFingerprint(canonical) };
  });

  const answerBaselines = [...answerParent.keys()].sort().map((answerId) => {
    const parent = answerParent.get(answerId);
    const ids = legacyNormalizeIds(answerMiscMap.get(answerId) ?? []);
    const canonical = {
      k: "answer",
      answer_id: answerId,
      question_id: parent.questionId,
      misconception_ids: ids,
      answer_text: parent.text,
    };
    return {
      answer_id: answerId,
      question_id: parent.questionId,
      misconception_ids: ids,
      source_fingerprint: legacyFingerprint(canonical),
    };
  });

  return { misconceptionIds, questionBaselines, answerBaselines };
}

// ---------------------------------------------------------------------------
// fixture
// ---------------------------------------------------------------------------
const misconceptions = [
  { misconception_id: "IO-01" },
  { misconception_id: "IO-02" },
  { misconception_id: "CO-01" },
  { misconception_id: "UNUSED-99" },
];
const questions = [
  { question_id: "Q001", active: "true", question_ind: "Cetak n.", question_en: "Print n.", question_code: "READ n\nWRITE n" },
  { question_id: "Q002", active: "yes", question_ind: " Halo\r\n", question_en: "Hello", question_code: "" },
  { question_id: "Q003", active: "false", question_ind: "inactive", question_en: "inactive", question_code: "x" },
];
const answers = [
  { answer_id: "A001-A", question_id: "Q001", active: "1", answer_text: "8" },
  { answer_id: "A001-B", question_id: "Q001", active: "true", answer_text: " 9\r\n" },
  { answer_id: "A003-A", question_id: "Q003", active: "true", answer_text: "orphan (inactive parent)" },
];
const questionMisc = [
  { question_id: "Q001", misconception_id: "IO-02", active: "true" },
  { question_id: "Q001", misconception_id: "IO-01", active: "true" },
  { question_id: "Q001", misconception_id: "IO-01", active: "true" },
  { question_id: "Q001", misconception_id: "CO-01", active: "false" },
  { question_id: "Q003", misconception_id: "IO-01", active: "true" },
];
const answerMisc = [
  { answer_id: "A001-B", misconception_id: "IO-02", active: "true" },
  { answer_id: "A001-B", misconception_id: "BOGUS", active: "true" },
];

const fixtureArrays = { questions, answers, questionMisc, answerMisc, misconceptions };
const fixtureNamed = {
  questions,
  answers,
  questionMisconceptions: questionMisc,
  answerMisconceptions: answerMisc,
  misconceptions,
};

// ---------------------------------------------------------------------------
// 1. GOLDEN
// ---------------------------------------------------------------------------
const snapshot = buildBaselineSnapshot(fixtureNamed);

assert.deepEqual(snapshot.misconceptionIds, ["CO-01", "IO-01", "IO-02", "UNUSED-99"]);
assert.deepEqual(
  snapshot.questionBaselines.map((q) => q.question_id),
  ["Q001", "Q002"],
  "only active questions are in the snapshot",
);
assert.deepEqual(
  snapshot.answerBaselines.map((a) => a.answer_id),
  ["A001-A", "A001-B"],
  "answers whose parent question is inactive are excluded",
);
assert.deepEqual(snapshot.questionBaselines[0].misconception_ids, ["IO-01", "IO-02"]);

// Frozen golden fingerprints. These bytes must never change without a
// deliberate, reviewed change to the canonical fingerprint scheme (which would
// also change every source_version on the next real sync).
const GOLDEN_QUESTION = {
  Q001: "ddca03066381e246b2fd5075ac00f8e3328175e47db0c95d273d5555bbb6ae02",
  Q002: "02864cf28f6e1213f03b275b561b87de6bda38bba4f288c3ca6b99c30528a085",
};
const GOLDEN_ANSWER = {
  "A001-A": "8780ece7519c59100cba8cc592641174dc65e7acc06cc74a80cc47b938cd232b",
  "A001-B": "d83b96afe710f57a80811bee2d954caea1356650b11d57ef26c4b6f747f891c6",
};
for (const q of snapshot.questionBaselines) {
  assert.match(q.source_fingerprint, /^[0-9a-f]{64}$/, "fingerprint is lowercase hex sha256");
  assert.equal(q.source_fingerprint, GOLDEN_QUESTION[q.question_id], `${q.question_id} golden fingerprint`);
}
for (const a of snapshot.answerBaselines) {
  assert.equal(a.source_fingerprint, GOLDEN_ANSWER[a.answer_id], `${a.answer_id} golden fingerprint`);
}

// stable across runs / key insertion order
const snapshotAgain = buildBaselineSnapshot({
  misconceptions,
  answerMisconceptions: answerMisc,
  questionMisconceptions: questionMisc,
  answers,
  questions,
});
assert.deepEqual(
  snapshotAgain.questionBaselines,
  snapshot.questionBaselines,
  "snapshot is deterministic regardless of argument key order",
);

// ---------------------------------------------------------------------------
// 2. EQUIVALENCE with the pre-refactor implementation
// ---------------------------------------------------------------------------
const legacy = legacyBuild(fixtureArrays);
assert.deepEqual(snapshot.misconceptionIds, legacy.misconceptionIds, "misconceptionIds unchanged");
assert.deepEqual(snapshot.questionBaselines, legacy.questionBaselines, "questionBaselines payload unchanged");
assert.deepEqual(snapshot.answerBaselines, legacy.answerBaselines, "answerBaselines payload unchanged");

// ---------------------------------------------------------------------------
// parseCsv still behaves (used by the seeder loader)
// ---------------------------------------------------------------------------
const csv = 'question_id,active,question_ind\r\nQ001,true,"a,b"\r\nQ002,false,c\r\n';
assert.deepEqual(parseCsv(csv), [
  { question_id: "Q001", active: "true", question_ind: "a,b" },
  { question_id: "Q002", active: "false", question_ind: "c" },
]);
assert.deepEqual(parseCsv("﻿h1,h2\n1,2\n"), [{ h1: "1", h2: "2" }]);

console.log("baseline snapshot refactor checks passed.");
