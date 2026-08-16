import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  REVIEW_NAVIGATION_SESSION_KEY,
  buildReviewQueue,
  filterWeekReviewQuestions,
  getActiveCurrentAnswerReviewIds,
  getActiveCurrentQuestionReviewIds,
  getDefaultReviewWeek,
  getNavigationAfterReviewSave,
  getNavigationAfterWithdraw,
  getNextQueueItemId,
  getReviewWeekSummaries,
  normalizeReviewNavigationState,
  parseReviewNavigationSearch,
  parseReviewNavigationSession,
  resolveAnswerDeepLink,
  serializeReviewNavigationSearch,
  serializeReviewNavigationSession,
} from "../src/utils/reviewQueue.ts";

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
const answers = [
  { id: "PS-EVIDENCE", questionId: "W02-PS-1" },
  { id: "MP-ANSWER-1", questionId: "W02-MP-1" },
  { id: "MP-ANSWER-2", questionId: "W02-MP-2" },
  { id: "MP-ANSWER-1", questionId: "W02-MP-1" },
];

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

const searchableQuestions = questions.map((item, index) => ({
  ...item,
  number: String(index + 1),
  sourceCode: index === 1 ? "PS-CODE" : null,
  sourceKey: null,
  questionCode: null,
  title: { id: index === 2 ? "Perulangan bersarang" : item.id, en: item.id },
  expectedConcepts:
    index === 3 ? [{ id: "Kompleksitas waktu", en: "Time complexity" }] : [],
}));
assert.deepEqual(
  filterWeekReviewQuestions(searchableQuestions, {
    week: "W02",
    query: "PS-CODE",
    type: "ps",
    status: "reviewed",
    reviewedQuestionIds: ["W02-PS-1"],
  }).map(({ id }) => id),
  ["W02-PS-1"],
);
assert.deepEqual(
  filterWeekReviewQuestions(searchableQuestions, {
    week: "W02",
    query: "kompleksitas waktu",
    type: "all",
    status: "all",
    reviewedQuestionIds: [],
  }).map(({ id }) => id),
  ["W02-PS-3"],
);

assert.equal(REVIEW_NAVIGATION_SESSION_KEY.endsWith(".v2"), true);
assert.equal(getDefaultReviewWeek(questions), "W02");
assert.equal(
  getDefaultReviewWeek([
    question("LITERAL-2", "short_answer", "W11-12"),
    question("LITERAL-1", "short_answer", "W05-06"),
  ]),
  "W05-06",
);

const queue = (overrides = {}) =>
  buildReviewQueue({
    questions,
    answers,
    week: "W02",
    task: "question",
    status: "unreviewed",
    type: "all",
    reviewedQuestionIds: [],
    reviewedAnswerIds: [],
    ...overrides,
  });

