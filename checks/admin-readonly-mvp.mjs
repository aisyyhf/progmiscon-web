import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  countCurrentAdminReviewRows,
  filterCurrentAdminReviewHistory,
  filterCurrentAdminReviewsToVisibleTargets,
  groupCurrentAdminReviews,
  resolveReviewLifecycleLabels,
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
// MP review is Question Review only: reviewer groups are question-review-driven
// and never surface the retired A/B/C/D Answer Reviews.
const groups = groupCurrentAdminReviews(visibleCurrent, questions);
assert.equal(groups.length, 1);
assert.equal(groups[0].reviewers.length, 1);
assert.ok(groups[0].reviewers[0].questionReview, "group carries the question review");
assert.deepEqual(
  groups[0].reviewers[0].answerReviews,
  [],
  "Answer Reviews never surface as current Admin activity",
);
assert.deepEqual(countCurrentAdminReviewRows(groups), {
  questions: 1,
  reviewers: 1,
  questionReviews: 1,
  answerReviews: 0,
  totalReviews: 1,
});
const reviewCsv = buildCurrentReviewsCsv(groups, {
  misconceptions: [],
  language: "id",
});
assert.equal(reviewCsv.rows.length, 1, "one row per Question Review generation");
assert.deepEqual(reviewCsv.headers, [
  "Minggu",
  "Tipe Soal",
  "Kode Soal",
  "Judul Soal",
  "Nama Reviewer",
  "Waktu Review",
  "Terakhir Diperbarui",
  "Status Review",
  "Aktivitas Terakhir",
  "Hasil Review",
  "Miskonsepsi yang Tercantum",
  "Miskonsepsi yang Dihapus",
  "Alasan Penghapusan Miskonsepsi",
  "Miskonsepsi yang Ditambahkan",
  "Alasan Penambahan Miskonsepsi",
  "Miskonsepsi Menurut Reviewer",
  "Catatan Tambahan",
]);
assert.equal(reviewCsv.headers.length, 17);
assert.ok(
  !reviewCsv.headers.includes("Opsi jawaban") &&
    !reviewCsv.headers.includes("Bagian yang Direview") &&
    !reviewCsv.headers.includes("Pemetaan Opsi") &&
    !reviewCsv.headers.includes("Kode Miskonsepsi"),
  "retired Answer Review columns and dropped context columns are gone",
);
for (const header of reviewCsv.headers) {
  assert.ok(!header.includes("_"), `header "${header}" must not use underscores`);
}
for (const banned of [
  "source_version",
  "review_id",
  "reviewer_id",
  "reviewer_email",
  "question_id",
  "answer_id",
  "is_active",
  "id_lms",
]) {
  assert.ok(
    !reviewCsv.headers.includes(banned),
    `internal header ${banned} must not be exported`,
  );
}
assert.equal(reviewCsv.rows[0][4], "Reviewer One");
assert.deepEqual(reviewCsv.rows[0].slice(7, 10), [
  "Aktif",
  "Direview",
  "Perlu revisi - ada miskonsepsi yang dihapus",
]);
for (const row of reviewCsv.rows) {
  assert.ok(
    !row.includes("Opsi jawaban") &&
      !row.some((cell) => String(cell).includes("Jawaban benar")),
    "no Answer Review rows and no per-option mapping text in the export",
  );
}

// --- Lifecycle: deleted generations are kept for Admin history, never counted.
const deletedHistory = {
  reviewers: [reviewer],
  questionReviews: [
    questionReview(),
    questionReview({
      id: "qr-deleted",
      isActive: false,
      inactiveReason: "deleted",
      inactiveAt: "2026-08-20T09:00:00Z",
      updatedAt: "2026-08-20T09:00:00Z",
    }),
    questionReview({
      id: "qr-source-updated",
      isActive: false,
      inactiveReason: "source_updated",
      inactiveAt: "2026-08-20T08:00:00Z",
    }),
  ],
  answerReviews: [answerReview()],
};
const deletedCurrent = filterCurrentAdminReviewHistory(
  deletedHistory,
  sourceVersions,
);
assert.deepEqual(
  deletedCurrent.deletedQuestionReviews.map(({ id }) => id),
  ["qr-deleted"],
  "lecturer-deleted rows are bucketed for Admin history",
);
assert.equal(
  deletedCurrent.excluded.inactive,
  1,
  "source_updated rows stay excluded, not shown as deleted",
);
const deletedVisible = filterCurrentAdminReviewsToVisibleTargets(
  deletedCurrent,
  questions,
  answers,
);
const deletedGroups = groupCurrentAdminReviews(deletedVisible, questions);
assert.equal(deletedGroups.length, 1);
assert.equal(deletedGroups[0].deletedReviewers.length, 1);
assert.deepEqual(countCurrentAdminReviewRows(deletedGroups), {
  questions: 1,
  reviewers: 1,
  questionReviews: 1,
  answerReviews: 0,
  totalReviews: 1,
});
assert.deepEqual(
  resolveReviewLifecycleLabels(
    { id: "qr-deleted", isActive: false, inactiveReason: "deleted" },
    new Map(),
  ),
  { status: "deleted", lastActivity: "deleted" },
);
assert.deepEqual(
  resolveReviewLifecycleLabels(
    { id: "qr-1", isActive: true, inactiveReason: null },
    new Map([
      [
        "qr-1",
        { reviewType: "question", reviewId: "qr-1", lastEventType: "edited", lastEventAt: null, edited: true, lastDeletedAt: null, lastDeletedBefore: null },
      ],
    ]),
  ),
  { status: "active", lastActivity: "edited" },
);

