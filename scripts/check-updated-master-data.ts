import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildQuestionContentBlocks,
  buildQuestionSampleCases,
  buildSampleCases,
  isDummyData,
  parseDelimitedIds,
  parseQuestionOptions,
  parseReasonMap,
  parseTestCases,
  suppressDuplicateIoDescriptions,
} from "../src/utils/masterDataContent.ts";
import { resolveEvidenceIdentity } from "../src/utils/evidenceIdentity.ts";
import {
  getQuestionDisplayCode,
  normalizeAnswerRole,
} from "../src/utils/questionMetadata.ts";

const legacyCode = "READ n\nWRITE n";
assert.deepEqual(
  buildQuestionContentBlocks("", "Tulis program.", legacyCode),
  [
    { type: "text", content: "Tulis program." },
    { type: "code", content: legacyCode },
  ],
);
assert.equal(
  buildQuestionContentBlocks(
    JSON.stringify([{ type: "code", content: legacyCode }]),
    "",
    legacyCode,
  ).length,
  1,
  "legacy question_code must not be duplicated when structured blocks already represent it",
);
assert.deepEqual(buildSampleCases('["1", "DATA DUMMY — pending"]', '["2", "x"]'), [
  { input: "1", output: "2" },
]);
assert.equal(isDummyData("Data Dummy - belum tersedia"), true);
assert.deepEqual(parseDelimitedIds("CO-01, IO-01; CO-01"), ["CO-01", "IO-01"]);
assert.equal(parseReasonMap('{"CO-01":"alasan"}').reasons.get("CO-01"), "alasan");
assert.equal(normalizeAnswerRole(" MP_OPTION "), "mp_option");
assert.equal(normalizeAnswerRole("legacy"), null);
assert.equal(
  getQuestionDisplayCode({
    display_question_code: "MP-IO-02-1",
    lms_question_id: "10413314",
    question_code: "legacy",
    question_id: "Q020",
  }),
  "MP-IO-02-1",
);
assert.equal(
  getQuestionDisplayCode({
    display_question_code: "",
    lms_question_id: "10413314",
    question_code: "legacy",
    question_id: "Q001",
  }),
  "10413314",
);

const structuredCases = '[{"case_no":1,"input":"5","output":"25"}]';
assert.deepEqual(parseTestCases(structuredCases), {
  cases: [{ caseNo: 1, input: "5", output: "25" }],
});
assert.deepEqual(parseTestCases('[{"case_no":2,"input":"5 -> 25","output":""}]'), {
  cases: [{ caseNo: 2, input: "5 -> 25", output: "" }],
});
assert.deepEqual(
  buildQuestionSampleCases(structuredCases, '["fallback"]', '["ignored"]'),
  [{ caseNo: 1, input: "5", output: "25" }],
  "test_cases_json must be canonical when valid",
);
assert.deepEqual(
  buildQuestionSampleCases("not-json", '["fallback"]', '["safe"]'),
  [{ input: "fallback", output: "safe" }],
  "legacy samples remain a safe fallback for invalid structured JSON",
);

const parsedOptions = parseQuestionOptions(
  JSON.stringify([
    { answer_id: "A020-A", label: "A", text: "8", misconceptions: [] },
    { answer_id: "A020-B", label: "B", text: "9", misconceptions: ["IO-02"] },
  ]),
  "B",
);
assert.equal(parsedOptions.error, undefined);
assert.equal(parsedOptions.options.length, 2);
assert.equal(parsedOptions.options[1].isCorrect, true);
assert.deepEqual(parsedOptions.options[1].misconceptionIds, ["IO-02"]);

assert.deepEqual(
  suppressDuplicateIoDescriptions(
    [{ type: "text", content: "Petunjuk.\nMasukan: sebuah bilangan bulat\nKeluaran: kuadrat bilangan" }],
    "sebuah bilangan bulat",
    "kuadrat bilangan",
  ),
  [{ type: "text", content: "Petunjuk." }],
  "structured I/O descriptions must not be repeated in prose",
);

