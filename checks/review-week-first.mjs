import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  REVIEW_NAVIGATION_SESSION_KEY,
  buildReviewQueue,
  filterWeekReviewQuestions,
  getActiveCurrentQuestionReviewIds,
  getDefaultReviewWeek,
  getNavigationAfterReviewSave,
  getNavigationAfterWithdraw,
  getNextQueueItemId,
  getReviewWeekSummaries,
  getWeekReviewQuestionStatus,
  normalizeReviewNavigationState,
  parseReviewNavigationSearch,
  parseReviewNavigationSession,
  serializeReviewNavigationSearch,
  serializeReviewNavigationSession,
} from "../src/utils/reviewQueue.ts";
import { normalizeQuestionType } from "../src/utils/questionMetadata.ts";

const question = (id, type, week) => ({ id, type, week });

const w02Questions = [
  ...Array.from({ length: 19 }, (_, index) =>
    question(`W02-PS-${index + 1}`, "short_answer", "W02"),
  ),
  ...Array.from({ length: 40 }, (_, index) =>
    question(`W02-MP-${index + 1}`, "multiple_choice", "W02"),
  ),
];
const questions = [
  question("W01-PS-1", "short_answer", "W01"),
  ...w02Questions,
  question("W05-06-MP-1", "multiple_choice", "W05-06"),
  question("W11-12-PS-1", "short_answer", "W11-12"),
];

assert.equal(normalizeQuestionType("PS"), "short_answer");
assert.equal(normalizeQuestionType("MP"), "multiple_choice");

// ---------------------------------------------------------------------------
// Week progress: an active current-version Question Review = reviewed, for MP
// and PS alike. There is NO composite / A-B-C-D completion any more.
// ---------------------------------------------------------------------------
const weekSummaries = getReviewWeekSummaries(
  questions,
  ["W01-PS-1", "W02-PS-1"],
  new Map([
    ["W02-PS-2", 3],
    ["W05-06-MP-1", 3],
    ["W11-12-PS-1", 3],
  ]),
  3,
);
assert.deepEqual(
  weekSummaries.find(({ week }) => week === "W01"),
  { week: "W01", total: 1, completed: 1, isComplete: true },
);
assert.equal(
  weekSummaries.find(({ week }) => week === "W02")?.completed,
  2,
  "week progress counts personal reviews and questions whose reviewer cap is full",
);
assert.equal(
  weekSummaries.find(({ week }) => week === "W05-06")?.isComplete,
  true,
);
assert.deepEqual(
  getReviewWeekSummaries(
    [question("MP-ONE", "multiple_choice", "W02")],
    ["MP-ONE"],
    new Map(),
    3,
    ["MP-ONE"],
  )[0],
  { week: "W02", total: 1, completed: 1, isComplete: true },
  "an MP question is complete once its Question Review exists -- no answer step",
);
assert.deepEqual(
  getReviewWeekSummaries(
    [question("MP-STARTED", "multiple_choice", "W02")],
    [],
    new Map([["MP-STARTED", 3]]),
    3,
    ["MP-STARTED"],
  )[0],
  { week: "W02", total: 1, completed: 0, isComplete: false },
  "a started-but-not-personally-reviewed MP row is still unreviewed at cap",
);

// ---------------------------------------------------------------------------
// Personal status
// ---------------------------------------------------------------------------
const reviewedStatusIds = new Set(["reviewed-at-1", "reviewed-at-3"]);
const statusCounts = new Map([
  ["unreviewed-at-1", 1],
  ["reviewed-at-1", 1],
  ["reviewed-at-3", 3],
  ["full-at-3", 3],
]);
assert.equal(getWeekReviewQuestionStatus("unreviewed-at-0", reviewedStatusIds, statusCounts, 3), "unreviewed");
assert.equal(getWeekReviewQuestionStatus("reviewed-at-1", reviewedStatusIds, statusCounts, 3), "reviewed");
assert.equal(getWeekReviewQuestionStatus("reviewed-at-3", reviewedStatusIds, statusCounts, 3), "reviewed");
assert.equal(getWeekReviewQuestionStatus("full-at-3", reviewedStatusIds, statusCounts, 3), "full");
assert.equal(
  getWeekReviewQuestionStatus("full-at-3", reviewedStatusIds, statusCounts, 3, new Set(["full-at-3"])),
  "unreviewed",
  "a started question the lecturer has not yet saved stays in Belum direview",
);