// A deleted generation that was reactivated (live row active) is reconstructed
// from the lifecycle before-image.
const reactivatedCurrent = filterCurrentAdminReviewHistory(
  { reviewers: [reviewer], questionReviews: [questionReview()], answerReviews: [] },
  sourceVersions,
  [
    {
      reviewType: "question",
      reviewId: "qr-1",
      lastEventType: "edited",
      lastEventAt: "2026-08-21T00:00:00Z",
      edited: true,
      lastDeletedAt: "2026-08-19T20:00:00Z",
      lastDeletedBefore: {
        reviewer_id: "reviewer-1",
        question_id: "q-mp",
        source_version: "q-v2",
        has_incorrect_misconceptions: true,
        removed_misconception_ids: ["m-1"],
        removal_reason: "old removal",
        has_additional_misconceptions: false,
        additional_misconception_ids: [],
        addition_reason: null,
        note: "old generation",
        created_at: "2026-08-18T10:00:00Z",
      },
    },
  ],
);
assert.equal(reactivatedCurrent.questionReviews.length, 1);
assert.equal(reactivatedCurrent.deletedQuestionReviews.length, 1);
assert.equal(reactivatedCurrent.deletedQuestionReviews[0].note, "old generation");
assert.equal(reactivatedCurrent.deletedQuestionReviews[0].inactiveReason, "deleted");

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
assert.match(reviewsPage, /buildCurrentReviewsCsv\(filteredGroups, \{/);
assert.match(reviewsPage, /progmiscon_hasil_review_dosen_\$\{wibDateStamp\(\)\}\.csv/);
assert.match(
  reviewsPage,
  /"Unduh Hasil Review \(CSV\)" : "Download Review Results \(CSV\)"/,
);
assert.match(exportsPage, /getMasterData/);

// Lifecycle presentation wording: an initial active review reads as
// "Direview" / "Reviewed"; edited/deleted are preserved. The audit event type
// stays `created` (the mapping key), and lifecycle detection is untouched.
assert.match(reviewsPage, /created: "Direview"/);
assert.match(reviewsPage, /created: "Reviewed"/);
assert.match(reviewsPage, /edited: "Diedit"/);
assert.match(reviewsPage, /deleted: "Dihapus"/);
assert.doesNotMatch(reviewsPage, /"Dibuat"/);
assert.match(reviewsPage, /STATUS_LABEL = \{ active: "Aktif", deleted: "Dihapus" \}/);
assert.match(reviewsPage, /resolveReviewLifecycleLabels\(/);

// MP review is Question Review only in the Admin view + export.
assert.doesNotMatch(
  reviewsPage,
  /Review pilihan jawaban|Answer option reviews|"Review jawaban" : "Answer reviews"/,
  "Admin Hasil Review Dosen no longer renders Answer Review cards or count",
);
assert.doesNotMatch(reviewsPage, /buildCurrentReviewsCsv\([\s\S]{0,120}answers:/);
assert.match(reviewsPage, /groupCurrentAdminReviews\(data\.current, data\.questions\)/);

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

// Hasil Review Dosen and Export Data stay strictly read-only. Hasil Review Dosen
// is a review-names / content / history surface, never a destructive-action one.
assert.doesNotMatch(
  [reviewsPage, exportsPage].join("\n"),
  /AdminFinalizationPanel|saveQuestionReview|saveAnswerReview|publish|override|resetQuestionReviews|supabase\.rpc|\.from\(/i,
  "Hasil Review Dosen / Export Data pages must remain read-only",
);
// Kelola Soal carries exactly ONE sanctioned admin write: the per-question
// targeted Question Review reset (reset_question_reviews_v3), shown per question
// alongside the active review count. It must not gain any other mutation, publish
// path, override write, lecturer save, direct RPC or direct table access, and
// Edit Soal is deliberately not implemented yet.
assert.match(
  questionsPage,
  /resetQuestionReviews\(/,
  "Kelola Soal exposes the targeted Question Review reset",
);
assert.doesNotMatch(
  questionsPage,
  /AdminFinalizationPanel|saveQuestionReview|saveAnswerReview|publish|ContentOverride|MisconceptionOverride|saveQuestionContentOverride|supabase\.rpc|\.from\(|\.insert\(|\.update\(|sync_master/i,
  "Kelola Soal may only perform the targeted Question Review reset",
);

console.log("Admin read-only MVP checks passed.");
