import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { Question, StudentAnswer } from "../src/types/index.ts";
import { getMatchingAnswers } from "../src/utils/misconceptionExploration.ts";

const question: Question = {
  id: "Q001",
  assessmentId: "assessment",
  categoryId: "category",
  number: "1",
  title: { id: "Contoh", en: "Example" },
  week: "W01",
  sourceSystem: null,
  sourceKey: null,
  sourceCode: "Q001",
  level: null,
  type: "short_answer",
  prompt: { id: "Contoh", en: "Example" },
  expectedConcepts: [],
  directQuestionMisconceptionIds: ["VA-01", "EX-04"],
  answerDerivedMisconceptionIds: ["VA-01", "EX-04"],
  questionMisconceptionIds: ["VA-01", "EX-04"],
};

const answer = (
  id: string,
  questionId: string,
  studentMisconceptionIds: string[],
): StudentAnswer => ({
  id,
  questionId,
  studentId: `student-${id}`,
  status: "incorrect",
  checks: [],
  masteredConcepts: [],
  incorrectElements: [],
  studentMisconceptionIds,
});

const answers = [
  answer("A1", "Q001", ["VA-01"]),
  answer("A2", "Q001", ["EX-04"]),
  answer("A3", "Q001", ["VA-01"]),
  answer("A4", "Q001", []),
  answer("A5", "Q002", ["VA-01"]),
];

assert.deepEqual(
  getMatchingAnswers(answers, "VA-01", question.id, [question]).map(({ id }) => id),
  ["A1", "A3"],
  "answer filtering must keep only matching answers from the current question",
);
assert.deepEqual(
  getMatchingAnswers(answers, "EX-04", question.id, [question]).map(({ id }) => id),
  ["A2"],
  "answer navigation must use the selected misconception subset",
);
assert.deepEqual(
  getMatchingAnswers(answers, "NO-RESULT", question.id, [question]),
  [],
  "an unmatched answer filter must produce a clean empty subset",
);

const reviewSource = readFileSync("src/components/review/QuestionReview.tsx", "utf8");
assert.match(reviewSource, /\[activeMisconceptionId, setActiveMisconceptionId\]/);
assert.match(reviewSource, /\[answerFilterMisconceptionId, setAnswerFilterMisconceptionId\]/);
assert.match(
  reviewSource,
  /onFilterMisconception=\{setAnswerFilterMisconceptionId\}/,
  "answer filter chips must not call the tracing-mode selector",
);
assert.doesNotMatch(reviewSource, /onFilterMisconception=\{selectMisconception\}/);

console.log("question detail checks passed");
