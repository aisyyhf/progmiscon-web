import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  countCurrentAdminReviewRows,
  filterCurrentAdminReviewHistory,
  filterCurrentAdminReviewsToVisibleTargets,
  groupCurrentAdminReviews,
} from "../src/utils/adminCurrentReviews.ts";
import {
  buildCurrentAnswerMisconceptionsCsv,
  buildCurrentAnswersCsv,
  buildCurrentQuestionMisconceptionsCsv,
  buildCurrentQuestionsCsv,
  buildCurrentReviewsCsv,
  buildCurrentSimilarMisconceptionsCsv,
} from "../src/utils/adminExports.ts";

const readSource = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

const reviewer = {
  reviewerId: "reviewer-1",
  fullName: "Reviewer One",
  email: "reviewer@example.test",
};
const questionReview = (overrides = {}) => ({
  id: "qr-1",
  ...reviewer,
  questionId: "q-mp",
  sourceVersion: "q-v2",
  isActive: true,
  inactiveReason: null,
  inactiveAt: null,
  hasIncorrectMisconceptions: true,
  removedMisconceptionIds: ["m-1"],
  removalReason: "Not relevant",
  hasAdditionalMisconceptions: false,
  additionalMisconceptionIds: [],
  additionReason: null,
  note: "Current question note",
  createdAt: "2026-08-19T10:00:00Z",
  updatedAt: "2026-08-19T11:00:00Z",
  ...overrides,
});
const answerReview = (overrides = {}) => ({
  id: "ar-1",
  ...reviewer,
  answerId: "a-a",
  questionId: "q-mp",
  sourceVersion: "a-v2",
  isActive: true,
  inactiveReason: null,
  inactiveAt: null,
  hasMismatchedMisconceptions: false,
  removedMisconceptionIds: [],
  removalReason: null,
  hasAdditionalMisconceptions: true,
  additionalMisconceptionIds: ["m-2"],
  additionReason: "Missing relation",
  note: "Current answer note",
  createdAt: "2026-08-19T10:00:00Z",
  updatedAt: "2026-08-19T12:00:00Z",
  ...overrides,
});

const history = {
  reviewers: [reviewer],
  questionReviews: [
    questionReview(),
    questionReview({ id: "qr-inactive", isActive: false }),
    questionReview({ id: "qr-stale", sourceVersion: "q-v1" }),
    questionReview({ id: "qr-unknown", questionId: "q-unknown" }),
  ],
  answerReviews: [
    answerReview(),
    answerReview({ id: "ar-b", answerId: "a-b", sourceVersion: "b-v2" }),
    answerReview({ id: "ar-inactive", isActive: false }),
    answerReview({ id: "ar-stale", sourceVersion: "a-v1" }),
    answerReview({ id: "ar-parent", questionId: "q-other" }),
  ],
};
const sourceVersions = {
  questions: new Map([
    ["q-mp", "q-v2"],
    ["q-unknown", "q-v2"],
  ]),
  answers: new Map([
    ["a-a", { questionId: "q-mp", sourceVersion: "a-v2" }],
    ["a-b", { questionId: "q-mp", sourceVersion: "b-v2" }],
  ]),
};

const current = filterCurrentAdminReviewHistory(history, sourceVersions);
assert.deepEqual(current.questionReviews.map(({ id }) => id), ["qr-1", "qr-unknown"]);
assert.deepEqual(current.answerReviews.map(({ id }) => id), ["ar-1", "ar-b"]);
assert.deepEqual(current.excluded, { inactive: 2, staleOrUnverifiable: 3 });

