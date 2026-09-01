// MP lecturer review is now a ONE-PAGE Question Review, like PS. The A/B/C/D
// Answer Review workflow is retired from the active product; legacy answer_reviews
// and answer_misconception_overrides stay stored and dormant. This check pins the
// new contract end to end.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  REVIEW_NAVIGATION_SESSION_KEY,
  buildReviewQueue,
  normalizeReviewNavigationState,
  parseReviewNavigationSession,
  serializeReviewNavigationSession,
} from "../src/utils/reviewQueue.ts";
import { buildOptionMisconceptionMappings } from "../src/utils/optionMisconceptionMapping.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [
  weekFirstPage,
  workspacePage,
  historyPage,
  adminReviewsPage,
  adminExports,
  sidebar,
  app,
  migration,
  stagingBootstrap,
] = await Promise.all([
  read("src/pages/LecturerReviewWeekFirstPage.tsx"),
  read("src/pages/LecturerReviewPage.tsx"),
  read("src/pages/LecturerReviewHistoryPage.tsx"),
  read("src/pages/AdminReviewsPage.tsx"),
  read("src/utils/adminExports.ts"),
  read("src/components/layout/LecturerSidebar.tsx"),
  read("src/app/App.tsx"),
  read("supabase/migrations/20260901000000_review_v3_mp_question_only_delete.sql"),
  read("database/staging/staging-bootstrap.sql"),
]);
const localized = (value) => ({ id: value, en: value });

// --- A. MP one-step completion --------------------------------------------
const submit = weekFirstPage.slice(
  weekFirstPage.indexOf("const handleQuestionSubmit"),
  weekFirstPage.indexOf("if (reviewSessionState"),
);
assert.doesNotMatch(
  submit,
  /multiple_choice|resolveAnswerDeepLink|getNextUnreviewedAnswerId|setCompletionDialog\("workflow"\)/,
  "MP question submit is identical to PS -- no A/B/C/D follow-up",
);
assert.match(submit, /status: "reviewed",\s*item: activeQuestion\.id,/);
assert.match(submit, /setCompletionDialog\(true\)/);
// "reviewed" is driven by the raw active current-version Question Review set.
assert.match(
  weekFirstPage,
  /const reviewedQuestionIds = reviewedQuestionStepIds;/,
  "MP and PS week completion both = active current-version Question Review",
);
assert.doesNotMatch(weekFirstPage, /getCompositeReviewedQuestionIds/);

