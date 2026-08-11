import assert from "node:assert/strict";
import {
  buildQuestionOptions,
  normalizeQuestionType,
  normalizeWeek,
  questionOptionLabel,
  selectedOptionIdForAnswer,
} from "../src/utils/questionMetadata.ts";
import {
  matchesMisconceptionSearch,
  misconceptionLabel,
} from "../src/utils/misconceptionLabel.ts";
import { validateMasterData } from "../src/utils/masterDataValidation.ts";

assert.equal(normalizeQuestionType("PS"), "short_answer");
assert.equal(normalizeQuestionType("essay"), "short_answer");
assert.equal(normalizeQuestionType("MP"), "multiple_choice");
assert.equal(normalizeQuestionType("multiple_choice"), "multiple_choice");
assert.equal(normalizeQuestionType(""), "short_answer");
assert.equal(normalizeQuestionType("unknown"), null);

assert.equal(normalizeWeek("3"), "W03");
assert.equal(normalizeWeek("W3"), "W03");
assert.equal(normalizeWeek("Week 5-6"), "W05-06");
assert.equal(normalizeWeek("11–12"), "W11-12");
assert.equal(normalizeWeek(""), null);
assert.equal(normalizeWeek("0"), null);
assert.equal(normalizeWeek("-1"), null);
assert.equal(normalizeWeek("6-5"), null);
assert.equal(normalizeWeek("invalid"), null);
assert.equal(normalizeWeek("46148"), null);
assert.equal(questionOptionLabel(5), "E");
assert.equal(questionOptionLabel(27), "AA");

const answers = [1, 2, 3, 4].map((order) => ({
  answer_id: `A${order}`,
  question_id: "Q1",
  answer_text: `Option ${order}`,
  status: order === 2 ? "correct" : "incorrect",
  explanation_ind: "",
  explanation_en: "",
  order_no: String(order),
  active: "true",
}));
const options = buildQuestionOptions(answers, new Map([["A1", ["IO-02"]]]));

assert.deepEqual(options.map((option) => option.label), ["A", "B", "C", "D"]);
assert.equal(options[1]?.isCorrect, true);
assert.equal(options[0]?.misconceptionId, "IO-02");
assert.equal(
  buildQuestionOptions(answers, new Map([["A1", ["IO-02", "IO-03"]]]))[0]?.misconceptionId,
  undefined,
);
assert.equal(selectedOptionIdForAnswer("multiple_choice", "A2"), "A2");
assert.equal(selectedOptionIdForAnswer("short_answer", "A2"), undefined);

const misconception = {
  id: "IO-02",
  title: { id: "Judul", en: "Title" },
};
assert.equal(misconceptionLabel(misconception, "id"), "IO-02 - Judul");
assert.equal(
  misconceptionLabel(
    { id: "IO-02", title: { id: "IO-02 — Judul", en: "IO-02 — Title" } },
    "id",
  ),
  "IO-02 - Judul",
);
assert.equal(matchesMisconceptionSearch(misconception, " io-02 "), true);
assert.equal(matchesMisconceptionSearch(misconception, "title"), true);
assert.equal(matchesMisconceptionSearch(misconception, " TITLE "), true);

const legacyData = {
  topics: [],
  misconceptions: [],
  questions: [{ question_id: "Q1", week: "" }],
  questionTopics: [],
  questionMisconceptions: [],
  answers: [],
  answerMisconceptions: [],
  similarMisconceptions: [],
};
assert.deepEqual(validateMasterData(legacyData), []);

const invalidMetadataErrors = validateMasterData({
  ...legacyData,
  questions: [
    { question_id: "Q1", question_type: "unknown", week: "46148", source_system: "lms", source_key: "1" },
    { question_id: "Q2", question_type: "PS", week: "W01", source_system: "lms", source_key: "1" },
  ],
});
assert(invalidMetadataErrors.some((error) => error.includes("question_type tidak valid")));
assert(invalidMetadataErrors.some((error) => error.includes("week tidak valid")));
assert(invalidMetadataErrors.some((error) => error.includes("questions source_system/source_key ganda")));

console.log("Question metadata compatibility checks passed.");
