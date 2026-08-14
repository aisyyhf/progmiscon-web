import assert from "node:assert/strict";
import type { ReviewSourceVersions } from "../src/types/reviewPersistence.ts";
import { haveSameReviewSourceVersions } from "../src/utils/reviewSourceVersions.ts";

function versions(
  questionVersion = "question-v1",
  answerVersion = "answer-v1",
  answerQuestionId = "q-1",
): ReviewSourceVersions {
  return {
    questions: new Map([["q-1", questionVersion]]),
    answers: new Map([
      ["a-1", { questionId: answerQuestionId, sourceVersion: answerVersion }],
    ]),
  };
}

assert.equal(haveSameReviewSourceVersions(versions(), versions()), true);
const incompleteVersions = versions();
incompleteVersions.questions.clear();
assert.equal(haveSameReviewSourceVersions(versions(), incompleteVersions), false);
assert.equal(
  haveSameReviewSourceVersions(versions(), versions("question-v2")),
  false,
);
assert.equal(
  haveSameReviewSourceVersions(versions(), versions("question-v1", "answer-v2")),
  false,
);
assert.equal(
  haveSameReviewSourceVersions(versions(), versions("question-v1", "answer-v1", "q-2")),
  false,
);

console.log("Review source snapshot checks passed.");
