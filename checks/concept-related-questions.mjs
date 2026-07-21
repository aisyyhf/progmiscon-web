import assert from "node:assert/strict";
import { buildConcepts } from "../src/utils/concepts.ts";

const text = (value) => ({ id: value, en: value });
const categories = ["SQ", "OP", "IO"].map((id, order) => ({
  id,
  name: text(id),
  description: text(id),
  order,
}));
const question = (id, categoryId, expectedConcepts) => ({
  id,
  assessmentId: "check",
  categoryId,
  number: id,
  type: "short_answer",
  prompt: text(id),
  expectedConcepts: expectedConcepts.map(text),
  questionMisconceptionIds: [],
});
const questions = [
  question("Q001", "SQ", ["SQ"]),
  question("Q004", "OP", ["OP", "SQ", "SQ"]),
];

const concepts = buildConcepts(categories, questions, []);

assert.deepEqual(concepts.find(({ id }) => id === "SQ")?.relatedQuestionIds, ["Q001", "Q004"]);
assert.deepEqual(concepts.find(({ id }) => id === "IO")?.relatedQuestionIds, []);
console.log("Concept question relations include primary and related questions without duplicates.");
