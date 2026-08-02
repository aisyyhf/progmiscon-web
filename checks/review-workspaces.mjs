import assert from "node:assert/strict";
import {
  DEFAULT_REVIEW_WORKSPACE,
  assertAnswerReviewEligible,
  classifyReviewItems,
  filterEligibleAnswerReviewCounts,
  filterEligibleAnswerReviewIds,
  filterEligibleAnswerReviewTasks,
  getReviewProgress,
  isAnswerReviewEligible,
  resolveAnswerSelection,
  selectWorkspaceItemId,
} from "../src/utils/reviewWorkspace.ts";

const questions = [
  { id: "Q-PS-1", type: "short_answer" },
  {
    id: "Q-MP-1",
    type: "multiple_choice",
    options: [
      { id: "A", label: "A", text: { id: "8", en: "8" }, isCorrect: true },
      { id: "B", label: "B", text: { id: "9", en: "9" }, isCorrect: false },
    ],
  },
  { id: "Q-PS-2", type: "short_answer" },
];
const answers = [
  { id: "A-PS-1", questionId: "Q-PS-1" },
  {
    id: "A-MP-1",
    questionId: "Q-MP-1",
    selectedOptionId: "B",
    answerText: "9",
  },
  {
    id: "A-MP-MISSING",
    questionId: "Q-MP-1",
    selectedOptionId: "missing",
    answerText: "Fallback",
  },
  { id: "A-ORPHAN", questionId: "missing" },
];

const { items } = classifyReviewItems(questions, answers);
const questionById = new Map(questions.map((question) => [question.id, question]));

assert.deepEqual(items["question-ps"].map(({ id }) => id), ["Q-PS-1", "Q-PS-2"]);
assert.deepEqual(items["question-mp"].map(({ id }) => id), ["Q-MP-1"]);
assert.deepEqual(items["answer-ps"].map(({ id }) => id), ["A-PS-1"]);
assert.deepEqual(
  items["answer-mp"].map(({ id }) => id),
  ["A-MP-1", "A-MP-MISSING"],
);

const questionIds = [
  ...items["question-ps"],
  ...items["question-mp"],
].map(({ id }) => id);
const answerIds = [...items["answer-ps"], ...items["answer-mp"]].map(
  ({ id }) => id,
);
assert.equal(new Set(questionIds).size, questionIds.length);
assert.equal(new Set(answerIds).size, answerIds.length);
assert.equal(questionIds.length, questions.length);
assert.equal(answerIds.length, answers.length - 1);

const selected = resolveAnswerSelection(questions[1], answers[1]);
assert.equal(selected.option?.id, "B");
assert.equal(selected.missingSelectedOption, false);

const missing = resolveAnswerSelection(questions[1], answers[2]);
assert.equal(missing.option, undefined);
assert.equal(missing.fallbackText, "Fallback");
assert.equal(missing.missingSelectedOption, true);

assert.deepEqual(getReviewProgress(items["question-ps"], ["Q-PS-1"]), {
  reviewed: 1,
  total: 2,
});
assert.deepEqual(getReviewProgress(items["question-mp"], ["Q-PS-1"]), {
  reviewed: 0,
  total: 1,
});
const eligibleAnswerIds = filterEligibleAnswerReviewIds(
  ["A-PS-1", "A-MP-1"],
  answers,
  questionById,
);
assert.deepEqual(eligibleAnswerIds, ["A-MP-1"]);
assert.deepEqual(
  filterEligibleAnswerReviewCounts(
    new Map([
      ["A-PS-1", 3],
      ["A-MP-1", 2],
    ]),
    answers,
    questionById,
  ),
  new Map([["A-MP-1", 2]]),
);
assert.deepEqual(getReviewProgress(items["answer-mp"], ["A-MP-1"]), {
  reviewed: 1,
  total: 2,
});

assert.equal(isAnswerReviewEligible(questions[0]), false);
assert.equal(isAnswerReviewEligible(questions[1]), true);
assert.throws(
  () => assertAnswerReviewEligible(questions[0]),
  /evidence.*tidak dapat direview/i,
);
assert.doesNotThrow(() => assertAnswerReviewEligible(questions[1]));
assert.deepEqual(
  filterEligibleAnswerReviewTasks(
    [
      { id: "T-PS", questionId: "Q-PS-1" },
      { id: "T-MP", questionId: "Q-MP-1" },
    ],
    questionById,
  ).map(({ id }) => id),
  ["T-MP"],
);

assert.equal(DEFAULT_REVIEW_WORKSPACE, "question-ps");
assert.equal(
  selectWorkspaceItemId(items["answer-mp"], ["A-MP-1"]),
  "A-MP-MISSING",
);
assert.equal(
  selectWorkspaceItemId(items["answer-mp"], ["A-MP-1", "A-MP-MISSING"]),
  "A-MP-1",
);
