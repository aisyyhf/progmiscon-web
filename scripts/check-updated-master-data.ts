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

// --- Bilingual option text: legacy vs. new text_ind/text_en shape ---

// A. legacy `text` parses exactly as before (id and en both equal the single string)
const legacyOnly = parseQuestionOptions(
  JSON.stringify([
    { answer_id: "A636", label: "A", text: "Kedua operator menyimpan nilai.", misconceptions: [] },
  ]),
  "A",
);
assert.equal(legacyOnly.error, undefined, "legacy text-only option must remain valid");
assert.deepEqual(
  legacyOnly.options[0].text,
  { id: "Kedua operator menyimpan nilai.", en: "Kedua operator menyimpan nilai." },
  "legacy text must be duplicated into both locales exactly as before",
);

// B. bilingual text_ind/text_en parses into distinct id/en values
const bilingual = parseQuestionOptions(
  JSON.stringify([
    {
      answer_id: "A637",
      label: "B",
      text_ind: "Kedua operator membandingkan nilai.",
      text_en: "Both operators compare values.",
      misconceptions: ["OP-01"],
    },
  ]),
  "A",
);
assert.equal(bilingual.error, undefined, "a complete text_ind/text_en pair must be valid");
assert.deepEqual(
  bilingual.options[0].text,
  { id: "Kedua operator membandingkan nilai.", en: "Both operators compare values." },
  "text_ind/text_en must map to distinct id/en locales, not be duplicated across languages",
);

// C. missing text_en (only text_ind, no legacy text) is rejected
const missingTextEn = parseQuestionOptions(
  JSON.stringify([
    { answer_id: "A1", label: "A", text_ind: "Hanya bahasa Indonesia.", misconceptions: [] },
  ]),
  "A",
);
assert.ok(missingTextEn.error, "text_ind without text_en must be rejected");
assert.equal(missingTextEn.options.length, 0);

// D. missing text_ind (only text_en, no legacy text) is rejected
const missingTextInd = parseQuestionOptions(
  JSON.stringify([
    { answer_id: "A1", label: "A", text_en: "English only.", misconceptions: [] },
  ]),
  "A",
);
assert.ok(missingTextInd.error, "text_en without text_ind must be rejected");
assert.equal(missingTextInd.options.length, 0);

// E. neither legacy text nor a complete bilingual pair is rejected
const noTextAtAll = parseQuestionOptions(
  JSON.stringify([{ answer_id: "A1", label: "A", misconceptions: [] }]),
  "A",
);
assert.ok(noTextAtAll.error, "an option with no text field at all must be rejected");
assert.equal(noTextAtAll.options.length, 0);

// F. ambiguous shape (legacy text AND a complete bilingual pair together) is
// rejected with a distinct error, per the documented "reject, don't guess" policy.
const ambiguousShape = parseQuestionOptions(
  JSON.stringify([
    {
      answer_id: "A1",
      label: "A",
      text: "Legacy.",
      text_ind: "Bahasa Indonesia.",
      text_en: "English.",
      misconceptions: [],
    },
  ]),
  "A",
);
assert.ok(ambiguousShape.error, "legacy text + complete text_ind/text_en together must be rejected");
assert.match(ambiguousShape.error ?? "", /text_ind/, "the ambiguous-shape error must name the conflicting fields");
assert.equal(ambiguousShape.options.length, 0);

// G. existing current live-style options (legacy shape, 4 choices, one correct)
// remain fully compatible end to end.
const liveStyleOptions = parseQuestionOptions(
  JSON.stringify([
    { answer_id: "A660", label: "A", text: "Tetapkan count <- 0 sebelum if.", is_correct: false, misconceptions: [] },
    { answer_id: "A661", label: "B", text: "Biarkan count tanpa assignment.", is_correct: true, misconceptions: ["VA-05"] },
    { answer_id: "A662", label: "C", text: "Tetapkan count <- 1 sebelum if.", is_correct: false, misconceptions: [] },
    { answer_id: "A663", label: "D", text: "Tetapkan count <- x sebelum if.", is_correct: false, misconceptions: [] },
  ]),
  "B",
);
assert.equal(liveStyleOptions.error, undefined, "current live-style legacy options must still parse cleanly");
assert.equal(liveStyleOptions.options.length, 4);
assert.equal(liveStyleOptions.options.filter((option) => option.isCorrect).length, 1);

// H. misconception mapping and correct-answer identity are unaffected by the
// bilingual shape — only the text representation changes.
const bilingualIdentity = parseQuestionOptions(
  JSON.stringify([
    {
      answer_id: "A196-A",
      label: "A",
      text_ind: "<- menyimpan hasil Boolean; == membandingkan dua nilai.",
      text_en: "<- stores the Boolean result; == compares two values.",
      misconceptions: [],
    },
    {
      answer_id: "A196-B",
      label: "B",
      text_ind: "<- membandingkan dua nilai; == menyimpan hasil Boolean.",
      text_en: "<- compares two values; == stores the Boolean result.",
      misconceptions: ["OP-01"],
    },
  ]),
  "A",
);
assert.equal(bilingualIdentity.error, undefined);
assert.equal(bilingualIdentity.options[0].id, "A196-A");
assert.equal(bilingualIdentity.options[0].isCorrect, true, "correct-answer identity must still follow correct_option_label");
assert.equal(bilingualIdentity.options[1].isCorrect, false);
assert.deepEqual(bilingualIdentity.options[1].misconceptionIds, ["OP-01"], "misconception mapping must be unaffected by the bilingual text shape");
assert.equal(bilingualIdentity.options[1].misconceptionId, "OP-01");

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
