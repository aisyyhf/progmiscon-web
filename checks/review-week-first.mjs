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
  getWeekReviewQuestionStatus,
  normalizeReviewNavigationState,
  parseReviewNavigationSearch,
  parseReviewNavigationSession,
  resolveAnswerDeepLink,
  serializeReviewNavigationSearch,
  serializeReviewNavigationSession,
} from "../src/utils/reviewQueue.ts";
import { normalizeQuestionType } from "../src/utils/questionMetadata.ts";

const question = (id, type, week) => ({ id, type, week });
const contrastRatio = (foreground, background) => {
  const luminance = (hex) => {
    const channels = hex.match(/[\da-f]{2}/gi).map((channel) => parseInt(channel, 16) / 255);
    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  };
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};
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
  { id: "PS-EVIDENCE", questionId: "W02-PS-1", answerRole: "evidence" },
  { id: "MP-ANSWER-1", questionId: "W02-MP-1", answerRole: "mp_option" },
  { id: "MP-ANSWER-2", questionId: "W02-MP-2", answerRole: "mp_option" },
  { id: "MP-ANSWER-1", questionId: "W02-MP-1", answerRole: "mp_option" },
];

assert.equal(normalizeQuestionType("PS"), "short_answer");
assert.equal(normalizeQuestionType("MP"), "multiple_choice");

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
    [question("PARTIAL-MP", "multiple_choice", "W02")],
    [],
    new Map([["PARTIAL-MP", 3]]),
    3,
    ["PARTIAL-MP"],
  )[0],
  { week: "W02", total: 1, completed: 0, isComplete: false },
  "a partial MP workflow remains incomplete even when the question cap is full",
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
const searchableQuestionCounts = new Map([
  ["W02-PS-1", 3],
  ["W02-PS-2", 3],
  ["W02-MP-40", 3],
]);
const reviewedStatusIds = new Set(["reviewed-at-1", "reviewed-at-3"]);
const statusCounts = new Map([
  ["unreviewed-at-1", 1],
  ["unreviewed-at-2", 2],
  ["reviewed-at-1", 1],
  ["reviewed-at-3", 3],
  ["full-at-3", 3],
]);
assert.equal(getWeekReviewQuestionStatus("unreviewed-at-0", reviewedStatusIds, statusCounts, 3), "unreviewed");
assert.equal(getWeekReviewQuestionStatus("unreviewed-at-1", reviewedStatusIds, statusCounts, 3), "unreviewed");
assert.equal(getWeekReviewQuestionStatus("unreviewed-at-2", reviewedStatusIds, statusCounts, 3), "unreviewed");
assert.equal(getWeekReviewQuestionStatus("reviewed-at-1", reviewedStatusIds, statusCounts, 3), "reviewed");
assert.equal(getWeekReviewQuestionStatus("reviewed-at-3", reviewedStatusIds, statusCounts, 3), "reviewed");
assert.equal(getWeekReviewQuestionStatus("full-at-3", reviewedStatusIds, statusCounts, 3), "full");
const primaryStatus = ({ completed = false, started = false, count }) =>
  getWeekReviewQuestionStatus(
    "target",
    new Set(completed ? ["target"] : []),
    new Map([["target", count]]),
    3,
    new Set(started ? ["target"] : []),
  );
