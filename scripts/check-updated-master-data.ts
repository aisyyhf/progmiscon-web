import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildQuestionContentBlocks,
  buildSampleCases,
  isDummyData,
  parseDelimitedIds,
  parseReasonMap,
} from "../src/utils/masterDataContent.ts";

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
assert.doesNotMatch(lecturerSource, /groupMisconceptionReasons/);
assert.doesNotMatch(evidenceSource, /groupMisconceptionReasons/);

console.log("updated master-data checks passed");
