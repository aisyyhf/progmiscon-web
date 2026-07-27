import assert from "node:assert/strict";
import {
  createDefaultReviewSessionState,
  getAnswersForQuestion,
  getPairedWorkspace,
  getReviewWorkspaceAvailability,
  normalizeReviewSessionState,
  parseReviewSessionState,
  selectAfterAnswerReview,
  selectAfterQuestionReview,
  selectAvailableReviewWorkspace,
  selectLinkedAnswerId,
  selectStoredWorkspaceItemId,
  serializeReviewSessionState,
  setActiveReviewItemId,
} from "../src/utils/reviewLinking.ts";
import {
  classifyReviewItems,
  resolveAnswerSelection,
} from "../src/utils/reviewWorkspace.ts";

const psQuestion = {
  id: "Q-PS-1",
  type: "short_answer",
  number: "1",
};
const nextPsQuestion = {
  id: "Q-PS-2",
  type: "short_answer",
  number: "2",
};
const noAnswerQuestion = {
  id: "Q-PS-NONE",
  type: "short_answer",
  number: "3",
};
const mpQuestion = {
  id: "Q-MP-1",
  type: "multiple_choice",
  number: "4",
  options: [
    { id: "OPT-A", label: "A", text: { id: "8", en: "8" }, isCorrect: true },
    { id: "OPT-B", label: "B", text: { id: "9", en: "9" }, isCorrect: false },
  ],
};
const nextMpQuestion = {
  id: "Q-MP-2",
  type: "multiple_choice",
  number: "5",
};
const questions = [
  psQuestion,
  nextPsQuestion,
  noAnswerQuestion,
  mpQuestion,
  nextMpQuestion,
];
const answers = [
  { id: "A-PS-1", questionId: "Q-PS-1" },
  { id: "A-OTHER", questionId: "Q-OTHER" },
  { id: "A-PS-2", questionId: "Q-PS-1" },
  { id: "A-PS-1", questionId: "Q-PS-1" },
  { id: "A-PS-3", questionId: "Q-PS-2" },
  {
    id: "A-MP-1",
    questionId: "Q-MP-1",
    selectedOptionId: "OPT-B",
    answerText: "9",
  },
  {
    id: "A-MP-MISSING",
    questionId: "Q-MP-1",
    selectedOptionId: "missing",
    answerText: "Fallback",
  },
];
const psQuestions = [psQuestion, nextPsQuestion, noAnswerQuestion];
const psAnswers = getAnswersForQuestion("Q-PS-1", answers).concat(answers[4]);

const afterQuestion = selectAfterQuestionReview(
  psQuestion,
  psQuestions,
  psAnswers,
  [],
  ["A-PS-1"],
);
assert.deepEqual(afterQuestion, {
  workspace: "answer-ps",
  itemId: "A-PS-2",
  parentQuestionId: "Q-PS-1",
});

const afterQuestionWithoutAnswers = selectAfterQuestionReview(
  noAnswerQuestion,
  psQuestions,
  psAnswers,
  ["Q-PS-1"],
  [],
);
assert.equal(afterQuestionWithoutAnswers.workspace, "question-ps");
assert.equal(afterQuestionWithoutAnswers.itemId, "Q-PS-2");

const afterQuestionWithReviewedAnswers = selectAfterQuestionReview(
  psQuestion,
  psQuestions,
  psAnswers,
  [],
  ["A-PS-1", "A-PS-2"],
);
assert.equal(afterQuestionWithReviewedAnswers.workspace, "question-ps");
assert.equal(afterQuestionWithReviewedAnswers.itemId, "Q-PS-2");

const linked = getAnswersForQuestion("Q-PS-1", answers);
assert.deepEqual(
  linked.map(({ id }) => id),
  ["A-PS-1", "A-PS-2"],
);
assert.equal(new Set(linked.map(({ id }) => id)).size, linked.length);
assert.equal(linked.at(-1)?.questionId, psQuestion.id);

const afterFirstAnswer = selectAfterAnswerReview(
  psQuestion,
  "A-PS-1",
  psQuestions,
  psAnswers,
  ["Q-PS-1"],
  [],
);
assert.deepEqual(afterFirstAnswer, {
  workspace: "answer-ps",
  itemId: "A-PS-2",
  parentQuestionId: "Q-PS-1",
});

const afterLastAnswer = selectAfterAnswerReview(
  psQuestion,
  "A-PS-2",
  psQuestions,
  psAnswers,
  ["Q-PS-1"],
  ["A-PS-1"],
);
assert.equal(afterLastAnswer.workspace, "question-ps");
assert.equal(afterLastAnswer.itemId, "Q-PS-2");

assert.equal(getPairedWorkspace("question-ps"), "answer-ps");
assert.equal(getPairedWorkspace("answer-ps"), "question-ps");
assert.equal(getPairedWorkspace("question-mp"), "answer-mp");
assert.equal(getPairedWorkspace("answer-mp"), "question-mp");
assert.notEqual(getPairedWorkspace("question-ps"), "answer-mp");
assert.notEqual(getPairedWorkspace("question-mp"), "answer-ps");

const psQuestionAvailability = getReviewWorkspaceAvailability(
  "question-ps",
  true,
);
assert.equal(psQuestionAvailability["question-ps"], true);
assert.equal(psQuestionAvailability["answer-ps"], true);
assert.equal(psQuestionAvailability["answer-mp"], false);

const psAnswerAvailability = getReviewWorkspaceAvailability(
  "answer-ps",
  true,
);
assert.equal(psAnswerAvailability["answer-ps"], true);
assert.equal(psAnswerAvailability["answer-mp"], false);

