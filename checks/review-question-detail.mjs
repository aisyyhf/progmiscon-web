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
const layout = await readFile(
  new URL("../src/components/layout/LecturerLayout.tsx", import.meta.url),
  "utf8",
);
const reasonCards = await readFile(
  new URL("../src/components/review/MisconceptionReasonCards.tsx", import.meta.url),
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
assert.match(questionWorkspace, /lg:sticky lg:top-14 lg:max-h-\[calc\(100dvh-4\.5rem\)\] lg:overflow-y-auto/);
assert.match(questionWorkspace, /REVIEW MISKONSEPSI SOAL/);
assert.doesNotMatch(questionWorkspace, /Navigasi soal review|Sebelumnya|Berikutnya/);
assert.doesNotMatch(workspacePage, /AdminQuestionContentEditor|isAdmin/);
assert.match(layout, /reviewSearch\.has\("item"\)[\s\S]*?pb-9 pt-3 sm:px-6 md:pt-6/);
assert.match(questionWorkspace, /text-\[1\.375rem\] font-semibold leading-8/);
assert.match(questionWorkspace, /displayQuestionCode = `#\$\{questionCode\.replace\(\/\^#\/, ""\)\}`/);
assert.match(questionWorkspace, /\{questionTitle\}[\s\S]*?\{displayQuestionCode\}/);
assert.match(questionWorkspace, /<CalendarDays size=\{13\}/);
assert.match(questionWorkspace, /<ListFilter size=\{13\}/);
assert.match(questionWorkspace, /!readOnly && reviewerCount !== undefined/);
assert.match(questionWorkspace, /Jawaban yang benar/);
assert.doesNotMatch(questionWorkspace, /Jawaban acuan|Reference answer/);
assert.match(questionWorkspace, /Miskonsepsi terkait/);
assert.match(questionWorkspace, /<TriangleAlert/);
assert.match(questionWorkspace, /sm:grid-cols-2/);
assert.match(questionWorkspace, /min-h-24[\s\S]*?px-3\.5 py-3/);
assert.match(questionWorkspace, /h-16 w-16 rounded-full bg-brand\/\[0\.055\]/);
assert.match(questionWorkspace, /<MisconceptionReasonCards/);
assert.match(reasonCards, /<BrainCircuit/);
assert.match(reasonCards, /border-l-2 border-l-brand\/55/);
assert.match(reasonCards, /Alasan/);
assert.match(questionWorkspace, /absolute inset-x-0 top-0 h-0\.5 bg-brand/);
assert.match(questionWorkspace, /<CircleCheckBig/);
assert.match(questionWorkspace, /-right-2 top-2 h-36 w-36 -rotate-6/);
assert.equal(
  questionWorkspace.match(/bg-brand text-xs font-semibold text-white/g)?.length,
  3,
);
assert.match(questionWorkspace, /remove-misconception-question[\s\S]*?ml-1 text-brand">\*/);
assert.match(questionWorkspace, /add-misconception-question[\s\S]*?ml-1 text-brand">\*/);
assert.match(questionWorkspace, /placeholder=\{language === "id" \? "Komentar\.\." : "Comment\.\."\}/);

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
