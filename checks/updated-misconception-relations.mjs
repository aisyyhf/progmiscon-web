import assert from "node:assert/strict";
import {
  buildUpdatedAnswerMisconceptionRelations,
  buildUpdatedQuestionMisconceptionRelations,
} from "../src/utils/updatedMisconceptionRelations.ts";

const masterQuestionRelations = [
  { question_id: "Q2", misconception_id: "M2", source: "master", active: "TRUE" },
  { question_id: "Q1", misconception_id: "M1", source: "master", active: "TRUE" },
  { question_id: "Q1", misconception_id: "M1", source: "duplicate", active: "TRUE" },
  { question_id: "Q1", misconception_id: "M3", source: "master", active: "TRUE" },
];
const masterQuestionSnapshot = structuredClone(masterQuestionRelations);
const questionReviews = [
  {
    id: "r-old",
    questionId: "Q1",
    updatedAt: "2026-07-20T10:00:00.000Z",
    removedMisconceptionIds: ["M1"],
    additionalMisconceptionIds: ["M2"],
  },
  {
    id: "r-new-a",
    questionId: "Q1",
    updatedAt: "2026-07-21T10:00:00.000Z",
    removedMisconceptionIds: [" M3 ", ""],
    additionalMisconceptionIds: ["M4", "M4"],
  },
  {
    id: "r-new-b",
    questionId: "Q1",
    updatedAt: "2026-07-21T10:00:00.000Z",
    removedMisconceptionIds: [],
    additionalMisconceptionIds: ["M5"],
  },
  {
    id: "r-no-change",
    questionId: "Q2",
    updatedAt: "2026-07-21T09:00:00.000Z",
    removedMisconceptionIds: [],
    additionalMisconceptionIds: [],
  },
];
const questionReviewSnapshot = structuredClone(questionReviews);

const questionResult = buildUpdatedQuestionMisconceptionRelations(
  masterQuestionRelations,
  questionReviews,
  new Set(["M1", "M2", "M3", "M4", "M5"]),
);

assert.deepEqual(
  questionResult.relations.map((row) => [row.question_id, row.misconception_id]),
  [["Q1", "M1"], ["Q1", "M3"], ["Q1", "M5"], ["Q2", "M2"]],
  "the latest review wins ties by review ID, leaving older changes unapplied",
);
assert.equal(questionResult.relations.filter((row) => row.question_id === "Q1" && row.misconception_id === "M5").length, 1, "added relations are unique");
assert.equal(questionResult.relations.some((row) => row.question_id === "Q2" && row.misconception_id === "M2"), true, "unmodified relations stay present");
assert.equal(questionResult.appliedReviewItemCount, 2, "reviews without changes still represent the latest applied item review");
assert.deepEqual(masterQuestionRelations, masterQuestionSnapshot, "master relation input remains unchanged");
assert.deepEqual(questionReviews, questionReviewSnapshot, "review input remains unchanged");

const masterAnswerRelations = [
  { answer_id: "A2", misconception_id: "M2", reason_ind: "", reason_en: "", active: "TRUE" },
  { answer_id: "A1", misconception_id: "M1", reason_ind: "", reason_en: "", active: "TRUE" },
];
const answerResult = buildUpdatedAnswerMisconceptionRelations(
  masterAnswerRelations,
  [{ id: "a-latest", answerId: "A1", updatedAt: "2026-07-21T11:00:00.000Z", removedMisconceptionIds: ["M1", "NOT-RELATED"], additionalMisconceptionIds: ["M3"] }],
  new Set(["M1", "M2", "M3"]),
);

assert.equal(answerResult.relations.some((row) => row.answer_id === "A1" && row.misconception_id === "M1"), false, "removed relations are absent");
assert.equal(answerResult.relations.some((row) => row.answer_id === "A1" && row.misconception_id === "M3"), true, "added relations are present");
assert.deepEqual(answerResult.relations.map((row) => [row.answer_id, row.misconception_id]), [["A1", "M3"], ["A2", "M2"]], "relations are sorted deterministically by item and misconception ID");

const invalidResult = buildUpdatedAnswerMisconceptionRelations(
  [{ answer_id: "A1", misconception_id: "M1", reason_ind: "", reason_en: "", active: "TRUE" }],
  [{ id: "a1", answerId: "A1", updatedAt: "2026-07-21T10:00:00.000Z", removedMisconceptionIds: ["M1"], additionalMisconceptionIds: ["UNKNOWN"] }],
  new Set(["M1"]),
);

assert.deepEqual(invalidResult.invalidAddedMisconceptionIds, ["UNKNOWN"], "unknown additions are reported");
assert.deepEqual(invalidResult.relations.map((row) => row.misconception_id), ["M1"], "an invalid latest review does not produce a partial relation export");

console.log("updated misconception relation checks passed");