const mpQuestionAvailability = getReviewWorkspaceAvailability(
  "question-mp",
  true,
);
assert.equal(mpQuestionAvailability["answer-mp"], true);
assert.equal(mpQuestionAvailability["answer-ps"], false);

const mpAnswerAvailability = getReviewWorkspaceAvailability(
  "answer-mp",
  true,
);
assert.equal(mpAnswerAvailability["answer-mp"], true);
assert.equal(mpAnswerAvailability["answer-ps"], false);
assert.equal(mpAnswerAvailability["question-ps"], true);
assert.equal(mpAnswerAvailability["question-mp"], true);

const noAnswerAvailability = getReviewWorkspaceAvailability(
  "question-ps",
  false,
);
assert.equal(noAnswerAvailability["answer-ps"], false);
assert.equal(
  selectAvailableReviewWorkspace(
    "question-ps",
    "answer-ps",
    noAnswerAvailability,
  ),
  "question-ps",
);

const switchedTypeAvailability = getReviewWorkspaceAvailability(
  "question-mp",
  true,
);
assert.equal(switchedTypeAvailability["answer-ps"], false);
assert.equal(switchedTypeAvailability["answer-mp"], true);

const { items, questionById } = classifyReviewItems(questions, answers);
const psContext = normalizeReviewSessionState(
  {
    workspace: "question-ps",
    activeItemIds: {
      "question-ps": "Q-PS-1",
      "answer-mp": "A-MP-MISSING",
    },
    activeParentQuestionIds: { mp: "Q-MP-1" },
  },
  items,
  questionById,
  [],
  [],
);
assert.equal(psContext.activeParentQuestionIds.ps, "Q-PS-1");
assert.equal(psContext.activeParentQuestionIds.mp, "Q-MP-1");
assert.equal(psContext.activeItemIds["answer-mp"], "A-MP-MISSING");

const mpContext = normalizeReviewSessionState(
  {
    workspace: "question-mp",
    activeItemIds: {
      "question-mp": "Q-MP-1",
      "answer-ps": "A-PS-3",
    },
    activeParentQuestionIds: { ps: "Q-PS-2" },
  },
  items,
  questionById,
  [],
  [],
);
assert.equal(mpContext.activeParentQuestionIds.mp, "Q-MP-1");
assert.equal(mpContext.activeParentQuestionIds.ps, "Q-PS-2");
assert.equal(mpContext.activeItemIds["answer-ps"], "A-PS-3");

const directAnswerEntry = normalizeReviewSessionState(
  {
    workspace: "answer-ps",
    activeItemIds: { "answer-ps": "A-PS-2" },
    activeParentQuestionIds: {},
  },
  items,
  questionById,
  [],
  [],
);
assert.equal(directAnswerEntry.activeParentQuestionIds.ps, "Q-PS-1");
assert.equal(directAnswerEntry.activeItemIds["answer-ps"], "A-PS-2");

const storedSession = {
  workspace: "answer-mp",
  activeItemIds: {
    "question-ps": "Q-PS-2",
    "answer-mp": "A-MP-MISSING",
  },
  activeParentQuestionIds: {
    ps: "Q-PS-2",
    mp: "Q-MP-1",
  },
};
const serialized = serializeReviewSessionState(storedSession);
assert.deepEqual(parseReviewSessionState(serialized), storedSession);
assert.deepEqual(
  parseReviewSessionState("{invalid"),
  createDefaultReviewSessionState(),
);

const invalidStoredIds = normalizeReviewSessionState(
  {
    workspace: "answer-ps",
    activeItemIds: {
      "question-ps": "missing-question",
      "answer-ps": "missing-answer",
    },
    activeParentQuestionIds: { ps: "missing-parent" },
  },
  items,
  questionById,
  [],
  ["A-PS-1"],
);
assert.equal(invalidStoredIds.activeItemIds["question-ps"], "Q-PS-1");
assert.equal(invalidStoredIds.activeItemIds["answer-ps"], "A-PS-2");
assert.equal(invalidStoredIds.activeParentQuestionIds.ps, "Q-PS-1");

assert.equal(serialized.includes("reviewedQuestionIds"), false);
assert.equal(serialized.includes("reviewedAnswerIds"), false);
assert.equal(
  selectAfterQuestionReview(
    noAnswerQuestion,
    psQuestions,
    psAnswers,
    [],
    [],
  ).workspace,
  "question-ps",
);

assert.equal(
  selectLinkedAnswerId("Q-PS-1", answers, ["A-PS-1"]),
  "A-PS-2",
);
assert.equal(
  selectLinkedAnswerId("Q-PS-1", answers, ["A-PS-1", "A-PS-2"]),
  "A-PS-1",
);
assert.equal(selectLinkedAnswerId("Q-MISSING", answers, []), undefined);

const selected = resolveAnswerSelection(mpQuestion, answers[5]);
assert.equal(selected.option?.id, "OPT-B");
assert.equal(selected.missingSelectedOption, false);

const missing = resolveAnswerSelection(mpQuestion, answers[6]);
assert.equal(missing.option, undefined);
assert.equal(missing.fallbackText, "Fallback");
assert.equal(missing.missingSelectedOption, true);

assert.equal(
  selectStoredWorkspaceItemId(
    [answers[5], answers[6]],
    storedSession.activeItemIds["answer-mp"],
    [],
  ),
  "A-MP-MISSING",
);

const updatedActiveItems = setActiveReviewItemId(
  storedSession.activeItemIds,
  "answer-ps",
  "A-PS-2",
);
assert.equal(updatedActiveItems["question-ps"], "Q-PS-2");
assert.equal(updatedActiveItems["answer-mp"], "A-MP-MISSING");
assert.equal(updatedActiveItems["answer-ps"], "A-PS-2");
assert.equal(storedSession.activeItemIds["answer-ps"], undefined);
