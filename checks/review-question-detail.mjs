import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  buildOptionMisconceptionMappings,
} from "../src/utils/optionMisconceptionMapping.ts";

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

const questionWorkspace = workspacePage.slice(
  workspacePage.indexOf("export function QuestionValidationWorkspace"),
  workspacePage.indexOf("export function AnswerValidationWorkspace"),
);
const completionDialog = activePage.slice(
  activePage.indexOf("function ReviewCompletionDialog"),
  activePage.indexOf("function WeekOverview"),
);
const detailReturn = activePage.slice(
  activePage.lastIndexOf("const detailLabel = activeQuestion"),
);

// ---------------------------------------------------------------------------
// buildOptionMisconceptionMappings: EFFECTIVE per-option relation (answer
// misconceptions + published answer overrides via getSheetAnswers), joined to
// options by answer id. NOT options_json, NOT answer_reviews.
// ---------------------------------------------------------------------------
const localized = (value) => ({ id: value, en: value });
const mpQuestion = {
  type: "multiple_choice",
  options: [
    { id: "opt-a", label: "A", text: localized("12 lalu 12"), isCorrect: false, misconceptionIds: ["STALE"] },
    { id: "opt-b", label: "B", text: localized("total lalu 12"), isCorrect: true, misconceptionIds: [] },
    { id: "opt-c", label: "C", text: localized("total lalu total"), isCorrect: false, misconceptionIds: [] },
    { id: "opt-d", label: "D", text: localized("Hanya 12"), isCorrect: false, misconceptionIds: [] },
  ],
};
const effectiveAnswers = [
  {
    id: "opt-a",
    answerRole: "mp_option",
    studentMisconceptionIds: ["IO-02"],
    misconceptionReasons: [{ misconceptionId: "IO-02", reason: localized("Nama tertukar nilai") }],
  },
  { id: "opt-b", answerRole: "mp_option", studentMisconceptionIds: [] },
  { id: "opt-c", answerRole: "mp_option", studentMisconceptionIds: ["IO-02"] },
  { id: "opt-d", answerRole: "mp_option", studentMisconceptionIds: [] },
];
const mapping = buildOptionMisconceptionMappings(mpQuestion, effectiveAnswers);
assert.equal(mapping.length, 4);
assert.deepEqual(mapping.map((m) => m.label), ["A", "B", "C", "D"]);
assert.deepEqual(
  mapping[0].misconceptionIds,
  ["IO-02"],
  "option mapping uses the effective answer relation, not the stale options_json ids",
);
assert.equal(mapping[0].reasonByMisconceptionId.get("IO-02").id, "Nama tertukar nilai");
assert.ok(mapping[1].isCorrect && mapping[1].misconceptionIds.length === 0);
assert.deepEqual(mapping[3].misconceptionIds, [], "an unmapped incorrect option has no misconception");
assert.deepEqual(
  buildOptionMisconceptionMappings({ type: "short_answer", options: undefined }, effectiveAnswers),
  [],
  "PS questions have no option mapping",
);
assert.deepEqual(
  buildOptionMisconceptionMappings(
    { type: "multiple_choice", options: [{ id: "x", label: "A", text: localized("x"), isCorrect: false, misconceptionIds: ["Z"] }] },
    [],
  )[0].misconceptionIds,
  [],
  "no matching effective answer -> no misconception (never falls back to options_json)",
);

// ---------------------------------------------------------------------------
// Question detail render: breadcrumb + QuestionValidationWorkspace only. No
// queue, task toggle, week <select>, or in-page history control.
// ---------------------------------------------------------------------------
assert.match(detailReturn, /<ReviewBreadcrumb/);
assert.match(detailReturn, /<QuestionValidationWorkspace/);
assert.doesNotMatch(detailReturn, /<QueuePanel|<AnswerValidationWorkspace|<select|segmented-control|Status pribadi|Personal status|>Riwayat<|>History</);
assert.match(detailReturn, /progressUnavailable=\{!navigationReady \|\| !activeQuestion\.sourceVersion\}/);
assert.doesNotMatch(detailReturn, /nextStep=\{questionNextStep\}|returnAnswer/);