assert.equal(queue().length, 59);
assert.equal(queue({ type: "ps" }).length, 19);
assert.equal(queue({ type: "mp" }).length, 40);
assert.equal(new Set(queue().map(({ id }) => id)).size, 59);
assert.deepEqual(
  queue({ task: "answer" }).map(({ id }) => id),
  ["MP-ANSWER-1", "MP-ANSWER-2"],
  "answer queue contains only unique MP answers from parents in the selected week",
);
assert.equal(queue({ task: "answer" }).some(({ id }) => id === "PS-EVIDENCE"), false);
assert.deepEqual(
  queue({ week: "W05-06" }).map(({ id }) => id),
  ["W05-06-MP-1"],
);
assert.deepEqual(
  queue({ week: "W11-12" }).map(({ id }) => id),
  ["W11-12-PS-1"],
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
const answerVersions = new Map([
  ["MP-ANSWER-1", { questionId: "W02-MP-1", sourceVersion: "answer-v2" }],
  ["MP-ANSWER-2", { questionId: "W02-MP-2", sourceVersion: "answer-v1" }],
]);
assert.deepEqual(
  getActiveCurrentAnswerReviewIds(
    [
      {
        answerId: "MP-ANSWER-1",
        questionId: "W02-MP-1",
        sourceVersion: "answer-v2",
        isActive: true,
      },
      {
        answerId: "MP-ANSWER-2",
        questionId: "W02-MP-2",
        sourceVersion: "old",
        isActive: true,
      },
    ],
    answerVersions,
  ),
  ["MP-ANSWER-1"],
);

const normalized = normalizeReviewNavigationState(
  {
    week: "missing",
    task: "answer",
    status: "unreviewed",
    type: "ps",
    item: "PS-EVIDENCE",
  },
  {
    questions,
    answers,
    reviewedQuestionIds: [],
    reviewedAnswerIds: [],
  },
);
assert.deepEqual(normalized, {
  week: "W02",
  task: "answer",
  status: "unreviewed",
  type: "all",
  item: "MP-ANSWER-1",
});
assert.equal(getNextQueueItemId(queue(), "W02-PS-1"), "W02-PS-2");
assert.equal(getNextQueueItemId([{ id: "only" }], "only"), undefined);
const questionNavigation = {
  week: "W02",
  task: "question",
  status: "unreviewed",
  type: "all",
  item: "W02-PS-1",
};
assert.deepEqual(
  getNavigationAfterReviewSave(
    questionNavigation,
    queue(),
    "W02-PS-1",
    false,
  ),
  { ...questionNavigation, item: "W02-PS-2" },
  "first save advances without changing week, task, status, or type",
);
assert.deepEqual(
  getNavigationAfterReviewSave(
    { ...questionNavigation, status: "reviewed" },
    queue({ status: "reviewed", reviewedQuestionIds: ["W02-PS-1"] }),
    "W02-PS-1",
    true,
  ),
  { ...questionNavigation, status: "reviewed", item: "W02-PS-1" },
  "editing keeps the selected item",
);
assert.deepEqual(
  getNavigationAfterWithdraw(
    { ...questionNavigation, status: "reviewed" },
    "W02-PS-1",
  ),
  questionNavigation,
  "withdraw returns the item to personal unreviewed semantics",
);

const deepLink = resolveAnswerDeepLink(
  "MP-ANSWER-2",
  questions,
  answers,
  ["MP-ANSWER-2"],
);
assert.deepEqual(deepLink, {
  week: "W02",
  task: "answer",
  status: "reviewed",
  type: "all",
  item: "MP-ANSWER-2",
});
assert.equal(resolveAnswerDeepLink("PS-EVIDENCE", questions, answers, []), undefined);

const search = serializeReviewNavigationSearch(deepLink);
assert.deepEqual(parseReviewNavigationSearch(search), {
  hasParameters: true,
  state: deepLink,
});
assert.equal(parseReviewNavigationSearch("").hasParameters, false);
assert.deepEqual(
  parseReviewNavigationSession(serializeReviewNavigationSession(deepLink)),
  { version: 2, ...deepLink },
);
assert.deepEqual(parseReviewNavigationSession('{"workspace":"question-ps"}'), {});
assert.deepEqual(parseReviewNavigationSession("{invalid"), {});

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
assert.match(activePage, /serializeReviewNavigationSearch\(navigation\)/);
assert.match(activePage, /replace: true/);
assert.match(activePage, /getNavigationAfterReviewSave/);
assert.match(activePage, /getNavigationAfterWithdraw/);
assert.match(activePage, /resolveAnswerDeepLink/);
assert.match(activePage, /ReviewBreadcrumb/);
assert.match(activePage, /WeekOverview/);
assert.match(activePage, /WeekQuestionList/);
assert.match(activePage, /filterWeekReviewQuestions/);
assert.match(activePage, /reviewStage === "overview"/);
assert.match(activePage, /reviewStage === "list"/);
assert.match(activePage, /Status pribadi/);
assert.match(activePage, /Judul, kode, atau KC/);
assert.match(activePage, /saveQuestionReview\(/);
assert.match(activePage, /saveAnswerReview\(/);
assert.match(activePage, /deleteQuestionReview\(/);
assert.match(activePage, /deleteAnswerReview\(/);
assert.doesNotMatch(activePage, /question-ps|answer-ps|question-mp|answer-mp/);
assert.doesNotMatch(
  activePage,
  /\.from\(["'](?:question_reviews|answer_reviews)["']\)/,
  "active page must not write to review tables directly",
);

console.log("Week-first review queue self-check passed.");
