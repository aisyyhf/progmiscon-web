import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const activePage = await readFile(
  new URL("../src/pages/LecturerReviewWeekFirstPage.tsx", import.meta.url),
  "utf8",
);
const workspacePage = await readFile(
  new URL("../src/pages/LecturerReviewPage.tsx", import.meta.url),
  "utf8",
);
const persistence = await readFile(
  new URL("../src/services/reviewPersistenceRepository.ts", import.meta.url),
  "utf8",
);
const app = await readFile(
  new URL("../src/app/App.tsx", import.meta.url),
  "utf8",
);

const questionDetailStart = activePage.indexOf(
  'if (isQuestionDetailTask(navigation.task))',
);
const questionDetailEnd = activePage.indexOf(
  '<div className="lecturer-ui mx-auto max-w-[1440px] text-black">',
  questionDetailStart,
);
const questionDetail = activePage.slice(questionDetailStart, questionDetailEnd);
const questionWorkspace = workspacePage.slice(
  workspacePage.indexOf("export function QuestionValidationWorkspace"),
  workspacePage.indexOf("export function AnswerValidationWorkspace"),
);

assert.ok(questionDetailStart >= 0 && questionDetailEnd > questionDetailStart);
assert.match(questionDetail, /<ReviewBreadcrumb/);
assert.match(activePage, /t\(detailQuestion\.title, language\)/);
assert.match(questionDetail, /<QuestionValidationWorkspace/);
assert.doesNotMatch(questionDetail, /<QueuePanel|Antrean|Queue/);
assert.doesNotMatch(questionDetail, /segmented-control|Status pribadi|Personal status/);
assert.doesNotMatch(questionDetail, /Jenis soal|Question type/);
assert.doesNotMatch(questionDetail, /reviewedTotal|contextTotal/);
assert.doesNotMatch(questionDetail, /<History|>Riwayat<|>History</);
assert.doesNotMatch(questionDetail, /<select/);

assert.match(
  questionWorkspace,
  /grid-cols-\[minmax\(0,1\.65fr\)_minmax\(22rem,1fr\)\]/,
);
assert.match(questionWorkspace, /<article className="min-w-0">/);
assert.doesNotMatch(
  questionWorkspace,
  /<article className="[^"]*(?:review-folder-primary|rounded-lg border border-border bg-white)/,
);
assert.match(questionWorkspace, /<QuestionContent question=\{question\} \/>/);
assert.match(questionWorkspace, /lg:sticky lg:top-6/);
assert.match(questionWorkspace, /REVIEW MISKONSEPSI SOAL/);
assert.doesNotMatch(questionWorkspace, /Navigasi soal review|Sebelumnya|Berikutnya/);

assert.match(questionWorkspace, /Lihat evidence/);
assert.match(questionWorkspace, /<details[\s\S]*?open=\{answerReviewEligible \|\| undefined\}/);
assert.match(questionWorkspace, /review-evidence-disclosure/);
assert.match(
  questionWorkspace,
  /!readOnly && answerReviewEligible && onReviewAnswer/,
  "PS evidence must never expose the MP answer-review action",
);
assert.match(questionWorkspace, /Review jawaban/);
assert.match(
  questionDetail,
  /onReviewAnswer=\{\(answerId\) => \{[\s\S]*?resolveAnswerDeepLink\([\s\S]*?changeNavigation\(target\)/,
);
assert.match(app, /path="\/review\/answer\/:answerId"/);

assert.match(questionWorkspace, /questionReviewCount/);
assert.match(questionWorkspace, /QUESTION_REVIEWED_THRESHOLD/);
assert.match(questionWorkspace, /\{reviewerCount\}\/\{QUESTION_REVIEWED_THRESHOLD\}/);
assert.match(questionWorkspace, /formUnavailable = readOnly \|\| locked \|\| progressUnavailable/);
assert.match(questionWorkspace, /await onSubmit\(buildQuestionReviewValues\(form\)\)/);
assert.match(questionWorkspace, /await onDelete\(\)/);

for (const call of [
  "save_question_review_v3",
  "save_answer_review_v3",
  "delete_question_review_v3",
  "delete_answer_review_v3",
]) {
  assert.match(persistence, new RegExp(`supabase\\.rpc\\("${call}"`));
}
assert.match(questionDetail, /progressUnavailable=\{!navigationReady \|\| !activeQuestion\.sourceVersion\}/);
assert.match(activePage, /getActiveCurrentQuestionReviewIds\(questionHistory, sourceVersions\.questions\)/);
assert.match(activePage, /getActiveCurrentAnswerReviewIds\(answerHistory, sourceVersions\.answers\)/);

console.log("Question-detail redesign self-check passed.");
