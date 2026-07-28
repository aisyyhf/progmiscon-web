import assert from "node:assert/strict";
import {
  buildMockQuestions,
  mockQuestionDefinitions,
} from "../src/data/mockQuestions.ts";
import { mockStudentAnswers } from "../src/data/mockStudentAnswers.ts";

const questions = buildMockQuestions(mockStudentAnswers);
const byId = new Map(questions.map((question) => [question.id, question]));

const mp = byId.get("q-evenodd");
assert.ok(mp, "MP mock question must exist");
assert.deepEqual(
  mp.answerDerivedMisconceptionIds,
  ["mc-condition-reversed", "mc-ifelse-missing-else"],
  "MP option misconception IDs must be answer-derived",
);

const ps = byId.get("q-swap");
assert.ok(ps, "PS mock question must exist");
assert.deepEqual(
  ps.answerDerivedMisconceptionIds,
  ["mc-swap-no-temp"],
  "PS mock answer misconception IDs must be answer-derived",
);
assert.deepEqual(
  ps.directQuestionMisconceptionIds,
  ["mc-swap-no-temp"],
  "the direct PS relation must retain its provenance",
);
assert.deepEqual(
  ps.questionMisconceptionIds,
  ["mc-swap-no-temp"],
  "a direct-plus-derived duplicate must appear once in the effective union",
);

assert.deepEqual(
  mp.directQuestionMisconceptionIds,
  ["mc-condition-reversed", "mc-ifelse-missing-else"],
);
assert.deepEqual(
  mp.questionMisconceptionIds,
  ["mc-condition-reversed", "mc-ifelse-missing-else"],
  "direct-plus-derived MP provenance must be preserved without duplicates",
);
assert.equal(
  mockQuestionDefinitions.some(
    (question) => "answerDerivedMisconceptionIds" in question,
  ),
  false,
  "raw mock definitions must not hard-code fallback answer-derived IDs",
);

console.log("mock question provenance checks passed");
