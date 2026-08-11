import assert from "node:assert/strict";
import {
  DEFAULT_MATERIAL_QUESTION_FILTERS,
  filterMaterialQuestions,
  getMaterialPaginationItems,
  getMaterialQuestionIdentifier,
  getMaterialQuestionConcepts,
  getMaterialQuestionType,
  getMaterialWeekLabel,
  getMaterialWeekOptions,
  intersectMaterialQuestionGroups,
} from "../src/utils/materialQuestionFilters.ts";

function question(id, type, week, prompt = id, concepts = []) {
  return {
    id,
    assessmentId: "asm-master",
    categoryId: "SQ",
    number: id,
    title: { id: prompt, en: prompt },
    week,
    sourceSystem: null,
    sourceKey: null,
    sourceCode: null,
    level: null,
    type,
    prompt: { id: prompt, en: prompt },
    expectedConcepts: concepts.map((concept) => ({ id: concept, en: concept })),
    questionMisconceptionIds: [],
  };
}

const questions = [
  question("Q1", "short_answer", "W01", "Loop dasar"),
  question("Q2", "multiple_choice", "W02", "Percabangan"),
  question("Q3", "short_answer", "W05-06", "Loop bersarang"),
  question("Q4", "multiple_choice", "W07", "Array"),
  question("Q5", "short_answer", "W11-12", "Fungsi"),
  question("Q6", "multiple_choice", null, "Rekursi"),
  question("Q7", "short_answer", "W03", "Variabel"),
  question("Q8", "multiple_choice", "W02", "Operator"),
];

assert.equal(getMaterialQuestionType("short_answer"), "ps");
assert.equal(getMaterialQuestionType("multiple_choice"), "mp");
assert.equal(getMaterialQuestionIdentifier(questions[0]), "Q1");
assert.equal(getMaterialQuestionIdentifier({ ...questions[0], sourceCode: " Q-102 " }), "Q-102");
assert.equal(getMaterialWeekLabel("W01"), "WEEK 01");
assert.equal(getMaterialWeekLabel("W05-06"), "WEEK 05-06");
assert.deepEqual(
  getMaterialQuestionConcepts(question("Q9", "short_answer", "W01", "Single", ["Variabel"])),
  [{ id: "Variabel", en: "Variabel" }],
  "a question with one concept must expose its actual relation metadata",
);
assert.deepEqual(
  getMaterialQuestionConcepts(
    question("Q10", "short_answer", "W01", "Multiple", ["Variabel", "Ekspresi", "Operator"]),
  ),
  [
    { id: "Variabel", en: "Variabel" },
    { id: "Ekspresi", en: "Ekspresi" },
    { id: "Operator", en: "Operator" },
  ],
  "a question with multiple concepts must expose every actual relation",
);
assert.deepEqual(
  filterMaterialQuestions(questions, { type: "all" }).map(({ type }) => type),
  questions.map(({ type }) => type),
  "type all must keep PS and MP questions",
);
assert.ok(
  filterMaterialQuestions(questions, { type: "ps" }).every(({ type }) => type === "short_answer"),
  "type ps must only return short-answer questions",
);
assert.ok(
  filterMaterialQuestions(questions, { type: "mp" }).every(({ type }) => type === "multiple_choice"),
  "type mp must only return multiple-choice questions",
);
assert.equal(
  filterMaterialQuestions(questions, { week: "all" }).length,
  questions.length,
  "week all must not restrict questions",
);
assert.ok(
  filterMaterialQuestions(questions, { week: "W02" }).every(({ week }) => week === "W02"),
  "a week filter must only return that week",
);
assert.deepEqual(
  filterMaterialQuestions(questions, { week: "unassigned" }).map(({ id }) => id),
  ["Q6"],
  "unassigned must only return null weeks",
);
assert.deepEqual(
  filterMaterialQuestions(questions, { type: "mp", week: "W02" }).map(({ id }) => id),
  ["Q2", "Q8"],
  "type and week must use AND logic",
);
assert.deepEqual(
  filterMaterialQuestions(questions, {
    searchQuery: "percabangan",
    type: "mp",
    week: "W02",
  }).map(({ id }) => id),
  ["Q2"],
  "search, type, and week must use AND logic",
);
assert.deepEqual(
  getMaterialWeekOptions(questions),
  ["W01", "W02", "W03", "W05-06", "W07", "W11-12"],
  "week options must be unique and numerically sorted, including ranges",
);

const duplicatedQuestions = [questions[0], questions[0], questions[1]];
const filteredWithoutDuplicates = filterMaterialQuestions(duplicatedQuestions);
assert.deepEqual(
  filteredWithoutDuplicates.map(({ id }) => id),
  ["Q1", "Q2"],
  "filtered questions must not contain duplicate IDs",
);
assert.deepEqual(
  intersectMaterialQuestionGroups([
    [questions[0], questions[1], questions[2]],
    [questions[1], questions[2], questions[3]],
  ]).map(({ id }) => id),
  ["Q2", "Q3"],
  "two selected concept groups must use AND logic",
);
assert.deepEqual(
  intersectMaterialQuestionGroups([
    [questions[0], questions[1], questions[2], questions[2]],
    [questions[1], questions[2], questions[3]],
    [questions[2], questions[3], questions[4]],
  ]).map(({ id }) => id),
  ["Q3"],
  "three selected concept groups must use AND logic without duplicate questions",
);
assert.deepEqual(filterMaterialQuestions(questions, { searchQuery: "tidak ada" }), []);
assert.deepEqual(DEFAULT_MATERIAL_QUESTION_FILTERS, {
  searchQuery: "",
  type: "all",
  week: "all",
});

const questionsWithoutWeeks = [
  question("Q9", "short_answer", null),
  question("Q10", "multiple_choice", null),
];
assert.deepEqual(getMaterialWeekOptions(questionsWithoutWeeks), []);
assert.deepEqual(
  filterMaterialQuestions(questionsWithoutWeeks, { week: "all" }),
  questionsWithoutWeeks,
);

assert.deepEqual(getMaterialPaginationItems(1, 1), [1]);
assert.deepEqual(getMaterialPaginationItems(4, 7), [1, 2, 3, 4, 5, 6, 7]);
assert.deepEqual(getMaterialPaginationItems(1, 41), [1, 2, "ellipsis", 41]);
assert.deepEqual(getMaterialPaginationItems(20, 41), [1, "ellipsis", 19, 20, 21, "ellipsis", 41]);
assert.deepEqual(getMaterialPaginationItems(41, 41), [1, "ellipsis", 40, 41]);

console.log("Material question filter self-check passed.");
