import assert from "node:assert/strict";
import { filterQuestionsByTopicRelations } from "../src/utils/filters.ts";

function question(id, categoryId) {
  return {
    id,
    assessmentId: "asm-master",
    categoryId,
    number: id,
    type: "short_answer",
    prompt: { id, en: id },
    expectedConcepts: [],
    questionMisconceptionIds: [],
  };
}

const questions = [
  question("Q004", "OP"),
  question("Q006", "OP"),
  question("Q007", "OP"),
  question("Q008", "OP"),
  question("Q010", "SQ"),
];

const questionTopics = [
  { question_id: "Q004", topic_id: "SQ", role: "related" },
  { question_id: "Q006", topic_id: "SQ", role: "related" },
  { question_id: "Q007", topic_id: "SQ", role: "related" },
  { question_id: "Q008", topic_id: "SQ", role: "related" },
  { question_id: "Q010", topic_id: "SQ", role: "primary" },
  { question_id: "Q010", topic_id: "SQ", role: "related" },
  { question_id: "Q004", topic_id: "OP", role: "primary" },
];

const sqQuestions = filterQuestionsByTopicRelations(questions, questionTopics, "SQ");
const sqIds = sqQuestions.map((item) => item.id);

assert.deepEqual(sqIds, ["Q004", "Q006", "Q007", "Q008", "Q010"]);
assert.equal(new Set(sqIds).size, sqQuestions.length, "SQ must not contain duplicate question IDs");
assert.equal(sqQuestions.length, sqIds.length, "displayed count must match the filtered list");
assert.deepEqual(
  filterQuestionsByTopicRelations(questions, questionTopics, "OP").map((item) => item.id),
  ["Q004"],
  "another category must keep working",
);
assert.deepEqual(filterQuestionsByTopicRelations(questions, questionTopics, "UNKNOWN"), []);

console.log(`Material relation self-check passed: ${sqQuestions.length} SQ questions, primary + related, no duplicates.`);
