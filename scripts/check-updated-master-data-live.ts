import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import type { MasterData } from "../src/types/masterData.ts";
import { isActiveValue, validateMasterData } from "../src/utils/masterDataValidation.ts";
import {
  buildQuestionContentBlocks,
  buildQuestionSampleCases,
  isDummyData,
  parseContentBlocks,
  parseQuestionOptions,
  parseTestCases,
  suppressDuplicateIoDescriptions,
} from "../src/utils/masterDataContent.ts";
import {
  getQuestionDisplayCode,
  normalizeAnswerRole,
  normalizeQuestionType,
} from "../src/utils/questionMetadata.ts";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1).replace(/^['"]|['"]$/g, "")];
    }),
);

const sheets = {
  topics: "VITE_SHEET_TOPICS_URL",
  misconceptions: "VITE_SHEET_MISCONCEPTIONS_URL",
  questions: "VITE_SHEET_QUESTIONS_URL",
  questionTopics: "VITE_SHEET_QUESTION_TOPICS_URL",
  questionMisconceptions: "VITE_SHEET_QUESTION_MISCONCEPTIONS_URL",
  answers: "VITE_SHEET_ANSWERS_URL",
  answerMisconceptions: "VITE_SHEET_ANSWER_MISCONCEPTIONS_URL",
  similarMisconceptions: "VITE_SHEET_SIMILAR_MISCONCEPTIONS_URL",
} as const;

async function load(url: string, name: string): Promise<Record<string, string>[]> {
  assert.ok(url, `${name} URL is configured`);
  const response = await fetch(url, { cache: "no-store" });
  assert.equal(response.ok, true, `${name} responds successfully`);
  const parsed = Papa.parse<Record<string, string>>(await response.text(), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });
  assert.deepEqual(parsed.errors, [], `${name} CSV parses cleanly`);
  return parsed.data;
}

const entries = await Promise.all(
  Object.entries(sheets).map(async ([name, envKey]) => [name, await load(env[envKey] ?? "", name)] as const),
);
const data = Object.fromEntries(entries) as MasterData;
const errors = validateMasterData(data);
assert.deepEqual(errors, [], `live master data is valid:\n${errors.join("\n")}`);

const activeQuestions = data.questions.filter((row) => isActiveValue(row.active));
const ps = activeQuestions.filter((row) => normalizeQuestionType(row.question_type) === "short_answer");
const mp = activeQuestions.filter((row) => normalizeQuestionType(row.question_type) === "multiple_choice");
assert.equal(ps.length + mp.length, activeQuestions.length, "every active question has an authoritative PS/MP type");
assert.equal(activeQuestions.length, 296, "published source has 296 active questions");
assert.equal(ps.length, 110, "published source has 110 PS questions");
assert.equal(mp.length, 186, "published source has 186 MP questions");

const psLmsIds = ps.map((row) => row.lms_question_id?.trim() ?? "");
assert.equal(psLmsIds.every(Boolean), true, "every PS question has an LMS question ID");
assert.equal(new Set(psLmsIds).size, ps.length, "PS LMS question IDs are unique");
for (const question of ps) {
  assert.equal(
    getQuestionDisplayCode(question),
    question.lms_question_id?.trim(),
    `${question.question_id} displays its LMS question ID`,
  );
}
for (const question of mp) {
  assert.equal(question.lms_question_id?.trim() ?? "", "", `${question.question_id} must not invent an LMS ID`);
  assert.match(getQuestionDisplayCode(question), /^MP-/, `${question.question_id} uses the canonical MP display code`);
  assert.doesNotMatch(question.title_ind.trim(), /\s+\([12]\)$/i, `${question.question_id} Indonesian title is clean`);
  assert.doesNotMatch(question.title_en.trim(), /\s+\([12]\)$/i, `${question.question_id} English title is clean`);
}

const activeAnswers = data.answers.filter((row) => isActiveValue(row.active));
const mpOptionAnswers = activeAnswers.filter((row) => normalizeAnswerRole(row.answer_role) === "mp_option");
const psReferenceAnswers = activeAnswers.filter((row) => normalizeAnswerRole(row.answer_role) === "ps_reference");
const evidenceAnswers = activeAnswers.filter((row) => normalizeAnswerRole(row.answer_role) === "evidence");
assert.equal(mpOptionAnswers.length, 744, "published source has 744 MP option rows");
assert.equal(psReferenceAnswers.length, 58, "published source has 58 PS reference rows");
assert.equal(evidenceAnswers.length, 239, "published source has 239 evidence rows");
assert.equal(
  mpOptionAnswers.length + psReferenceAnswers.length + evidenceAnswers.length,
  activeAnswers.length,
  "every active answer has a recognized semantic role",
);