assert.deepEqual(
  {
    noParticipationAt0: primaryStatus({ count: 0 }),
    noParticipationAt2: primaryStatus({ count: 2 }),
    noParticipationAt3: primaryStatus({ count: 3 }),
    completedPsAt3: primaryStatus({ completed: true, count: 3 }),
    completedMpAt3: primaryStatus({ completed: true, started: true, count: 3 }),
    partialMpAt3: primaryStatus({ started: true, count: 3 }),
    withdrawnAt3: primaryStatus({ count: 3 }),
    withdrawnAt2: primaryStatus({ count: 2 }),
  },
  {
    noParticipationAt0: "unreviewed",
    noParticipationAt2: "unreviewed",
    noParticipationAt3: "full",
    completedPsAt3: "reviewed",
    completedMpAt3: "reviewed",
    partialMpAt3: "unreviewed",
    withdrawnAt3: "full",
    withdrawnAt2: "unreviewed",
  },
  "primary status keeps completion, ownership, and the reviewer cap distinct",
);
assert.equal(
  getWeekReviewQuestionStatus(
    "full-at-3",
    reviewedStatusIds,
    statusCounts,
    3,
    new Set(["full-at-3"]),
  ),
  "unreviewed",
  "a cap-full MP question step remains unreviewed while its composite task is partial",
);
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
    query: "kompleksitas waktu",
    type: "all",
    status: "unreviewed",
    reviewedQuestionIds: [],
    questionCounts: searchableQuestionCounts,
    reviewerThreshold: 3,
  }).map(({ id }) => id),
  ["W02-PS-3"],
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
    query: "W02-PS-2",
    type: "all",
    status: "unreviewed",
    reviewedQuestionIds: [],
    questionCounts: searchableQuestionCounts,
    reviewerThreshold: 3,
  }),
  [],
  "quota-full questions are excluded from ordinary personal unreviewed status",
);
assert.deepEqual(
  filterWeekReviewQuestions(searchableQuestions, {
    week: "W02",
    query: "W02-MP-40",
    type: "mp",
    status: "unreviewed",
    reviewedQuestionIds: [],
    startedQuestionIds: ["W02-MP-40"],
    questionCounts: searchableQuestionCounts,
    reviewerThreshold: 3,
  }).map(({ id }) => id),
  ["W02-MP-40"],
  "a started but composite-incomplete row stays in Belum direview even at question cap",
);
for (const status of ["reviewed", "full"]) {
  assert.deepEqual(
    filterWeekReviewQuestions(searchableQuestions, {
      week: "W02",
      query: "W02-MP-40",
      type: "mp",
      status,
      reviewedQuestionIds: [],
      startedQuestionIds: ["W02-MP-40"],
      questionCounts: searchableQuestionCounts,
      reviewerThreshold: 3,
    }),
    [],
    `a partial MP task must not also appear under ${status}`,
  );
}

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
const activeCurrentQuestionReviewIds = getActiveCurrentQuestionReviewIds(
    [
      { questionId: "W02-PS-1", sourceVersion: "question-v2", isActive: true },
      { questionId: "W02-PS-2", sourceVersion: "question-v1", isActive: false },
      { questionId: "W02-PS-3", sourceVersion: "old", isActive: true },
    ],
    questionVersions,
  );
assert.deepEqual(
  activeCurrentQuestionReviewIds,
  ["W02-PS-1"],
  "inactive, deleted, and source-updated question reviews are personally unreviewed",
);
assert.equal(
  getWeekReviewQuestionStatus(
    "W02-PS-2",
    new Set(activeCurrentQuestionReviewIds),
    new Map(),
    3,
  ),
  "unreviewed",
  "deleted personal reviews do not satisfy personal completion",
);
assert.equal(
  getWeekReviewQuestionStatus(
    "W02-PS-3",
    new Set(activeCurrentQuestionReviewIds),
    new Map(),
    3,
  ),
  "unreviewed",
  "stale/source-updated personal reviews do not satisfy personal completion",
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
    mode: "view",
    item: "PS-EVIDENCE",
    returnAnswer: "MP-ANSWER-2",
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
  type: "ps",
  mode: "view",
  item: "MP-ANSWER-1",
  returnAnswer: "MP-ANSWER-2",
});
assert.equal(getNextQueueItemId(queue(), "W02-PS-1"), "W02-PS-2");
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
  { ...questionNavigation, returnAnswer: undefined },
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
  mode: "review",
  item: "MP-ANSWER-2",
});
assert.equal(resolveAnswerDeepLink("PS-EVIDENCE", questions, answers, []), undefined);