const sampleCases = [
  { input: "5.0", output: "78.5000000" },
  { input: "7.5", output: "176.6250000" },
];
const duplicatedSamples = JSON.stringify([{ type: "text", content: [
  "Petunjuk tetap ada.",
  "",
  "Contoh:",
  "Masukan Hasil",
  "5.0 78.5000000",
  "7.5 176.6250000",
].join("\n") }]);
assert.deepEqual(
  buildQuestionContentBlocks(duplicatedSamples, "", "", sampleCases),
  [{ type: "text", content: "Petunjuk tetap ada." }],
  "dedicated sample values must be removed from question content",
);

const middleSamples = JSON.stringify([{ type: "text", content: [
  "Instruksi sebelum contoh.",
  "",
  "Example:",
  "Input Output",
  "5.0 78.5000000",
  "7.5 176.6250000",
  "",
  "Explanatory text after the sample remains.",
].join("\n") }]);
assert.deepEqual(
  buildQuestionContentBlocks(middleSamples, "", "", sampleCases),
  [{ type: "text", content: "Instruksi sebelum contoh.\n\nExplanatory text after the sample remains." }],
  "prose after a duplicate sample fragment must be preserved",
);
assert.deepEqual(
  buildQuestionContentBlocks(duplicatedSamples, "", ""),
  JSON.parse(duplicatedSamples),
  "legacy sample text must remain when no dedicated sample cases exist",
);

const partialStructuredSample = JSON.stringify([{ type: "text", content: [
  "Masukan:",
  "7",
  "Keluaran:",
  "1 2 3 4 5 6 7",
  "2 3 4 5 6 7",
].join("\n") }]);
assert.deepEqual(
  buildQuestionContentBlocks(partialStructuredSample, "", "", [sampleCases[1]]),
  JSON.parse(partialStructuredSample),
  "partial structured samples must not remove additional legacy output",
);

assert.deepEqual(resolveEvidenceIdentity("Nama", "student-1"), {
  primary: "Nama",
  secondary: "student-1",
});
assert.deepEqual(resolveEvidenceIdentity("Nama", ""), { primary: "Nama" });
assert.deepEqual(resolveEvidenceIdentity("", "student-1"), { primary: "student-1" });
assert.equal(resolveEvidenceIdentity("", ""), undefined);

const publicSources = [
  "src/components/review/QuestionPanel.tsx",
  "src/components/review/AnswerCasePanel.tsx",
  "src/components/review/QuestionReview.tsx",
  "src/components/browser/MaterialBrowser.tsx",
  "src/components/browser/QuestionList.tsx",
].map((path) => readFileSync(path, "utf8")).join("\n");
assert.doesNotMatch(publicSources, /studentName|studentUserId|evidenceSource|evidenceMisconceptionIds/);

const lecturerSource = readFileSync("src/pages/LecturerReviewPage.tsx", "utf8");
const evidenceSource = readFileSync("src/components/review/PsAnswerEvidenceWorkspace.tsx", "utf8");
const reviewLinkingSource = readFileSync("src/utils/reviewLinking.ts", "utf8");
const structuredEvidenceSource = readFileSync(
  "src/components/review/StructuredEvidenceList.tsx",
  "utf8",
);
assert.match(lecturerSource, /<QuestionContent question=\{question\}/);
assert.match(evidenceSource, /<QuestionContent question=\{question\}/);
assert.match(evidenceSource, /identity\?\.secondary/);
assert.doesNotMatch(evidenceSource, /anonymous-/);
assert.match(lecturerSource, /getEvidenceAnswersForQuestion/);
assert.match(reviewLinkingSource, /getMpOptionAnswersForQuestion/);
assert.doesNotMatch(
  structuredEvidenceSource,
  /"Nama"|"Name"|Tidak tersedia|Unavailable/,
);
assert.match(structuredEvidenceSource, /"Jawaban"/);
assert.match(structuredEvidenceSource, /evidenceMisconceptionId/);
assert.match(structuredEvidenceSource, /evidenceExplanation/);
assert.doesNotMatch(lecturerSource, /groupMisconceptionReasons/);
assert.doesNotMatch(evidenceSource, /groupMisconceptionReasons/);

console.log("updated master-data checks passed");