const questionById = new Map(activeQuestions.map((row) => [row.question_id.trim(), row]));
const answerById = new Map(activeAnswers.map((row) => [row.answer_id.trim(), row]));
let parsedOptionCount = 0;
for (const question of mp) {
  const parsed = parseQuestionOptions(question.options_json, question.correct_option_label);
  assert.equal(parsed.error, undefined, `${question.question_id} options_json parses`);
  assert.equal(parsed.options.length, 4, `${question.question_id} has four canonical choices`);
  assert.equal(parsed.options.filter((option) => option.isCorrect).length, 1, `${question.question_id} has one correct choice`);
  assert.equal(
    parsed.options.find((option) => option.isCorrect)?.label,
    question.correct_option_label?.trim().toUpperCase(),
    `${question.question_id} correct option label is authoritative`,
  );
  for (const option of parsed.options) {
    const answer = answerById.get(option.id);
    assert.ok(answer, `${question.question_id} option ${option.id} resolves to an answer row`);
    assert.equal(normalizeAnswerRole(answer.answer_role), "mp_option", `${option.id} is an MP option row`);
    assert.equal(answer.question_id.trim(), question.question_id.trim(), `${option.id} belongs to its parent question`);
    assert.equal(answer.option_label?.trim(), option.label, `${option.id} preserves its option label`);
  }
  parsedOptionCount += parsed.options.length;
}
assert.equal(parsedOptionCount, 744, "options_json contains all 744 MP choices");

const evidenceCountsByQuestion = new Map<string, number>();
for (const answer of evidenceAnswers) {
  assert.ok(questionById.has(answer.question_id.trim()), `${answer.answer_id} evidence parent exists`);
  assert.ok(answer.evidence_misconception_id?.trim(), `${answer.answer_id} has a direct evidence misconception`);
  evidenceCountsByQuestion.set(
    answer.question_id.trim(),
    (evidenceCountsByQuestion.get(answer.question_id.trim()) ?? 0) + 1,
  );
}
assert.equal(
  evidenceAnswers.filter((answer) => normalizeQuestionType(questionById.get(answer.question_id.trim())?.question_type) === "short_answer").length,
  133,
  "133 evidence rows belong to PS questions",
);
assert.equal(
  evidenceAnswers.filter((answer) => normalizeQuestionType(questionById.get(answer.question_id.trim())?.question_type) === "multiple_choice").length,
  106,
  "106 evidence rows belong to MP questions",
);
for (const question of activeQuestions) {
  const declared = isActiveValue(question.evidence_available ?? "");
  assert.equal(
    declared,
    (evidenceCountsByQuestion.get(question.question_id.trim()) ?? 0) > 0,
    `${question.question_id} evidence_available matches E rows`,
  );
}

const mpOptionIds = new Set(mpOptionAnswers.map((row) => row.answer_id.trim()));
let orphanAnswerRelations = 0;
for (const relation of data.answerMisconceptions.filter((row) => isActiveValue(row.active))) {
  const answerId = relation.answer_id.trim();
  if (!answerById.has(answerId)) {
    orphanAnswerRelations += 1;
    continue;
  }
  assert.ok(mpOptionIds.has(answerId), `${answerId} relation targets only an MP option row`);
}

let structuredQuestionLocales = 0;
let sampleQuestionCount = 0;
let suppressedSampleLocales = 0;
let suppressedIoLocales = 0;
for (const question of activeQuestions) {
  const parsedTests = parseTestCases(question.test_cases_json);
  assert.equal(parsedTests.error, undefined, `${question.question_id} test_cases_json parses`);
  const sampleCases = buildQuestionSampleCases(
    question.test_cases_json,
    question.sample_inputs,
    question.sample_outputs,
  );
  for (const [raw, legacyText, inputDescription, outputDescription] of [
    [question.content_blocks_ind, question.question_ind, question.input_description_ind, question.output_description_ind],
    [question.content_blocks_en, question.question_en, question.input_description_en, question.output_description_en],
  ] as const) {
    if (parseContentBlocks(raw).blocks.length > 0) structuredQuestionLocales += 1;
    const originalBlocks = buildQuestionContentBlocks(raw, legacyText, "");
    const deduplicatedBlocks = buildQuestionContentBlocks(raw, legacyText, "", sampleCases);
    if (JSON.stringify(originalBlocks) !== JSON.stringify(deduplicatedBlocks)) suppressedSampleLocales += 1;
    const withoutDuplicateIo = suppressDuplicateIoDescriptions(
      deduplicatedBlocks,
      inputDescription,
      outputDescription,
    );
    if (JSON.stringify(withoutDuplicateIo) !== JSON.stringify(deduplicatedBlocks)) suppressedIoLocales += 1;
  }
  if (sampleCases.length > 0) sampleQuestionCount += 1;
}
const namedEvidenceAnswers = evidenceAnswers.filter((row) => row.student_name?.trim());

const dummyMisconceptionDetails = data.misconceptions.filter((row) =>
  [row.description_ind, row.description_en, row.wrong_example, row.correct_example, row.correction_ind, row.correction_en, row.common_cause_ind, row.common_cause_en].some(isDummyData),
).length;

console.log("live updated master-data checks passed", {
  topics: data.topics.length,
  misconceptions: data.misconceptions.length,
  activeQuestions: activeQuestions.length,
  psQuestions: ps.length,
  mpQuestions: mp.length,
  structuredQuestionLocales,
  sampleQuestionCount,
  suppressedSampleLocales,
  suppressedIoLocales,
  activeAnswers: activeAnswers.length,
  mpOptionAnswers: mpOptionAnswers.length,
  psReferenceAnswers: psReferenceAnswers.length,
  evidenceAnswers: evidenceAnswers.length,
  namedEvidenceAnswers: namedEvidenceAnswers.length,
  answerMisconceptionRelations: data.answerMisconceptions.length,
  orphanAnswerRelations,
  dummyMisconceptionDetails,
});