// ---------------------------------------------------------------------------
// Week list filters
// ---------------------------------------------------------------------------
const searchableQuestions = questions.map((item, index) => ({
  ...item,
  number: String(index + 1),
  sourceCode: index === 1 ? "PS-CODE" : null,
  sourceKey: null,
  questionCode: null,
  displayCode: null,
  lmsQuestionId: null,
  title: { id: index === 2 ? "Perulangan bersarang" : item.id, en: item.id },
  expectedConcepts: [],
}));
const searchableQuestionCounts = new Map([
  ["W02-PS-1", 3],
  ["W02-PS-2", 3],
]);
assert.deepEqual(
  filterWeekReviewQuestions(searchableQuestions, {
    week: "W02",
    query: "PS-CODE",
    type: "ps",
    status: "reviewed",
    reviewedQuestionIds: ["W02-PS-1"],
    questionCounts: searchableQuestionCounts,
    reviewerThreshold: 3,
  }).map(({ id }) => id),
  ["W02-PS-1"],
);
assert.deepEqual(
  filterWeekReviewQuestions(searchableQuestions, {
    week: "W02",
    query: "",
    type: "ps",
    status: "full",
    reviewedQuestionIds: ["W02-PS-1"],
    questionCounts: searchableQuestionCounts,
    reviewerThreshold: 3,
  }).map(({ id }) => id),
  ["W02-PS-2"],
  "quota-full filter includes only capped questions not reviewed by the lecturer",
);
assert.deepEqual(
  filterWeekReviewQuestions(searchableQuestions, {
    week: "W02",
    query: "W02-MP-1",
    type: "mp",
    status: "reviewed",
    reviewedQuestionIds: ["W02-MP-1"],
    questionCounts: new Map(),
    reviewerThreshold: 3,
  }).map(({ id }) => id),
  ["W02-MP-1"],
  "a reviewed MP question shows under Sudah direview with no answer prerequisite",
);

// ---------------------------------------------------------------------------
// Navigation: session key bumped to v3, and any stale task=answer collapses to
// the one-page Question Review.
// ---------------------------------------------------------------------------
assert.equal(REVIEW_NAVIGATION_SESSION_KEY.endsWith(".v3"), true);
assert.equal(getDefaultReviewWeek(questions), "W02");

const normalized = normalizeReviewNavigationState(
  {
    week: "missing",
    task: "answer",
    status: "unreviewed",
    type: "ps",
    mode: "view",
    item: "MP-ANSWER-1",
    returnAnswer: "MP-ANSWER-2",
  },
  { questions, reviewedQuestionIds: [] },
);
assert.equal(normalized.task, "question", "task=answer normalizes to question");
assert.equal(normalized.returnAnswer, undefined, "returnAnswer is dropped");
assert.equal(normalized.week, "W02");
assert.equal(normalized.mode, "view");

const questionQueue = buildReviewQueue({
  questions,
  week: "W02",
  task: "question",
  status: "unreviewed",
  type: "all",
  reviewedQuestionIds: [],
});
assert.equal(questionQueue.length, 59);
assert.equal(
  buildReviewQueue({
    questions,
    week: "W02",
    task: "answer",
    status: "unreviewed",
    type: "all",
    reviewedQuestionIds: [],
  }).length,
  0,
  "there is no active answer queue",
);
assert.equal(
  buildReviewQueue({
    questions,
    week: "W02",
    task: "question",
    status: "unreviewed",
    type: "mp",
    reviewedQuestionIds: [],
  }).length,
  40,
);

const questionVersions = new Map([
  ["W02-PS-1", "question-v2"],
  ["W02-PS-2", "question-v1"],
]);
assert.deepEqual(
  getActiveCurrentQuestionReviewIds(
    [
      { questionId: "W02-PS-1", sourceVersion: "question-v2", isActive: true },
      { questionId: "W02-PS-2", sourceVersion: "question-v1", isActive: false },
      { questionId: "W02-PS-3", sourceVersion: "old", isActive: true },
    ],
    questionVersions,
  ),
  ["W02-PS-1"],
  "inactive, deleted, and source-updated question reviews are personally unreviewed",
);

