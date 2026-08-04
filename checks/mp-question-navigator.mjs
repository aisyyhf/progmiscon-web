import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildMpQuestionNavigatorItems,
  getNextMpWeekKey,
  groupMpQuestionsByWeek,
  isMpWeekComplete,
  isMpWeekGloballyComplete,
  resolveMpActiveWeek,
  selectAdjacentMpQuestionId,
  selectNextUnfinishedMpQuestionId,
  selectValidMpQuestionId,
  shouldWarnForMpQuestionNavigation,
} from "../src/utils/mpQuestionNavigator.ts";
import {
  initialMisconceptionReviewFormState,
  isMisconceptionReviewFormDirty,
  misconceptionReviewFormReducer,
} from "../src/utils/reviewMisconceptionForm.ts";

const question = (id, week, type = "multiple_choice") => ({
  id,
  week,
  type,
});
const questions = [
  question("MP-3-A", "W03"),
  question("PS-3-A", "W03", "short_answer"),
  question("MP-4-A", "W04"),
  question("MP-3-B", "W03"),
  question("MP-NONE", null),
  question("MP-4-B", "W04"),
];
const weeks = groupMpQuestionsByWeek(questions);

assert.deepEqual(
  weeks.map(({ key }) => key),
  ["W03", "W04", "unassigned"],
  "normalized weeks must use the existing numeric sort with unassigned last",
);
assert.deepEqual(
  weeks[0].questions.map(({ id }) => id),
  ["MP-3-A", "MP-3-B"],
  "question ordering inside a week must remain unchanged",
);
assert.equal(resolveMpActiveWeek(weeks, "W04"), "W04");
assert.equal(
  resolveMpActiveWeek(weeks, "W04", "MP-3-B"),
  "W03",
  "a restored question must activate its containing week",
);
assert.equal(resolveMpActiveWeek(weeks, "missing"), "W03");

const matchingIds = new Set(["MP-3-A"]);
const items = buildMpQuestionNavigatorItems(
  weeks[0].questions,
  matchingIds,
  new Map([
    ["MP-3-A", 0],
    ["MP-3-B", 3],
  ]),
  ["MP-3-B"],
  "MP-3-A",
);
assert.deepEqual(
  items.map(({ displayNumber }) => displayNumber),
  [1, 2],
  "numbering must be stable from 1..N within the full week",
);
assert.equal(items[0].active, true);
assert.equal(items[0].reviewStatus, "unreviewed");
assert.equal(items[1].reviewStatus, "reviewed");
assert.equal(items[1].reviewedByMe, true);
assert.equal(items[1].matchesFilters, false);
assert.equal(items[1].displayNumber, 2, "muted questions retain their number");

assert.deepEqual(
  [0, 1, 2, 3].map((count) =>
    buildMpQuestionNavigatorItems(
      [question(`MP-${count}`, "W03")],
      new Set([`MP-${count}`]),
      new Map([[`MP-${count}`, count]]),
      [],
    )[0].reviewStatus,
  ),
  ["unreviewed", "under_review", "under_review", "reviewed"],
  "0/3 through 3/3 must use the existing aggregate status mapping",
);

assert.equal(
  selectValidMpQuestionId(weeks[0].questions, matchingIds, "MP-3-B"),
  "MP-3-A",
  "filter changes must resolve an invalid active question",
);
assert.equal(
  selectValidMpQuestionId(weeks[0].questions, new Set()),
  undefined,
  "empty filtered results must have no invalid active question",
);
assert.equal(
  selectAdjacentMpQuestionId(
    weeks[0].questions,
    matchingIds,
    "MP-3-A",
    1,
  ),
  undefined,
  "Previous/Next must skip filtered-out questions and never cross weeks",
);
assert.equal(
  selectNextUnfinishedMpQuestionId(
    weeks[0].questions,
    new Set(["MP-3-A", "MP-3-B"]),
    ["MP-3-A"],
    "MP-3-A",
  ),
  "MP-3-B",
  "the next unfinished question must come from the same week",
);
assert.equal(isMpWeekComplete(weeks[0].questions, ["MP-3-A"]), false);
assert.equal(
  isMpWeekComplete(weeks[0].questions, ["MP-3-A", "MP-3-B"]),
  true,
);
assert.equal(
  isMpWeekGloballyComplete(
    weeks[0].questions,
    new Map([
      ["MP-3-A", 3],
      ["MP-3-B", 3],
    ]),
    3,
  ),
  true,
);
assert.equal(getNextMpWeekKey(weeks, "W03"), "W04");
assert.equal(getNextMpWeekKey(weeks, "unassigned"), undefined);

assert.equal(
  shouldWarnForMpQuestionNavigation(
    true,
    "question-mp",
    "MP-3-A",
    "question-mp",
    "MP-3-B",
  ),
  true,
);
assert.equal(
  shouldWarnForMpQuestionNavigation(
    false,
    "question-mp",
    "MP-3-A",
    "question-mp",
    "MP-3-B",
  ),
  false,
  "clean forms must not warn",
);
assert.equal(
  shouldWarnForMpQuestionNavigation(
    true,
    "question-mp",
    "MP-3-A",
    "question-mp",
    "MP-3-A",
  ),
  false,
  "reselecting the active question must not warn",
);
assert.equal(
  shouldWarnForMpQuestionNavigation(
    true,
    "question-mp",
    "MP-3-A",
    "answer-mp",
    undefined,
  ),
  true,
  "leaving the MP question workspace must warn when dirty",
);

assert.equal(
  isMisconceptionReviewFormDirty(initialMisconceptionReviewFormState),
  false,
);
const dirtyForm = misconceptionReviewFormReducer(
  initialMisconceptionReviewFormState,
  { type: "set_note", value: "Perlu diperiksa" },
);
assert.equal(isMisconceptionReviewFormDirty(dirtyForm), true);
assert.equal(
  isMisconceptionReviewFormDirty(
    misconceptionReviewFormReducer(dirtyForm, { type: "reset" }),
  ),
  false,
  "successful submission resets the dirty form state",
);

const navigatorSource = readFileSync(
  new URL("../src/components/review/MpQuestionQuizNavigator.tsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../src/pages/LecturerReviewPage.tsx", import.meta.url),
  "utf8",
);

assert.doesNotMatch(navigatorSource, /Nomor soal tetap sama|week\.questions\.length/);
assert.match(
  navigatorSource,
  /grid-cols-\[repeat\(auto-fit,minmax\(3rem,1fr\)\)\]/,
  "the compact grid must adapt to the sidebar width",
);
assert.match(
  pageSource,
  /sidebarNavigation=\{\s*workspace === "question-mp"/,
  "only the MP question workspace receives the sidebar navigator",
);
assert.match(
  pageSource,
  /option\.isCorrect\s*\? "border-correct-border bg-correct-bg"/,
  "the reference answer treatment must use the existing correctness flag",
);

const optionsIndex = pageSource.indexOf("{question.options && (");
const mpEditorIndex = pageSource.indexOf(
  '{isAdmin && question.type === "multiple_choice"',
  optionsIndex,
);
const misconceptionsIndex = pageSource.indexOf(
  '"Miskonsepsi tingkat soal"',
  mpEditorIndex,
);
assert.ok(
  optionsIndex < mpEditorIndex && mpEditorIndex < misconceptionsIndex,
  "the Admin MP question editor must follow the answer options and precede misconceptions",
);

console.log("MP question navigator self-check passed.");
