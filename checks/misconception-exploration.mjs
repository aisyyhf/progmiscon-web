import assert from "node:assert/strict";
import {
  getMatchingAnswers,
  getRelatedQuestions,
} from "../src/utils/misconceptionExploration.ts";

const questions = [{ id: "q1" }, { id: "q2" }, { id: "q3" }];
const answers = [
  { id: "a1", questionId: "q1", studentMisconceptionIds: ["m1"] },
  { id: "a2", questionId: "q2", studentMisconceptionIds: ["m1"] },
  { id: "a3", questionId: "q3", studentMisconceptionIds: ["m1"] },
];

assert.deepEqual(
  getRelatedQuestions(questions, answers, "m1", ["q1", "q2"]).map((question) => question.id),
  ["q1", "q2"],
);
assert.deepEqual(
  getMatchingAnswers(answers, "m1", "q2").map((answer) => answer.id),
  ["a2"],
);