assert.equal(getNextQueueItemId(questionQueue, "W02-PS-1"), "W02-PS-2");
assert.equal(getNextQueueItemId([{ id: "only" }], "only"), undefined);
const questionNavigation = {
  week: "W02",
  task: "question",
  status: "unreviewed",
  type: "all",
  mode: "review",
  item: "W02-PS-1",
};
assert.deepEqual(
  getNavigationAfterReviewSave(questionNavigation, questionQueue, "W02-PS-1", false),
  { ...questionNavigation, item: "W02-PS-2" },
);
assert.deepEqual(
  getNavigationAfterWithdraw({ ...questionNavigation, status: "reviewed" }, "W02-PS-1"),
  { ...questionNavigation, returnAnswer: undefined },
);

const search = serializeReviewNavigationSearch(questionNavigation);
assert.deepEqual(parseReviewNavigationSearch(search).state, questionNavigation);
assert.equal(parseReviewNavigationSearch("").hasParameters, false);
assert.deepEqual(
  parseReviewNavigationSession(serializeReviewNavigationSession(questionNavigation)),
  { version: 3, ...questionNavigation },
);
assert.deepEqual(
  parseReviewNavigationSession('{"version":2,"task":"answer","item":"x"}'),
  {},
  "a stale v2 session is rejected, not revived",
);
assert.deepEqual(parseReviewNavigationSession("{invalid"), {});

// ---------------------------------------------------------------------------
// Active page source: one-page MP submit, question-only delete, no answer UI.
// ---------------------------------------------------------------------------
const activePage = await readFile(
  new URL("../src/pages/LecturerReviewWeekFirstPage.tsx", import.meta.url),
  "utf8",
);
const app = await readFile(
  new URL("../src/app/App.tsx", import.meta.url),
  "utf8",
);
assert.match(app, /LecturerReviewWeekFirstPage/);
assert.match(activePage, /REVIEW_NAVIGATION_SESSION_KEY/);
assert.match(activePage, /saveQuestionReview\(/);
assert.match(
  activePage,
  /deleteQuestionReviewWorkflow\(question\.id, question\.sourceVersion\)/,
);
assert.match(activePage, /WeekOverview/);
assert.match(activePage, /WeekQuestionList/);
assert.match(activePage, /reviewStage === "overview"/);
assert.match(activePage, /reviewStage === "list"/);
// The retired Answer Review surface is gone from the active page.
assert.doesNotMatch(
  activePage,
  /AnswerValidationWorkspace|saveAnswerReview|deleteAnswerReview|getActionableAnswerReviewSequence|resolveAnswerDeepLink|getCompositeReviewedQuestionIds|navigation\.task === "answer"|QueuePanel|task: "answer"/,
  "the one-page review has no Answer Review workflow, queue, or navigation",
);
// MP no longer redirects into an answer sequence after save.
assert.doesNotMatch(
  activePage.slice(
    activePage.indexOf("handleQuestionSubmit"),
    activePage.indexOf("if (reviewSessionState"),
  ),
  /multiple_choice|resolveAnswerDeepLink|getNextUnreviewedAnswerId/,
  "MP question submit is one-step, identical to PS",
);
// Deleting a Question Review does NOT optimistically clear answer state.
assert.doesNotMatch(activePage, /setAnswerHistory|setConfirmedAnswerReviewIds|setAnswerCounts/);
assert.match(activePage, /setCompletionDialog\(true\)/);

const listSource = activePage.slice(
  activePage.indexOf("function WeekQuestionList"),
  activePage.indexOf("export function LecturerReviewPage"),
);
assert.match(listSource, /onOpenQuestion\(question, "review"\)/);
assert.match(listSource, /onOpenQuestion\(question, "view"\)/);
assert.match(listSource, /onOpenQuestion\(question, "edit"\)/);
assert.match(listSource, /<ConfirmDialog\b/);
assert.match(listSource, /"Hapus review\?"/);
// The delete-confirm body no longer mentions A/B/C/D answer-option reviews.
assert.doesNotMatch(listSource, /A\/B\/C\/D|pilihan jawaban \(A|answer-option review/);
assert.match(
  listSource,
  /Review soal yang Anda buat untuk soal ini akan dihapus dari review aktif\. Riwayat review tetap tersimpan\./,
);

console.log("Week-first review queue self-check passed.");