const staleMpQuestionNavigation = {
  week: "W02",
  task: "question",
  status: "unreviewed",
  type: "all",
  mode: "review",
  item: "W02-MP-1",
};
const staleNormalizedAfterSave = normalizeReviewNavigationState(
  staleMpQuestionNavigation,
  {
    questions,
    answers,
    reviewedQuestionIds: ["W02-MP-1"],
    reviewedAnswerIds: [],
  },
);
assert.equal(staleNormalizedAfterSave.task, "question");
assert.notEqual(
  staleNormalizedAfterSave.item,
  "W02-MP-1",
  "a stale unreviewed-question URL falls through to the next question after save",
);
const mpContinuation = resolveAnswerDeepLink(
  "MP-ANSWER-1",
  questions,
  answers,
  [],
);
assert.ok(mpContinuation);
const normalizedMpContinuation = normalizeReviewNavigationState(
  mpContinuation,
  {
    questions,
    answers,
    reviewedQuestionIds: ["W02-MP-1"],
    reviewedAnswerIds: [],
  },
);
assert.equal(normalizedMpContinuation.task, "answer");
assert.equal(normalizedMpContinuation.item, "MP-ANSWER-1");
assert.equal(
  answers.find(({ id }) => id === normalizedMpContinuation.item)?.questionId,
  "W02-MP-1",
  "the explicit MP continuation stays on an answer owned by the saved question",
);