const localized = (value) => ({ id: value, en: value });
const questions = [
  {
    id: "q-mp",
    assessmentId: "assessment",
    categoryId: "topic",
    number: "1",
    title: localized("Question MP"),
    week: "W1",
    sourceSystem: null,
    sourceKey: null,
    sourceCode: null,
    level: null,
    type: "multiple_choice",
    prompt: localized("Prompt"),
    expectedConcepts: [],
    directQuestionMisconceptionIds: [],
    answerDerivedMisconceptionIds: [],
    questionMisconceptionIds: [],
  },
];
const answers = [
  {
    id: "a-b",
    questionId: "q-mp",
    answerRole: "mp_option",
    optionLabel: "B",
    order: 2,
    studentId: "",
    status: "incorrect",
    answerText: "B text",
    checks: [],
    masteredConcepts: [],
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    id: "a-a",
    questionId: "q-mp",
    answerRole: "mp_option",
    optionLabel: "A",
    order: 1,
    studentId: "",
    status: "correct",
    answerText: "A text",
    checks: [],
    masteredConcepts: [],
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
];
const visibleCurrent = filterCurrentAdminReviewsToVisibleTargets(
  current,
  questions,
  answers,
);
assert.deepEqual(visibleCurrent.excluded, {
  inactive: 2,
  staleOrUnverifiable: 4,
});
const groups = groupCurrentAdminReviews(visibleCurrent, questions, answers);
assert.equal(groups.length, 1);
assert.deepEqual(
  groups[0].reviewers[0].answerReviews.map(({ answer }) => answer.optionLabel),
  ["A", "B"],
  "answer reviews must use canonical MP option order",
);
assert.deepEqual(countCurrentAdminReviewRows(groups), {
  questions: 1,
  reviewers: 1,
  questionReviews: 1,
  answerReviews: 2,
  totalReviews: 3,
});
const reviewCsv = buildCurrentReviewsCsv(groups);
assert.equal(reviewCsv.rows.length, 3);
assert.ok(reviewCsv.headers.includes("source_version"));
assert.ok(reviewCsv.headers.includes("removed_misconception_ids"));
assert.ok(reviewCsv.headers.includes("additional_misconception_ids"));

const masterData = {
  topics: [],
  questions: [
    {
      question_id: "q-1",
      question_type: "multiple_choice",
      title_ind: "Aktif",
      title_en: "Active",
      question_ind: "Prompt",
      question_en: "Prompt",
      question_code: "",
      options_json: '[{"label":"A"}]',
      correct_option_label: "A",
      reference_solution: "",
      expected_output: "",
      week: "W1",
      source_no: "1",
      order_no: "1",
      active: "TRUE",
      data_status: "published",
    },
    {
      question_id: "q-off",
      title_ind: "Off",
      title_en: "Off",
      question_ind: "Off",
      question_en: "Off",
      question_code: "",
      reference_solution: "",
      expected_output: "",
      week: "",
      source_no: "",
      order_no: "2",
      active: "FALSE",
      data_status: "published",
    },
  ],
  questionTopics: [],
  answers: [
    {
      answer_id: "a-1",
      question_id: "q-1",
      answer_role: "mp_option",
      option_label: "A",
      answer_text: "Answer",
      status: "correct",
      explanation_ind: "",
      explanation_en: "",
      order_no: "1",
      active: "TRUE",
      student_name: "Must not export",
      student_user_id: "private-id",
    },
    {
      answer_id: "a-off",
      question_id: "q-1",
      answer_role: "mp_option",
      answer_text: "Off",
      status: "incorrect",
      explanation_ind: "",
      explanation_en: "",
      order_no: "2",
      active: "FALSE",
    },
  ],
  misconceptions: [
    {
      misconception_id: "m-1",
      topic_id: "topic",
      title_ind: "M1",
      title_en: "M1",
      description_ind: "",
      description_en: "",
      wrong_example: "",
      correct_example: "",
      correction_ind: "",
      correction_en: "",
      common_cause_ind: "",
      common_cause_en: "",
      order_no: "1",
      active: "TRUE",
    },
    {
      misconception_id: "m-2",
      topic_id: "topic",
      title_ind: "M2",
      title_en: "M2",
      description_ind: "",
      description_en: "",
      wrong_example: "",
      correct_example: "",
      correction_ind: "",
      correction_en: "",
      common_cause_ind: "",
      common_cause_en: "",
      order_no: "2",
      active: "TRUE",
    },
  ],
  questionMisconceptions: [
    { question_id: "q-1", misconception_id: "m-1", source: "current", active: "TRUE" },
    { question_id: "q-off", misconception_id: "m-1", source: "old", active: "TRUE" },
  ],
  answerMisconceptions: [
    { answer_id: "a-1", misconception_id: "m-1", reason_ind: "", reason_en: "", active: "TRUE" },
    { answer_id: "a-off", misconception_id: "m-1", reason_ind: "", reason_en: "", active: "TRUE" },
  ],
  similarMisconceptions: [
    { misconception_id: "m-1", similar_id: "m-2", note_ind: "", note_en: "", status: "approved" },
    { misconception_id: "m-1", similar_id: "m-2", note_ind: "", note_en: "", status: "rejected" },
  ],
};

assert.equal(buildCurrentQuestionsCsv(masterData).rows.length, 1);
const answerCsv = buildCurrentAnswersCsv(masterData);
assert.equal(answerCsv.rows.length, 1);
assert.ok(answerCsv.headers.includes("answer_role"));
assert.ok(!answerCsv.headers.includes("student_name"));
assert.ok(!answerCsv.headers.includes("student_user_id"));
assert.equal(buildCurrentQuestionMisconceptionsCsv(masterData).rows.length, 1);
assert.equal(buildCurrentAnswerMisconceptionsCsv(masterData).rows.length, 1);
assert.equal(buildCurrentSimilarMisconceptionsCsv(masterData).rows.length, 1);

const [
  app,
  shell,
  sidebar,
  topNav,
  filterSelect,
  questionsPage,
  reviewsPage,
  exportsPage,
] =
  await Promise.all([
    readSource("src/app/App.tsx"),
    readSource("src/components/layout/AppShell.tsx"),
    readSource("src/components/layout/LecturerSidebar.tsx"),
    readSource("src/components/layout/TopNav.tsx"),
    readSource("src/components/admin/AdminFilterSelect.tsx"),
    readSource("src/pages/AdminQuestionsPage.tsx"),
    readSource("src/pages/AdminReviewsPage.tsx"),
    readSource("src/pages/AdminExportsPage.tsx"),
  ]);

for (const route of ["/admin/questions", "/admin/reviews", "/admin/exports"]) {
  assert.match(app, new RegExp(`path="${route}"[\\s\\S]*?<AdminOnly>`));
  assert.match(sidebar, new RegExp(`to="${route}"`));
}
assert.match(app, /path="\/admin"[\s\S]*?<Navigate to="\/admin\/questions" replace \/>/);
assert.match(shell, /pathname\.startsWith\("\/admin\/"\)/);
assert.doesNotMatch(app, /AdminPage/);
assert.doesNotMatch(topNav, /Admin Progmiscon|to="\/admin"/);
assert.match(questionsPage, /getQuestions\(\)/);
assert.match(reviewsPage, /buildCurrentReviewsCsv\(filteredGroups\)/);
assert.match(exportsPage, /getMasterData/);

for (const page of [questionsPage, reviewsPage, exportsPage]) {
  assert.doesNotMatch(page, /uppercase tracking-\[0\.16em\][^>]*>Admin</);
}
assert.match(
  questionsPage,
  /Lihat data soal yang sedang digunakan di Progmiscon\./,
);
assert.match(
  questionsPage,
  /View the question data currently used in Progmiscon\./,
);
assert.match(reviewsPage, /return `\$\{count\} item review`/);
assert.match(
  reviewsPage,
  /return `\$\{count\} review \$\{count === 1 \? "item" : "items"\}`/,
);
assert.equal((questionsPage.match(/<AdminFilterSelect/g) ?? []).length, 2);
assert.equal((reviewsPage.match(/<AdminFilterSelect/g) ?? []).length, 3);
assert.match(filterSelect, /ComponentPropsWithoutRef<"select">/);
assert.match(filterSelect, /appearance-none/);
assert.match(filterSelect, /h-10 w-full/);
assert.match(filterSelect, /py-2 pl-3 pr-10/);
assert.match(filterSelect, /pointer-events-none absolute right-3 top-1\/2/);
assert.match(filterSelect, /<ChevronDown/);

const mountedAdminSources = [questionsPage, reviewsPage, exportsPage].join("\n");
assert.doesNotMatch(
  mountedAdminSources,
  /AdminFinalizationPanel|saveQuestionReview|saveAnswerReview|publish|override|supabase\.rpc|\.from\(/i,
  "mounted Admin MVP pages must remain read-only",
);

console.log("Admin read-only MVP checks passed.");
