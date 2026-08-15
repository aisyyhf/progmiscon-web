import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import type { MasterData } from "../src/types/masterData.ts";
import { isActiveValue, validateMasterData } from "../src/utils/masterDataValidation.ts";
import {
  buildQuestionContentBlocks,
  buildSampleCases,
  isDummyData,
  parseContentBlocks,
  parseDelimitedIds,
  parseReasonMap,
} from "../src/utils/masterDataContent.ts";
import { normalizeQuestionType, normalizeWeek } from "../src/utils/questionMetadata.ts";

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
const w02 = activeQuestions.filter((row) => normalizeWeek(row.week) === "W02");
assert.equal(w02.length, 59, "W02 has 59 active questions");
assert.equal(
  w02.filter((row) => normalizeQuestionType(row.question_type) === "short_answer").length,
  19,
  "W02 has 19 active PS questions",
);
assert.equal(
  w02.filter((row) => normalizeQuestionType(row.question_type) === "multiple_choice").length,
  40,
  "W02 has 40 active MP questions",
);

let structuredQuestionLocales = 0;
let sampleQuestionCount = 0;
let duplicateLegacyCodeCount = 0;
let suppressedSampleLocales = 0;
for (const question of activeQuestions) {
  const sampleCases = buildSampleCases(question.sample_inputs, question.sample_outputs);
  for (const [raw, legacyText] of [
    [question.content_blocks_ind, question.question_ind],
    [question.content_blocks_en, question.question_en],
  ] as const) {
    if (parseContentBlocks(raw).blocks.length > 0) structuredQuestionLocales += 1;
    const originalBlocks = buildQuestionContentBlocks(raw, legacyText, question.question_code);
    const deduplicatedBlocks = buildQuestionContentBlocks(raw, legacyText, question.question_code, sampleCases);
    if (JSON.stringify(originalBlocks) !== JSON.stringify(deduplicatedBlocks)) suppressedSampleLocales += 1;
    const code = question.question_code.trim().replace(/\r\n/g, "\n");
    if (code) {
      const blocks = deduplicatedBlocks;
      const occurrences = blocks.filter((block) => block.content.replace(/\r\n/g, "\n").includes(code)).length;
      if (occurrences > 1) duplicateLegacyCodeCount += 1;
    }
  }
  if (sampleCases.length > 0) sampleQuestionCount += 1;
}
assert.equal(duplicateLegacyCodeCount, 0, "legacy code is not duplicated by the structured fallback");
assert.equal(suppressedSampleLocales, 0, "live question content has no duplicate sample fragments");

const circleAreaQuestion = activeQuestions.find((row) => row.source_key.trim() === "LMS-PS-10413316");
assert.ok(circleAreaQuestion, "LMS circle-area question remains available");
const circleAreaCases = buildSampleCases(circleAreaQuestion.sample_inputs, circleAreaQuestion.sample_outputs);
for (const [raw, legacyText] of [[circleAreaQuestion.content_blocks_ind, circleAreaQuestion.question_ind], [circleAreaQuestion.content_blocks_en, circleAreaQuestion.question_en]] as const) {
  const content = buildQuestionContentBlocks(raw, legacyText, circleAreaQuestion.question_code, circleAreaCases)
    .filter((block) => block.type === "text")
    .map((block) => block.content)
    .join("\n");
  for (const sample of circleAreaCases) {
    assert.equal(content.includes(sample.output), false, "circle-area sample output is rendered only by sample cards");
  }
  assert.match(content, /pi.*3\.14/i, "circle-area instructional prose remains");
}

const q062 = activeQuestions.find((row) => row.question_id.trim() === "Q062")!;
const q062Original = buildQuestionContentBlocks(q062.content_blocks_ind, q062.question_ind, q062.question_code);
const q062Deduplicated = buildQuestionContentBlocks(q062.content_blocks_ind, q062.question_ind, q062.question_code, buildSampleCases(q062.sample_inputs, q062.sample_outputs));
assert.deepEqual(q062Deduplicated, q062Original, "incomplete structured output does not remove the fuller legacy sample");

const mpWithoutSamples = mp.find((row) => buildSampleCases(row.sample_inputs, row.sample_outputs).length === 0)!;
assert.deepEqual(
  buildQuestionContentBlocks(mpWithoutSamples.content_blocks_ind, mpWithoutSamples.question_ind, mpWithoutSamples.question_code, []),
  buildQuestionContentBlocks(mpWithoutSamples.content_blocks_ind, mpWithoutSamples.question_ind, mpWithoutSamples.question_code),
  "MP content without dedicated samples is preserved",
);

const activeAnswers = data.answers.filter((row) => isActiveValue(row.active));
const evidenceAnswers = activeAnswers.filter((row) => isActiveValue(row.is_evidence ?? ""));
const namedEvidenceAnswers = evidenceAnswers.filter((row) => row.student_name?.trim());
for (const answer of evidenceAnswers) {
  const ids = new Set(parseDelimitedIds(answer.evidence_misconceptions));
  for (const raw of [answer.evidence_reason_ind, answer.evidence_reason_en]) {
    for (const id of parseReasonMap(raw).reasons.keys()) assert.ok(ids.has(id), `${answer.answer_id} evidence reason key ${id} is declared`);
  }
}

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
  activeAnswers: activeAnswers.length,
  evidenceAnswers: evidenceAnswers.length,
  namedEvidenceAnswers: namedEvidenceAnswers.length,
  answerMisconceptionRelations: data.answerMisconceptions.length,
  dummyMisconceptionDetails,
});