// ---------------------------------------------------------------------------
// QuestionValidationWorkspace
// ---------------------------------------------------------------------------
assert.match(questionWorkspace, /className="review-question-detail"/);
assert.match(questionWorkspace, /<QuestionContent question=\{question\} \/>/);
assert.match(questionWorkspace, /Miskonsepsi terkait/);
// NEW: read-only "Pemetaan pilihan jawaban" block, sourced from the effective
// per-option relation, shown BEFORE any review controls.
assert.match(questionWorkspace, /buildOptionMisconceptionMappings\(question, answers\)/);
assert.match(questionWorkspace, /optionMisconceptionMappings\.length > 0/);
assert.match(questionWorkspace, /Pemetaan pilihan jawaban/);
assert.match(questionWorkspace, /language === "id"\s*\?\s*"Jawaban benar"/);
assert.match(questionWorkspace, /Tidak ada miskonsepsi yang dipetakan/);
assert.match(questionWorkspace, /mapping\.reasonByMisconceptionId\.get\(misconceptionId\)/);
// The mapping block sits in the left article, before the review <aside> form.
assert.ok(
  questionWorkspace.indexOf("Pemetaan pilihan jawaban") <
    questionWorkspace.indexOf("REVIEW MISKONSEPSI SOAL"),
  "the option mapping renders before the review controls",
);
// One-step submit for every question type: no "continue to answer review".
assert.match(questionWorkspace, /Simpan & Selesai/);
assert.doesNotMatch(questionWorkspace, /Simpan & Lanjut ke Review Jawaban|Continue to Answer Review|multiple_choice \?\s*"Simpan/);
assert.match(questionWorkspace, /Simpan Perubahan/);
assert.doesNotMatch(questionWorkspace, /await onDelete\(\)|variant="danger"/);
assert.match(questionWorkspace, /await onSubmit\(buildQuestionReviewValues\(form\)\)/);
assert.match(questionWorkspace, /formUnavailable = mode === "view" \|\| locked \|\| progressUnavailable/);
// answer-derived question misconceptions are still part of the effective set.
assert.doesNotMatch(questionWorkspace, /directQuestionMisconceptionIds only|answerDerived.*removed/i);

// ---------------------------------------------------------------------------
// MP submit is one-step; delete is question-only.
// ---------------------------------------------------------------------------
const submit = activePage.slice(
  activePage.indexOf("const handleQuestionSubmit"),
  activePage.indexOf("if (reviewSessionState"),
);
assert.match(submit, /commitNavigation\(\{[\s\S]*?status: "reviewed",[\s\S]*?item: activeQuestion\.id,[\s\S]*?\}\);\s*setCompletionDialog\(true\)/);
assert.doesNotMatch(submit, /multiple_choice|resolveAnswerDeepLink|getNextUnreviewedAnswerId|setCompletionDialog\("workflow"\)/);
assert.match(
  activePage,
  /deleteQuestionReviewWorkflow\(question\.id, question\.sourceVersion\)/,
);
assert.doesNotMatch(activePage, /setAnswerHistory|setConfirmedAnswerReviewIds/);

// ---------------------------------------------------------------------------
// ReviewCompletionDialog: question-only wording.
// ---------------------------------------------------------------------------
assert.match(completionDialog, /createPortal\(/);
assert.match(completionDialog, /<dialog/);
assert.match(completionDialog, /Review soal telah berhasil disimpan\./);
assert.doesNotMatch(completionDialog, /seluruh jawaban yang tersedia|all available answers|kind/);

// ---------------------------------------------------------------------------
// Persistence: v3 write RPCs are all still wired (legacy answer RPCs stay
// callable for backward compatibility -- dormant, unused by the active page).
// ---------------------------------------------------------------------------
for (const call of [
  "save_question_review_v3",
  "save_answer_review_v3",
  "delete_question_review_workflow_v3",
  "delete_answer_review_v3",
]) {
  assert.match(persistence, new RegExp(`supabase\\.rpc\\("${call}"`));
}
// The active week-first page only calls the question write paths.
assert.doesNotMatch(activePage, /saveAnswerReview|deleteAnswerReview/);

// Old direct Answer Review URL redirects; it never opens an editable review.
assert.match(app, /path="\/review\/answer\/:answerId"/);
assert.match(app, /RetiredAnswerReviewRedirect[\s\S]*?<Navigate to="\/review" replace \/>/);

console.log("Question-detail redesign self-check passed.");
