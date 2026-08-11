import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildQuestionContentBlocks,
  buildSampleCases,
  isDummyData,
  parseDelimitedIds,
  parseReasonMap,
} from "../src/utils/masterDataContent.ts";
import { resolveEvidenceIdentity } from "../src/utils/evidenceIdentity.ts";

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
assert.match(lecturerSource, /<QuestionContent question=\{question\}/);
assert.match(evidenceSource, /<QuestionContent question=\{question\}/);
assert.match(evidenceSource, /identity\?\.secondary/);
assert.doesNotMatch(evidenceSource, /anonymous-/);
assert.doesNotMatch(lecturerSource, /groupMisconceptionReasons/);
assert.doesNotMatch(evidenceSource, /groupMisconceptionReasons/);

console.log("updated master-data checks passed");