// --- B. Pre-review option mapping ----------------------------------------
const questionWorkspace = workspacePage.slice(
  workspacePage.indexOf("export function QuestionValidationWorkspace"),
  workspacePage.indexOf("export function AnswerValidationWorkspace"),
);
assert.match(questionWorkspace, /buildOptionMisconceptionMappings\(question, answers\)/);
assert.match(questionWorkspace, /optionMisconceptionMappings\.length > 0/);
assert.match(questionWorkspace, /Jawaban benar/);
assert.match(questionWorkspace, /Tidak ada miskonsepsi yang dipetakan/);
// No separate "mapping feature" section: no heading / helper / divider.
assert.doesNotMatch(questionWorkspace, /Pemetaan pilihan jawaban|Konteks read-only|Answer option mapping/);
// The option list + its mapping renders before the review controls / submit.
assert.ok(
  questionWorkspace.indexOf("optionMisconceptionMappings.map") <
    questionWorkspace.indexOf("REVIEW MISKONSEPSI SOAL"),
  "the option list renders before the lecturer's review controls / submit",
);
// Option label + text is bold; the misconception line is subordinate.
assert.match(
  questionWorkspace,
  /min-w-0 flex-1 text-xs font-semibold leading-5 text-navy-deep[\s\S]{0,80}\{mapping\.label\}/,
);
// Correct option card: the #2F6B4F success green -- solid border + a very
// light #2F6B4F tint background (not a paler grey-green substitute).
assert.match(
  questionWorkspace,
  /mapping\.isCorrect\s*\?\s*"border-\[#2F6B4F\] bg-\[rgba\(47,107,79,0\.08\)\]"/,
);
assert.match(questionWorkspace, /Jawaban benar[\s\S]{0,120}text-\[#2F6B4F\]|text-\[#2F6B4F\][\s\S]{0,220}Jawaban benar/);
// "Jawaban benar" is an inline badge rendered by `{mapping.isCorrect && (` on
// the main option row -- never a ternary that suppresses the mapping.
assert.match(questionWorkspace, /\{mapping\.isCorrect && \(/);
assert.doesNotMatch(questionWorkspace, /mapping\.isCorrect \? \(/);
const badgeAt = questionWorkspace.indexOf("Jawaban benar");
const mappingListAt = questionWorkspace.indexOf("mapping.misconceptionIds.map");
const emptyStateAt = questionWorkspace.indexOf("Tidak ada miskonsepsi yang dipetakan");
assert.ok(
  badgeAt > 0 && badgeAt < mappingListAt && mappingListAt < emptyStateAt,
  "the badge is on the main row, above the correctness-independent mapping area",
);
// Minimal mapping line: "↳ <code> · <name>" -- no rationale, no colon, no dash,
// muted/brand secondary weight (smaller than the option text).
assert.match(questionWorkspace, /\{"↳ "\}/);
assert.match(questionWorkspace, /\{"·"\}/);
assert.match(
  questionWorkspace,
  /className="text-\[10px\] font-normal leading-4 text-brand"[\s\S]{0,220}\{misconceptionId\}/,
);
assert.doesNotMatch(
  questionWorkspace,
  /reasonByMisconceptionId|misconceptionReasons|terkait miskonsepsi|— |mapping\.text[\s\S]{0,40}font-bold/,
);

const question = {
  type: "multiple_choice",
  options: [
    { id: "a", label: "A", text: localized("12 lalu 12"), isCorrect: false, misconceptionIds: ["STALE-JSON"] },
    { id: "b", label: "B", text: localized("total lalu 12"), isCorrect: true, misconceptionIds: [] },
    { id: "d", label: "D", text: localized("Hanya 12"), isCorrect: false, misconceptionIds: [] },
  ],
};
// --- C. Effective override source (not stale options_json, not answer_reviews)
const map = buildOptionMisconceptionMappings(question, [
  { id: "a", answerRole: "mp_option", studentMisconceptionIds: ["IO-02"] },
  { id: "b", answerRole: "mp_option", studentMisconceptionIds: [] },
  { id: "d", answerRole: "mp_option", studentMisconceptionIds: [] },
]);
assert.deepEqual(map.map((m) => m.label), ["A", "B", "D"]);
assert.deepEqual(map[0].misconceptionIds, ["IO-02"], "effective relation wins over options_json");
assert.ok(map[1].isCorrect);
assert.deepEqual(map[2].misconceptionIds, []);
assert.deepEqual(
  buildOptionMisconceptionMappings({ type: "short_answer", options: undefined }, []),
  [],
);
const mappingSource = await read("src/utils/optionMisconceptionMapping.ts");
assert.match(mappingSource, /answer\.studentMisconceptionIds/);
assert.doesNotMatch(
  mappingSource,
  /from "\.\.\/services\/|option\.misconceptionIds|\.removedMisconceptionIds|\.additionalMisconceptionIds/,
  "the helper reads only the effective per-answer relation, never options_json or review rows",
);

// --- D. Old navigation ---------------------------------------------------
assert.ok(REVIEW_NAVIGATION_SESSION_KEY.endsWith(".v3"));
const normalized = normalizeReviewNavigationState(
  { week: "W02", task: "answer", status: "reviewed", type: "mp", mode: "review", item: "x", returnAnswer: "y" },
  { questions: [{ id: "Q1", type: "multiple_choice", week: "W02" }], reviewedQuestionIds: [] },
);
assert.equal(normalized.task, "question");
assert.equal(normalized.returnAnswer, undefined);
assert.equal(
  buildReviewQueue({ questions: [], week: "W02", task: "answer", status: "unreviewed", type: "all", reviewedQuestionIds: [] }).length,
  0,
);
assert.deepEqual(
  parseReviewNavigationSession('{"version":2,"task":"answer"}'),
  {},
  "a stale v2 answer-navigation session does not crash and is dropped",
);
assert.deepEqual(
  parseReviewNavigationSession(serializeReviewNavigationSession(normalized)).version,
  3,
);
assert.match(app, /RetiredAnswerReviewRedirect[\s\S]*?<Navigate to="\/review" replace \/>/);
assert.doesNotMatch(app, /LecturerAnswerReviewRoute|initialAnswerId/);
assert.doesNotMatch(sidebar, /task=answer|\/review\/answer\//);

// --- Retire active Answer Review UI (no queue / toggle / nav / progress) --
assert.doesNotMatch(
  weekFirstPage,
  /AnswerValidationWorkspace|QueuePanel|saveAnswerReview|deleteAnswerReview|navigation\.task === "answer"|Question\/Answer|task, type: "all"|reviewedTotal|contextTotal/,
);

// --- E. PS regression: PS still one-step (unchanged shape) ---------------
assert.match(submit, /commitNavigation\(\{[\s\S]*?status: "reviewed"/);
assert.match(questionWorkspace, /Simpan & Selesai/);
assert.doesNotMatch(questionWorkspace, /Simpan & Lanjut ke Review Jawaban/);

// --- F. Admin / history: question-only ---------------------------------
assert.doesNotMatch(
  adminReviewsPage,
  /Review pilihan jawaban|Answer option reviews|"Review jawaban" : "Answer reviews"/,
);
assert.match(adminReviewsPage, /groupCurrentAdminReviews\(data\.current, data\.questions\)/);
assert.doesNotMatch(historyPage, /Validasi Jawaban|Answer Validation|history\.answerReviews\.map|AnswerHistoryCard/);
assert.match(historyPage, /history\.questionReviews\.length > 0/);
// PR59 lifecycle wording preserved.
assert.match(adminExports, /active: "Aktif"/);
assert.match(adminExports, /deleted: "Dihapus"/);
assert.match(adminExports, /created: "Direview"/);

// --- G. CSV: question-review-centric, narrowed -------------------------
assert.doesNotMatch(
  adminExports,
  /"Bagian yang Direview"|"Opsi Jawaban"|"Isi Jawaban"|"Pemetaan Opsi"|"Kode Miskonsepsi"|serializeOptionMisconceptionMapping|buildOptionMisconceptionMappings/,
  "per-option mapping and target-misconception code are on-screen context only, not CSV columns",
);
assert.doesNotMatch(adminExports, /for \(const \{ answer, review \} of reviewerGroup\.answerReviews\)/);
const csvHeaders = adminExports.slice(
  adminExports.indexOf("lecturerReviewHeaders = ["),
  adminExports.indexOf("] as const;"),
);
for (const h of [
  "Minggu", "Tipe Soal", "Kode Soal", "Judul Soal", "Nama Reviewer",
  "Waktu Review", "Terakhir Diperbarui", "Status Review", "Aktivitas Terakhir",
  "Hasil Review", "Miskonsepsi yang Tercantum", "Miskonsepsi yang Dihapus",
  "Alasan Penghapusan Miskonsepsi", "Miskonsepsi yang Ditambahkan",
  "Alasan Penambahan Miskonsepsi", "Miskonsepsi Menurut Reviewer",
  "Catatan Tambahan",
]) {
  assert.ok(csvHeaders.includes(`"${h}"`), `CSV keeps column "${h}"`);
}

// --- Backend: question-only delete_question_review_workflow_v3 ----------
const workflowBody = (source) => {
  const createAt = source.search(
    /CREATE OR REPLACE FUNCTION\s+"?public"?\."?delete_question_review_workflow_v3"?/,
  );
  assert.ok(createAt >= 0, "workflow function definition present");
  const tail = source.slice(createAt);
  const openTag = tail.match(/AS (\$\w*\$)/)[1];
  const end = tail.indexOf(openTag, tail.indexOf(openTag) + openTag.length);
  return tail.slice(0, end);
};
for (const source of [migration, stagingBootstrap]) {
  const executable = workflowBody(source)
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  assert.doesNotMatch(
    executable,
    /recompute_answer_review_consensus_v3|update\s+public\.answer_reviews|(?:from|into|delete from)\s+public\.answer_misconception_overrides/,
    "the workflow delete never touches Answer Reviews or answer overrides",
  );
  assert.match(executable, /recompute_question_review_consensus_v3/);
  assert.match(executable, /update\s+public\.question_reviews/);
}
assert.match(migration, /grant execute on function public\.delete_question_review_workflow_v3\(p_question_id text, p_source_version uuid\) to authenticated, service_role/);
// The migration is a single CREATE OR REPLACE FUNCTION -- no schema/DDL churn.
const migrationStatements = migration
  .split("\n")
  .map((line) => line.replace(/--.*$/, "").trim())
  .join("\n");
assert.doesNotMatch(
  migrationStatements,
  /\b(drop|alter table|create table|create policy|create trigger)\b/i,
);

console.log("MP question-only review contract check passed.");