const search = serializeReviewNavigationSearch(deepLink);
assert.deepEqual(parseReviewNavigationSearch(search), {
  hasParameters: true,
  state: deepLink,
});
const reviewedMpListContext = {
  week: "W02",
  task: "question",
  status: "reviewed",
  type: "mp",
  mode: "edit",
  returnAnswer: "MP-ANSWER-1",
};
assert.deepEqual(
  parseReviewNavigationSearch(
    serializeReviewNavigationSearch(reviewedMpListContext),
  ).state,
  reviewedMpListContext,
  "the canonical URL preserves reviewed status and MP type for list return/history",
);
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
const questionMetadataSource = await readFile(
  new URL("../src/utils/questionMetadata.ts", import.meta.url),
  "utf8",
);
const questionTypeSource = await readFile(
  new URL("../src/types/question.ts", import.meta.url),
  "utf8",
);
const stylesSource = await readFile(
  new URL("../src/styles/index.css", import.meta.url),
  "utf8",
);
const validationWorkspace = await readFile(
  new URL("../src/pages/LecturerReviewPage.tsx", import.meta.url),
  "utf8",
);
const listSource = activePage.slice(
  activePage.indexOf("function WeekQuestionList"),
  activePage.indexOf("function QueuePanel"),
);
const typeFilterSource = listSource.slice(
  listSource.indexOf('className="group/type relative shrink-0"'),
  listSource.indexOf('<label className="group/search'),
);
const overviewAndListSource = activePage.slice(
  activePage.indexOf("function WeekOverview"),
  activePage.indexOf("function QueuePanel"),
);
const overviewAndListStageSource = activePage.slice(
  activePage.indexOf('if (reviewStage === "overview")'),
  activePage.indexOf("const detailQuestion"),
);
const targetPageColorSource = `${overviewAndListSource}\n${overviewAndListStageSource}`;
const reviewPaletteSource = stylesSource.slice(
  stylesSource.indexOf(".review-week-pages"),
  stylesSource.indexOf(".lecturer-sidebar-surface"),
);
const app = await readFile(
  new URL("../src/app/App.tsx", import.meta.url),
  "utf8",
);
assert.match(app, /LecturerReviewWeekFirstPage/);
assert.match(activePage, /REVIEW_NAVIGATION_SESSION_KEY/);
assert.doesNotMatch(
  activePage,
  /reviewedQuestionIds: reviewedQuestionStepIds/,
  "Primary Review queues must use composite completion IDs",
);
assert.match(
  activePage,
  /reviewedQuestionIds=\{reviewedQuestionIds\}[\s\S]{0,120}startedQuestionIds=\{reviewedQuestionStepIds\}/,
  "The Week list keeps completed and started question IDs separate",
);
assert.match(
  activePage,
  /const activeQuestionReviewedByMe = activeQuestion[\s\S]{0,100}reviewedQuestionStepIds\.includes\(activeQuestion\.id\)/,
  "Cap bypass remains based on personal question ownership",
);
assert.match(activePage, /serializeReviewNavigationSearch\(navigation\)/);
assert.match(activePage, /replace: true/);
assert.match(activePage, /options: \{ replace\?: boolean \}/);
assert.match(activePage, /replace: options\.replace \?\? true/);
assert.match(
  activePage,
  /const openQuestion[\s\S]*?task: "question"[\s\S]*?mode,[\s\S]*?returnAnswer: undefined,[\s\S]*?\{ replace: false \},/,
  "opening a question from its week list must preserve the list in browser history",
);
assert.doesNotMatch(
  activePage.slice(activePage.indexOf("const openQuestion"), activePage.indexOf("const withdrawQuestionReview")),
  /resolveAnswerDeepLink|getNextUnreviewedAnswerId/,
  "partial MP rows must reopen on the question instead of jumping to an answer",
);
assert.match(listSource, /onOpenQuestion\(question, "review"\)/);
assert.match(listSource, /onOpenQuestion\(question, "view"\)/);
assert.match(listSource, /onOpenQuestion\(question, "edit"\)/);
assert.match(activePage, /mode=\{navigation\.mode\}/);
assert.match(
  activePage,
  /navigateToQuestionStep\(answerQuestion, returnAnswerForPreviousStep\)/,
);
assert.match(
  activePage,
  /returnAnswerForPreviousStep\s*=\s*navigation\.mode === "review"[\s\S]*?navigation\.returnAnswer \?\? activeAnswer\?\.id/,
);
assert.match(activePage, /getReachableAnswerReviewSequence/);
assert.match(activePage, /navigation\.mode !== "review" \|\|[\s\S]*?reachableAnswerStepIds\.has\(nextAnswer\.id\)/);
assert.match(activePage, /answerStepSequence\.findIndex\(\(\{ id \}\) => id === activeAnswer\?\.id\)/);
assert.match(activePage, /previousAnswer\s*=\s*answerSequenceIndex > 0[\s\S]*?displayedAnswerSequence\[answerSequenceIndex - 1\]/);
assert.match(activePage, /nextAnswer\s*=\s*displayedAnswerSequence\[answerSequenceIndex \+ 1\]/);
assert.match(activePage, /siblingAnswerIds=\{displayedAnswerSequence\.map/);
assert.match(activePage, /activeIndex=\{answerSequenceIndex\}/);
assert.match(activePage, /getNextUnreviewedAnswerId\(questionAnswerReviewSequence, reviewedAnswerIds\)/);
assert.match(activePage, /function getAnswerStepLabel[\s\S]*?option\?\.label/);
assert.doesNotMatch(activePage, /getNavigationAfterReviewSave/);
assert.match(activePage, /getActionableAnswerReviewSequence/);
assert.match(activePage, /getNextUnreviewedAnswerId/);
assert.match(activePage, /getNavigationAfterWithdraw/);
assert.match(activePage, /resolveAnswerDeepLink/);
assert.match(activePage, /ReviewBreadcrumb/);
assert.match(activePage, /WeekOverview/);
assert.match(activePage, /WeekQuestionList/);
for (const heading of [
  "Soal yang belum direview",
  "Soal yang sudah direview",
  "Soal dengan jumlah reviewer terpenuhi",
  "Questions not yet reviewed",
  "Reviewed questions",
  "Questions with reviewer limit reached",
]) {
  assert.match(listSource, new RegExp(heading));
}
assert.match(listSource, /<span>{questionColumnHeading}<\/span>/);
assert.deepEqual(
  [...new Set(targetPageColorSource.match(/#[\da-f]{6}/gi)?.map((color) => color.toLowerCase()))].sort(),
  ["#b09f85", "#ccbab0", "#fbfbfe"],
);
assert.doesNotMatch(
  targetPageColorSource,
  /bg-correct|text-correct|border-correct|bg-incorrect|text-incorrect|border-incorrect|outline-incorrect|bg-brand-soft|rgba\(95,71,59/,
);
assert.match(reviewPaletteSource, /--review-card: color-mix\(in srgb, var\(--progmiscon-secondary\) 7%/);
assert.match(reviewPaletteSource, /--review-header: color-mix\(in srgb, var\(--progmiscon-secondary\) 23%/);
assert.match(reviewPaletteSource, /--review-row-hover: color-mix\(in srgb, var\(--progmiscon-accent\) 12%/);
assert.match(reviewPaletteSource, /--review-type-essay-bg: #ffecec;/);
assert.match(reviewPaletteSource, /--review-type-essay-text: var\(--progmiscon-text\);/);
assert.match(reviewPaletteSource, /--review-type-choice-bg: #f2c2c2;/);
assert.match(reviewPaletteSource, /--review-type-choice-text: var\(--progmiscon-text\);/);
assert.match(
  reviewPaletteSource,
  /--review-filter-option-selected: color-mix\(in srgb, var\(--progmiscon-text\) 7%, var\(--review-page\)\);/,
);
assert.match(
  reviewPaletteSource,
  /--review-filter-option-hover: color-mix\(in srgb, var\(--progmiscon-text\) 4%, var\(--review-page\)\);/,
);
assert.deepEqual(
  [...new Set(reviewPaletteSource.match(/#[\da-f]{6}/gi)?.map((color) => color.toLowerCase()))].sort(),
  ["#f2c2c2", "#ffecec"],
);
assert.ok(contrastRatio("#000000", "#ffecec") >= 4.5);
assert.ok(contrastRatio("#000000", "#f2c2c2") >= 4.5);
assert.match(overviewAndListSource, /border border-brand\/35 bg-\[var\(--review-page\)\] text-brand/);
assert.match(listSource, /border-brand bg-brand text-white/);
assert.match(
  listSource,
  /border-\[#ccbab0\] bg-\[var\(--review-page\)\] text-black hover:border-\[#b09f85\] hover:bg-\[var\(--review-secondary-soft\)\]/,
);
assert.match(listSource, /bg-\[var\(--review-header\)\][^\n]+text-black/);
assert.match(listSource, /border border-border bg-white shadow/);
assert.match(listSource, /border-\[var\(--review-type-essay-border\)\] bg-\[var\(--review-type-essay-bg\)\] text-\[var\(--review-type-essay-text\)\]/);
assert.match(listSource, /border-\[var\(--review-type-choice-border\)\] bg-\[var\(--review-type-choice-bg\)\] text-\[var\(--review-type-choice-text\)\]/);
assert.match(listSource, /hover:bg-\[var\(--review-type-essay-hover\)\] hover:border-\[var\(--review-type-essay-hover-border\)\]/);
assert.match(listSource, /hover:bg-\[var\(--review-type-choice-hover\)\] hover:border-\[var\(--review-type-choice-hover-border\)\]/);
assert.match(
  overviewAndListSource,
  /duration-150 ease-out hover:-translate-y-px[\s\S]*?active:translate-y-0 active:shadow-none motion-reduce:translate-none/,
);
assert.match(
  listSource,
  /transition-\[background-color,border-color,color,transform\] duration-150 ease-out[\s\S]*?active:scale-\[0\.99\] motion-reduce:scale-none/,
);
assert.match(listSource, /review-type-popover/);
assert.match(
  typeFilterSource,
  /bg-\[var\(--review-page\)\][\s\S]*?text-black[\s\S]*?hover:border-\[#b09f85\][\s\S]*?focus-visible:border-brand\/55[\s\S]*?group-open\/type:border-brand\/55/,
);
assert.match(
  typeFilterSource,
  /bg-\[var\(--review-filter-option-selected\)\] text-black active:bg-\[var\(--review-filter-option-selected\)\]/,
);
assert.match(
  typeFilterSource,
  /bg-white text-black hover:bg-\[var\(--review-filter-option-hover\)\] active:bg-\[var\(--review-filter-option-hover\)\]/,
);
assert.doesNotMatch(typeFilterSource, /text-brand|review-type-(?:essay|choice)/);
assert.match(listSource, /group-hover\/search:text-brand group-focus-within\/search:text-brand/);
assert.match(listSource, /group-hover\/row:translate-x-0\.5 group-hover\/row:text-brand motion-reduce:translate-none/);
assert.match(overviewAndListSource, /function ReviewActionTooltip/);
assert.match(overviewAndListSource, /group-hover\/action:visible[\s\S]*?group-focus-visible\/action:visible/);
assert.match(listSource, /active:scale-\[0\.98\] motion-reduce:scale-none/);
assert.match(
  reviewPaletteSource,
  /@media \(prefers-reduced-motion: no-preference\)[\s\S]*?review-stage-enter 160ms ease-out both[\s\S]*?review-type-popover-enter 160ms ease-out both/,
);
assert.doesNotMatch(overviewAndListSource, /duration-(?:300|500)/);
assert.match(listSource, /<span className="text-center">No<\/span>/);
assert.match(listSource, /hidden text-center text-xs font-normal tabular-nums/);
assert.equal(
  overviewAndListStageSource.match(/lecturer-ui review-week-pages/g)?.length,
  2,
);
assert.match(activePage, /filterWeekReviewQuestions/);
assert.match(activePage, /reviewStage === "overview"/);
assert.match(activePage, /reviewStage === "list"/);
assert.doesNotMatch(listSource, /Status pribadi|Personal status/);
assert.match(activePage, /REVIEW SOAL PER MINGGU/);
assert.match(activePage, /formatWeekLabel\(week\)\.toLocaleUpperCase/);
assert.match(activePage, /aria-pressed=\{status === value\}/);
assert.match(listSource, /Jumlah reviewer terpenuhi/);
assert.match(listSource, /Reviewer limit reached/);
assert.doesNotMatch(
  listSource,
  /Kuota penuh|Quota full|Reviewer penuh|Reviewers full/,
);
assert.match(activePage, /getWeekReviewQuestionStatus/);
assert.doesNotMatch(listSource, /useState<ReviewWeekListStatus>/);
assert.doesNotMatch(listSource, /useState<ReviewQuestionType>/);
assert.match(listSource, /onStatusChange\(value\)/);
assert.match(listSource, /onTypeChange\(option\.value\)/);
assert.doesNotMatch(listSource, /\["all", language === "id" \? "Semua"/);
assert.match(activePage, /rounded-full/);
assert.match(activePage, /Tipe soal/);
assert.match(listSource, /label: language === "id" \? "Esai" : "Essay"/);
assert.match(
  listSource,
  /label: language === "id" \? "Pilihan Ganda" : "Multiple Choice"/,
);
assert.match(
  listSource,
  /language === "id" \? "Semua tipe soal" : "All question types"/,
);
assert.match(listSource, /role="menuitemradio"/);
assert.doesNotMatch(listSource, /selectedType\.code|option\.code|questionType\.code/);
assert.doesNotMatch(
  listSource,
  /text-\[8px\]/,
  "selected value, dropdown options, and table rows do not render PS/MP badges",
);
assert.doesNotMatch(listSource, /aria-describedby="review-question-type-help"/);
assert.match(listSource, /selectedType\.explanation &&/);
assert.match(listSource, /<Info size=\{13\}/);
assert.match(listSource, /aria-describedby="review-question-type-selected-help"/);
assert.match(listSource, /event\.preventDefault\(\);\s*event\.stopPropagation\(\);/);
assert.match(activePage, /function QuestionTypeTooltipLabel/);
assert.match(activePage, /role="tooltip"/);
assert.match(listSource, /<QuestionTypeTooltipLabel/);
assert.match(listSource, /focusable=\{questionStatus !== "unreviewed"\}/);
assert.match(listSource, /Esai adalah tipe PS/);
assert.match(listSource, /Essay is type PS/);
assert.match(listSource, /Pilihan Ganda adalah tipe MP/);
assert.match(listSource, /Multiple Choice is type MP/);
assert.doesNotMatch(listSource, /—/);
assert.doesNotMatch(
  listSource,
  /Short Answer|Problem Solving|Pseudocode|Misconception Probe|Misconception Prohibition/,
);
assert.match(questionMetadataSource, /\["ps", "short_answer"\]/);
assert.match(questionMetadataSource, /\["mp", "multiple_choice"\]/);
assert.match(
  questionTypeSource,
  /QuestionType = "short_answer" \| "multiple_choice"/,
);
assert.match(activePage, /placeholder="Search"/);
assert.doesNotMatch(listSource, /weekTotal/);
assert.doesNotMatch(listSource, /dari \$\{filteredQuestions\.length\} soal/);
assert.doesNotMatch(listSource, /of \$\{filteredQuestions\.length\} questions/);
assert.doesNotMatch(activePage, /<ReviewBreadcrumb language=\{language\} \/>/);
assert.doesNotMatch(activePage, /Pilih minggu untuk melihat soal/);
assert.doesNotMatch(activePage, /Semua minggu/);
assert.doesNotMatch(activePage, /Judul, kode, atau KC/);
assert.match(activePage, /saveQuestionReview\(/);
assert.match(activePage, /saveAnswerReview\(/);
assert.match(activePage, /deleteQuestionReview\(/);
assert.match(activePage, /deleteAnswerReview\(/);
assert.match(listSource, /questionStatus === "unreviewed"/);
assert.match(listSource, /questionStatus === "reviewed"/);
assert.match(listSource, /onOpenQuestion\(question, "review"\)/);
assert.match(listSource, /onOpenQuestion\(question, "view"\)/);
assert.match(listSource, /onOpenQuestion\(question, "edit"\)/);
assert.match(listSource, /<Eye/);
assert.match(listSource, /<Pencil/);
assert.match(listSource, /<Trash2/);
assert.match(
  listSource,
  /\{questionStatus === "reviewed" && \([\s\S]*?<Pencil[\s\S]*?<Trash2[\s\S]*?\)\}/,
  "edit and delete controls are restricted to personally reviewed questions",
);
assert.match(listSource, /Hapus review/);
assert.match(
  listSource,
  /text-\[13px\] font-semibold text-black[\s\S]*tableGridClass/,
);
assert.match(listSource, /truncate text-xs font-normal leading-4 text-black/);
assert.match(listSource, /text-xs font-normal tabular-nums text-black\/60/);
assert.match(listSource, /<span className="text-center">/);
assert.match(listSource, /flex items-center justify-center gap-1/);
assert.equal(
  listSource.match(/tableGridClass/g)?.length,
  4,
  "the header and every row variant share the same desktop column grid",
);
assert.match(activePage, /withdrawQuestionReview/);
assert.match(activePage, /deleteQuestionReview\(question\.id, question\.sourceVersion\)/);
assert.match(activePage, /mode=\{navigation\.mode\}/);
assert.doesNotMatch(activePage, /reviewReadOnly|readOnly=/);
assert.match(validationWorkspace, /formUnavailable = mode === "view" \|\| locked \|\| progressUnavailable/);
assert.doesNotMatch(validationWorkspace, /Mode lihat\. Review Anda ditampilkan hanya-baca\./);
assert.doesNotMatch(validationWorkspace, /onReviewAnswer/);
assert.match(validationWorkspace, /EDIT REVIEW SOAL/);
assert.match(validationWorkspace, /HASIL REVIEW SOAL/);
assert.match(validationWorkspace, /EDIT REVIEW JAWABAN/);
assert.match(validationWorkspace, /HASIL REVIEW JAWABAN/);
assert.match(activePage, /getCompositeReviewedQuestionIds/);
assert.match(activePage, /reviewedQuestionStepIds/);
assert.match(
  activePage,
  /reviewStage === "detail" && navigation\.mode !== "review"[\s\S]{0,100}\? navigation\.status[\s\S]{0,50}: "unreviewed"/,
  "breadcrumb list return keeps active Review sessions in Belum direview",
);
assert.match(activePage, /navigateToWeekList\(navigation\.week, "unreviewed", navigation\.type, true\)/);
assert.match(activePage, /\.\.\.target,[\s\S]{0,100}type: navigation\.type,[\s\S]{0,100}mode: "review"/);
assert.doesNotMatch(activePage, /question-ps|answer-ps|question-mp|answer-mp/);
assert.doesNotMatch(
  activePage,
  /\.from\(["'](?:question_reviews|answer_reviews)["']\)/,
  "active page must not write to review tables directly",
);

console.log("Week-first review queue self-check passed.");
