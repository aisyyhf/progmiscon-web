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
const questionContent = await readFile(
  new URL("../src/components/review/QuestionContent.tsx", import.meta.url),
  "utf8",
);
const misconceptionPicker = await readFile(
  new URL("../src/components/review/MisconceptionPicker.tsx", import.meta.url),
  "utf8",
);
const styles = await readFile(
  new URL("../src/styles/index.css", import.meta.url),
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
const answerWorkspace = workspacePage.slice(
  workspacePage.indexOf("export function AnswerValidationWorkspace"),
);
const presenceToggle = workspacePage.slice(
  workspacePage.indexOf("function PresenceToggle"),
  workspacePage.indexOf("function orderAnswersByTaskPriority"),
);
const answerRemovalSection = answerWorkspace.slice(
  answerWorkspace.indexOf('aria-labelledby="remove-answer-misconception-question"'),
  answerWorkspace.indexOf('aria-labelledby="add-answer-misconception-question"'),
);
const completionDialog = activePage.slice(
  activePage.indexOf("function ReviewCompletionDialog"),
  activePage.indexOf("function WeekOverview"),
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
assert.match(questionWorkspace, /review-question-detail mt-6/);
assert.doesNotMatch(questionWorkspace, /review-question-detail mt-6 md:mt-10/);
assert.doesNotMatch(questionWorkspace, /lg:sticky|lg:max-h-|lg:overflow-y-auto|thin-scroll/);
assert.match(questionWorkspace, /REVIEW MISKONSEPSI SOAL/);
assert.doesNotMatch(questionWorkspace, /Navigasi soal review|Sebelumnya|Berikutnya/);
assert.doesNotMatch(workspacePage, /AdminQuestionContentEditor|isAdmin/);
assert.match(layout, /reviewSearch\.has\("item"\)[\s\S]*?pb-9 pt-3 sm:px-6 md:pt-6/);
assert.match(questionWorkspace, /text-\[1\.4375rem\] font-semibold leading-8[\s\S]*?md:text-\[1\.5625rem\]/);
assert.match(questionWorkspace, /displayQuestionCode = `#\$\{questionCode\.replace\(\/\^#\/, ""\)\}`/);
assert.match(questionWorkspace, /\{questionTitle\}[\s\S]*?\{displayQuestionCode\}/);
assert.match(questionWorkspace, /text-xs font-normal leading-5 tracking-normal text-muted/);
assert.match(questionWorkspace, /text-\[13px\] font-normal leading-5/);
assert.match(questionWorkspace, /<Lightbulb size=\{14\}/);
assert.doesNotMatch(questionWorkspace, /<ListFilter size=\{14\}/);
assert.doesNotMatch(questionWorkspace, /review-detail-meta-week|normalizedWeekNumber/);
assert.match(questionWorkspace, /review-detail-meta-kc/);
assert.match(styles, /review-detail-meta-kc[\s\S]*?var\(--progmiscon-secondary\) 60%[\s\S]*?var\(--progmiscon-text\)/);
assert.doesNotMatch(questionWorkspace, /questionReviewCount|reviewerCountLabel|Reviewer:/);
assert.match(questionWorkspace, /language === "id" \? "Konsep:" : "Concepts:"/);
assert.match(questionWorkspace, /Simpan & Selesai/);
assert.match(questionWorkspace, /Simpan & Lanjut ke Review Jawaban/);
assert.match(questionWorkspace, /Simpan Perubahan/);
assert.match(questionWorkspace, /Jawaban yang benar/);
assert.doesNotMatch(questionWorkspace, /Jawaban acuan|Reference answer/);
assert.match(questionWorkspace, /Miskonsepsi terkait/);
assert.match(questionWorkspace, /flex items-center gap-1\.5 text-base[\s\S]*?h-6 w-5[\s\S]*?<TriangleAlert size=\{16\}/);
assert.match(questionWorkspace, /sm:grid-cols-2/);
assert.match(questionWorkspace, /min-h-\[4\.5rem\][\s\S]*?px-3 py-2\.5/);
assert.match(questionWorkspace, /h-12 w-12 rounded-full bg-brand\/\[0\.055\]/);
assert.match(questionWorkspace, /text-\[11px\] font-normal leading-4 text-brand/);
assert.match(questionWorkspace, /text-xs font-normal leading-\[18px\] text-navy-deep/);
assert.match(questionWorkspace, /<MisconceptionReasonCards/);
assert.match(reasonCards, /<BrainCircuit/);
assert.match(reasonCards, /border-l-2 border-l-brand\/55/);
assert.match(reasonCards, /Alasan/);
assert.match(questionWorkspace, /rounded-xl border border-\[#ccbab0\] border-t-2 border-t-brand/);
assert.doesNotMatch(questionWorkspace, /absolute inset-x-0 top-0 h-0\.5 bg-brand/);
assert.match(questionWorkspace, /<CircleCheckBig/);
assert.match(questionWorkspace, /right-2 top-2 h-36 w-36 -rotate-6/);
assert.equal(
  questionWorkspace.match(/h-5 w-5[\s\S]{0,100}bg-brand text-xs font-medium leading-5 text-white/g)?.length,
  3,
);
assert.match(presenceToggle, /inline-grid w-fit grid-cols-2 gap-0\.5/);
assert.match(presenceToggle, /min-h-7 min-w-20[\s\S]*?px-2\.5 py-1 text-xs font-normal leading-4/);
assert.match(presenceToggle, /border-brand\/20 bg-brand-soft\/65 text-brand/);
assert.doesNotMatch(presenceToggle, /min-h-9|w-full|py-2 text-xs/);
assert.match(activePage, /text-\[10px\] leading-4 text-muted/);
assert.match(questionContent, /space-y-3/);
assert.match(questionContent, /whitespace-pre-wrap text-xs font-normal leading-5/);
assert.match(questionContent, /<table[\s\S]*?<caption[\s\S]*?Contoh kasus/);
assert.match(questionContent, /<th[\s\S]*?Masukan[\s\S]*?<th[\s\S]*?Keluaran/);
assert.match(questionContent, /odd:bg-white even:bg-\[var\(--review-secondary-soft\)\]/);
assert.match(questionContent, /border border-\[#ccbab0\]\/70 px-2\.5 py-1\.5/);
assert.doesNotMatch(questionContent, /sm:grid-cols-2|<article key=|blue|green|gray|slate/);
assert.match(questionWorkspace, /remove-misconception-question[\s\S]*?ml-1 text-brand">\*/);
assert.match(questionWorkspace, /add-misconception-question[\s\S]*?ml-1 text-brand">\*/);
assert.match(questionWorkspace, /placeholder=\{language === "id" \? "Komentar\.\." : "Comment\.\."\}/);
assert.match(questionWorkspace, /question-validation-note[\s\S]*?min-h-16 resize-y/);
assert.match(questionWorkspace, /<legend className="text-xs font-normal[^"]*">[\s\S]*?Pilih yang perlu dihapus/);
assert.match(questionWorkspace, /htmlFor="removal-reason" className="block text-xs font-normal/);
assert.match(questionWorkspace, /htmlFor="addition-reason" className="block text-xs font-normal/);
assert.match(questionWorkspace, /\{item\.id\}[\s\S]*?t\(item\.title, language\)/);
assert.doesNotMatch(questionWorkspace, /misconceptionSourceLabel|Terkait langsung ke soal|—/);
assert.doesNotMatch(questionWorkspace, /Miskonsepsi yang ditambahkan|Anda dapat memilih lebih dari satu\.|Belum ada miskonsepsi tambahan yang dipilih\./);
assert.match(misconceptionPicker, /Pilih Miskonsepsi yang Ditambahkan/);
assert.match(misconceptionPicker, /variant === "selection" \? "w-full" : "w-fit"/);
assert.match(misconceptionPicker, /variant === "selection" \? \(\s*<ListPlus size=\{14\}/);
assert.doesNotMatch(misconceptionPicker, /Belum ada miskonsepsi tambahan yang dipilih\.|Anda dapat memilih lebih dari satu miskonsepsi\./);

assert.equal(
  answerWorkspace.match(/h-5 w-5[\s\S]{0,100}bg-brand text-xs font-medium leading-5 text-white/g)?.length,
  3,
);
assert.doesNotMatch(
  answerRemovalSection,
  /yesDisabled|selectedOption\.isCorrect|answer\.status/,
  "Question 1 Ada must stay enabled for both incorrect and correct MP answers",
);
assert.match(answerWorkspace, /add-answer-misconception-question[\s\S]*?yesDisabled=\{addableMisconceptions\.length === 0\}/);
assert.match(answerWorkspace, /await onSubmit\(buildAnswerReviewValues\(form\)\)/);
assert.doesNotMatch(answerWorkspace, /reviewerCountLabel|Math\.min\(answerReviewCount/);
assert.match(answerWorkspace, /answer-validation-note[\s\S]*?placeholder=\{language === "id" \? "Komentar\.\." : "Comment\.\."\}[\s\S]*?min-h-16 resize-y/);
assert.match(answerWorkspace, /REVIEW JAWABAN/);
assert.match(answerWorkspace, /Jawaban yang sedang direview/);
assert.match(answerWorkspace, /`Jawaban \$\{activeIndex \+ 1\} dari \$\{siblingAnswerIds\.length\}`/);
assert.match(answerWorkspace, /Lihat soal & pilihan jawaban/);
assert.match(answerWorkspace, /Jawaban benar/);
assert.match(answerWorkspace, /Sedang direview/);
assert.match(answerWorkspace, /Lihat evidence/);
assert.match(answerWorkspace, /isFinalAnswer[\s\S]*?Simpan & Selesai[\s\S]*?Simpan & Lanjut/);
assert.match(answerWorkspace, /Simpan Perubahan/);
assert.doesNotMatch(answerWorkspace, /<SiblingNavigator/);
assert.match(answerWorkspace, /EDIT REVIEW JAWABAN/);
assert.match(answerWorkspace, /HASIL REVIEW JAWABAN/);
assert.match(answerWorkspace, /formUnavailable = mode === "view" \|\| locked \|\| progressUnavailable/);
assert.match(answerWorkspace, /<ReviewStepNavigation previous=\{previousStep\} next=\{nextStep\} \/>/);

assert.match(questionWorkspace, /Lihat evidence/);
assert.match(questionWorkspace, /!answerReviewEligible && \([\s\S]*?<details className="group\/evidence"/);
assert.match(questionWorkspace, /review-evidence-disclosure/);
assert.doesNotMatch(questionWorkspace, /Jawaban terkait|Review jawaban|onReviewAnswer/);
assert.doesNotMatch(questionDetail, /onReviewAnswer=/);
assert.doesNotMatch(questionWorkspace, /<SubmittedQuestionReview|Mode lihat/);
assert.match(questionWorkspace, /EDIT REVIEW SOAL/);
assert.match(questionWorkspace, /HASIL REVIEW SOAL/);
assert.match(app, /path="\/review\/answer\/:answerId"/);

assert.match(
  workspacePage,
  /questionReviewCounts\.get\(activeQuestion\.id\) \?\? 0\) >=\s*QUESTION_REVIEWED_THRESHOLD/,
);
assert.match(
  workspacePage,
  /const activeQuestionLocked =\s*activeQuestionGloballyComplete && !activeQuestionReviewedByMe/,
);
assert.match(questionWorkspace, /formUnavailable = mode === "view" \|\| locked \|\| progressUnavailable/);
assert.match(questionWorkspace, /<ReviewStepNavigation previous=\{previousStep\} next=\{nextStep\} \/>/);
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
assert.match(activePage, /Review soal telah berhasil disimpan\./);
assert.match(activePage, /Review soal dan seluruh jawaban yang tersedia telah selesai\./);
assert.match(completionDialog, /createPortal\(/);
assert.match(completionDialog, /<dialog/);
assert.match(completionDialog, /fixed inset-0[^"]*h-dvh[^"]*w-screen[^"]*backdrop:bg-black\/25/);
assert.match(completionDialog, /document\.body\.style\.overflow = "hidden"/);
assert.match(completionDialog, /document\.body/);
assert.match(completionDialog, /p-6 text-center/);
assert.match(completionDialog, /mx-auto flex h-9 w-9/);
assert.match(completionDialog, /className="mt-5 w-full justify-center"/);
assert.match(activePage, /getActionableAnswerReviewSequence/);
assert.match(activePage, /getNextUnreviewedAnswerId/);
assert.match(activePage, /confirmedQuestionReviewIds/);
assert.match(activePage, /confirmedAnswerReviewIds/);
assert.match(activePage, /pendingNavigation \?\?/);
assert.match(activePage, /setPendingNavigation\(next\)/);
assert.match(activePage, /pendingNavigation \|\|/);
assert.match(
  activePage,
  /if \(navigation\.mode === "edit"\) return;[\s\S]*?activeQuestion\.type !== "multiple_choice"[\s\S]*?getNextUnreviewedAnswerId\([\s\S]*?resolveAnswerDeepLink\(/,
  "Review mode continues a prefilled partial MP while explicit Edit mode stays put",
);
assert.match(activePage, /returnAnswerId \?\?\s*getNextUnreviewedAnswerId/);
assert.match(activePage, /mode: navigation\.mode/);
assert.match(activePage, /previousStep=\{answerPreviousStep\}/);
assert.match(activePage, /nextStep=\{answerNextStep\}/);
assert.match(activePage, /nextStep=\{questionNextStep\}/);
assert.match(workspacePage, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/);
assert.match(workspacePage, /\.focus\(\{ preventScroll: true \}\)/);
assert.match(workspacePage, /getMisconceptionReviewFormErrors\(form\)/);
assert.doesNotMatch(questionWorkspace, /disabled=\{[^}]*canSubmit/);
assert.doesNotMatch(answerWorkspace, /disabled=\{[^}]*canSubmit/);
assert.match(
  activePage,
  /status: "reviewed",\s*item: activeQuestion\.id,[\s\S]*?setCompletionDialog\("question"\)/,
);
assert.match(
  activePage,
  /if \(target\) \{\s*commitNavigation\(\{[\s\S]*?\.\.\.target,[\s\S]*?mode: "review"[\s\S]*?\}\);\s*\} else \{\s*commitNavigation\(\{[\s\S]*?item: activeQuestion\.id,[\s\S]*?setCompletionDialog\("workflow"\)/,
  "an MP question with no eligible answer completes without selecting another question",
);
assert.match(
  activePage,
  /task: "question",\s*status: "reviewed",[\s\S]*?item: answerQuestion\.id,[\s\S]*?setCompletionDialog\("workflow"\)/,
);
assert.match(activePage, /\{ replace: true \}/);

console.log("Question-detail redesign self-check passed.");
