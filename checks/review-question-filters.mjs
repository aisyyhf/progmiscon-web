import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mapQuestionReviewCountRows } from "../src/utils/questionReviewCounts.ts";
import {
  QUESTION_REVIEWED_THRESHOLD,
  REVIEW_FILTER_ALL,
  REVIEW_MISCONCEPTION_NONE,
  REVIEW_WEEK_UNASSIGNED,
  filterReviewQuestions,
  getActiveReviewQuestionFilterCount,
  getQuestionReviewStatus,
} from "../src/utils/reviewQuestionFilters.ts";
import {
  REVIEW_QUESTION_FILTER_SESSION_KEY,
  createDefaultReviewQuestionFilterSession,
  parseReviewQuestionFilterSession,
  serializeReviewQuestionFilterSession,
} from "../src/utils/reviewQuestionFilterSession.ts";

function question(
  id,
  number,
  week,
  categoryId,
  questionMisconceptionIds = [],
) {
  return {
    id,
    assessmentId: "assessment",
    categoryId,
    number,
    title: { id, en: id },
    week,
    sourceSystem: null,
    sourceKey: null,
    sourceCode: null,
    level: null,
    type: "short_answer",
    prompt: { id, en: id },
    expectedConcepts: [],
    questionMisconceptionIds,
  };
}

const questions = [
  question("Q-PS-10", "10", "W01", "KC-1", ["M-1"]),
  question("Q-PS-2", "SRC-204", null, "KC-2"),
  question("Q-PS-3", "30", "", "KC-1", ["M-2"]),
  question("Q-PS-4", "40", "W02", "KC-2", ["M-1", "M-2"]),
];
const counts = new Map([
  ["Q-PS-10", 0],
  ["Q-PS-2", 1],
  ["Q-PS-3", 2],
  ["Q-PS-4", 3],
]);
const allFilters = {
  query: "",
  status: REVIEW_FILTER_ALL,
  week: REVIEW_FILTER_ALL,
  categoryId: REVIEW_FILTER_ALL,
  misconceptionId: REVIEW_FILTER_ALL,
};
const ids = (filters) =>
  filterReviewQuestions(questions, counts, { ...allFilters, ...filters }).map(
    ({ id }) => id,
  );

assert.equal(getActiveReviewQuestionFilterCount(allFilters), 0);
assert.equal(
  getActiveReviewQuestionFilterCount({ ...allFilters, query: " Q-PS " }),
  1,
);
assert.equal(
  getActiveReviewQuestionFilterCount({
    ...allFilters,
    status: "under_review",
    week: "W01",
    misconceptionId: "M-1",
  }),
  3,
);
assert.equal(
  getActiveReviewQuestionFilterCount(
    { ...allFilters, week: "W01" },
    false,
  ),
  0,
  "MP week navigation must not count as a panel filter",
);

assert.equal(QUESTION_REVIEWED_THRESHOLD, 3);
assert.equal(getQuestionReviewStatus(0), "unreviewed");
assert.equal(getQuestionReviewStatus(1), "under_review");
assert.equal(getQuestionReviewStatus(2), "under_review");
assert.equal(getQuestionReviewStatus(3), "reviewed");
assert.equal(getQuestionReviewStatus(8), "reviewed");
assert.deepEqual(ids({ query: " q-ps-10 " }), ["Q-PS-10"]);
assert.deepEqual(ids({ query: "src-204" }), ["Q-PS-2"]);
assert.deepEqual(ids({ week: "W01" }), ["Q-PS-10"]);
assert.deepEqual(ids({ week: REVIEW_WEEK_UNASSIGNED }), [
  "Q-PS-2",
  "Q-PS-3",
]);
assert.deepEqual(ids({ categoryId: "KC-1" }), ["Q-PS-10", "Q-PS-3"]);
assert.deepEqual(ids({ misconceptionId: "M-1" }), ["Q-PS-10", "Q-PS-4"]);
assert.deepEqual(ids({ misconceptionId: REVIEW_MISCONCEPTION_NONE }), [
  "Q-PS-2",
]);
assert.deepEqual(
  ids({
    status: "under_review",
    week: REVIEW_WEEK_UNASSIGNED,
    categoryId: "KC-1",
    misconceptionId: "M-2",
  }),
  ["Q-PS-3"],
  "all filters must use AND logic",
);
assert.deepEqual(ids({ misconceptionId: "M-1" }), ["Q-PS-10", "Q-PS-4"]);

const originalQuestions = structuredClone(questions);
const originalCounts = new Map(counts);
filterReviewQuestions(questions, counts, {
  ...allFilters,
  status: "under_review",
});
assert.deepEqual(questions, originalQuestions, "questions must not be mutated");
assert.deepEqual(counts, originalCounts, "counts must not be mutated");

assert.deepEqual(
  mapQuestionReviewCountRows([
    {
      question_id: " Q-1 ",
      review_count: "2",
      latest_updated_at: null,
    },
    {
      question_id: "Q-2",
      review_count: "invalid",
      latest_updated_at: "2026-07-28T01:00:00Z",
    },
    { question_id: "Q-3", review_count: -1, latest_updated_at: null },
    { question_id: "Q-1", review_count: 9, latest_updated_at: "later" },
    { question_id: "  ", review_count: 4, latest_updated_at: null },
  ]),
  [
    { questionId: "Q-1", reviewCount: 2, latestUpdatedAt: null },
    {
      questionId: "Q-2",
      reviewCount: 0,
      latestUpdatedAt: "2026-07-28T01:00:00Z",
    },
    { questionId: "Q-3", reviewCount: 0, latestUpdatedAt: null },
  ],
);

const defaultFilterSession = createDefaultReviewQuestionFilterSession();
assert.deepEqual(parseReviewQuestionFilterSession(null), defaultFilterSession);
assert.deepEqual(
  parseReviewQuestionFilterSession("{not valid json"),
  defaultFilterSession,
);
assert.deepEqual(
  parseReviewQuestionFilterSession(
    JSON.stringify({
      ps: {
        query: "PS-only",
        status: "invalid",
        week: 7,
        categoryId: "KC-PS",
      },
      mp: {
        query: "MP-only",
        status: "reviewed",
        week: "W02",
        categoryId: null,
        misconceptionId: "M-MP",
      },
    }),
  ),
  {
    ps: {
      ...allFilters,
      query: "PS-only",
      categoryId: "KC-PS",
    },
    mp: {
      ...allFilters,
      query: "MP-only",
      status: "reviewed",
      week: "W02",
      misconceptionId: "M-MP",
    },
  },
  "partial and invalid fields must fall back independently",
);
const separateFilterSession = {
  ps: { ...allFilters, query: "PS", status: "under_review" },
  mp: { ...allFilters, query: "MP", week: "W03" },
};
assert.deepEqual(
  parseReviewQuestionFilterSession(
    serializeReviewQuestionFilterSession(separateFilterSession),
  ),
  separateFilterSession,
  "PS and MP filters must survive a serialize/parse round trip separately",
);
assert.equal(
  REVIEW_QUESTION_FILTER_SESSION_KEY,
  "progmiscon.review.question-filters.v1",
);

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260728_001_question_review_counts_rpc.sql",
    import.meta.url,
  ),
  "utf8",
);
const repeatReviewMigration = await readFile(
  new URL(
    "../supabase/migrations/20260728_002_prevent_repeat_lecturer_reviews.sql",
    import.meta.url,
  ),
  "utf8",
);
const repository = await readFile(
  new URL("../src/services/reviewPersistenceRepository.ts", import.meta.url),
  "utf8",
);
const page = await readFile(
  new URL("../src/pages/LecturerReviewPage.tsx", import.meta.url),
  "utf8",
);
const filterComponent = await readFile(
  new URL(
    "../src/components/review/ReviewQuestionFilters.tsx",
    import.meta.url,
  ),
  "utf8",
);
const aggregateFunction = repository.match(
  /export async function getQuestionReviewCounts\(\)[\s\S]*?(?=\nexport async function)/,
)?.[0];
const personalProgressLoader = page.match(
  /const loadPersonalProgress = async \(\) => \{[\s\S]*?(?=\r?\n\s*const loadQuestionCounts)/,
)?.[0];
const questionCountsLoader = page.match(
  /const loadQuestionCounts = async \(\) => \{[\s\S]*?(?=\r?\n\s*const loadAnswerCounts)/,
)?.[0];
const reviewerHistoryLoader = page.match(
  /void getReviewerHistory\(user\.id\)[\s\S]*?\.finally\(\(\) => \{[\s\S]*?\n\s*\}\);/,
)?.[0];
const pageLoadingExpression = page.match(
  /const loading =([\s\S]*?);/,
)?.[1];
const returnedColumns = migration.match(
  /returns table\s*\(([\s\S]*?)\)\s*language sql/i,
)?.[1];

const mojibakeSequences = [
  String.fromCodePoint(0x252c, 0x2556),
  String.fromCodePoint(0x00c3),
  String.fromCodePoint(0x00c2),
];

for (const [name, source] of [
  ["LecturerReviewPage", page],
  ["ReviewQuestionFilters", filterComponent],
]) {
  for (const mojibake of mojibakeSequences) {
    assert.doesNotMatch(
      source,
      new RegExp(mojibake),
      `${name} must not contain ${mojibake}`,
    );
  }
}

assert.ok(aggregateFunction, "getQuestionReviewCounts function was not found");
assert.match(
  migration,
  /create or replace function public\.get_question_review_counts\s*\(\s*\)/i,
);
assert.match(migration, /language sql/i);
assert.match(migration, /stable/i);
assert.match(migration, /security definer/i);
assert.match(migration, /set search_path\s*=\s*''/i);
assert.match(migration, /from public\.question_reviews/i);
assert.match(migration, /from public\.lecturer_profiles/i);
assert.match(
  migration,
  /public\.lecturer_profiles\.user_id\s*=\s*\(select auth\.uid\(\)\)[\s\S]*?public\.lecturer_profiles\.active\s*=\s*true/i,
);
assert.match(
  migration,
  /count\s*\(\s*distinct public\.question_reviews\.reviewer_id\s*\)/i,
);
assert.match(migration, /max\s*\(\s*public\.question_reviews\.updated_at\s*\)/i);
assert.ok(returnedColumns, "RPC return table was not found");
assert.doesNotMatch(returnedColumns, /reviewer_id|email|full_name|note/i);
assert.match(
  migration,
  /revoke all on function public\.get_question_review_counts\(\) from public/i,
);
assert.match(
  migration,
  /revoke all on function public\.get_question_review_counts\(\) from anon,\s*service_role/i,
);
assert.match(
  migration,
  /grant execute on function public\.get_question_review_counts\(\) to authenticated/i,
);
assert.doesNotMatch(migration, /grant execute[\s\S]*?\bto anon\b/i);
assert.doesNotMatch(migration, /grant execute[\s\S]*?\bto service_role\b/i);

assert.match(
  aggregateFunction,
  /\.rpc\("get_question_review_counts"\)/,
);
assert.doesNotMatch(aggregateFunction, /\.from\("question_reviews"\)/);
assert.doesNotMatch(aggregateFunction, /catch|fallback/i);

assert.match(
  page,
  /filterPanelExpanded && \(\s*<ReviewQuestionFilters/,
);
assert.match(page, /aria-expanded=\{filterPanelExpanded\}/);
assert.match(page, /aria-controls=\{filterPanelId\}/);
assert.match(
  page,
  /onClick=\{\(\) => setFilterPanelOpen\(\(open\) => !open\)\}/,
);
assert.match(
  page,
  /getActiveReviewQuestionFilterCount\(\s*questionFilters\[activeParentKind\],\s*workspace === "question-ps"/,
);
assert.match(page, /Evidence \$\{currentPosition\}/);
assert.match(
  page,
  /\$\{progress\.reviewed\} dari \$\{progress\.total\} jawaban sudah Anda review/,
);
assert.match(
  page,
  /You have reviewed \$\{progress\.reviewed\} of \$\{progress\.total\} answers/,
);
assert.doesNotMatch(
  page,
  /Promise\.all\([\s\S]{0,300}getSavedReviewProgress\(\)[\s\S]{0,300}getQuestionReviewCounts\(\)/,
);
assert.match(page, /const loadPersonalProgress = async \(\) =>/);
assert.match(page, /const loadQuestionCounts = async \(\) =>/);
assert.ok(personalProgressLoader, "personal progress loader was not found");
assert.ok(questionCountsLoader, "question counts loader was not found");
assert.ok(reviewerHistoryLoader, "reviewer history loader was not found");
assert.match(personalProgressLoader, /getSavedReviewProgress\(\)/);
assert.doesNotMatch(personalProgressLoader, /getQuestionReviewCounts/);
assert.match(reviewerHistoryLoader, /setReviewedQuestionIds/);
assert.match(reviewerHistoryLoader, /setReviewedAnswerIds/);
assert.match(
  reviewerHistoryLoader,
  /review\.isActive\s*&&\s*review\.sourceVersion ===\s*reviewSourceVersions\.questions\.get\(review\.questionId\)/,
);
assert.match(
  reviewerHistoryLoader,
  /review\.sourceVersion === source\?\.sourceVersion\s*&&\s*review\.questionId === source\.questionId/,
);
assert.match(questionCountsLoader, /getQuestionReviewCounts\(\)/);
assert.match(questionCountsLoader, /setQuestionReviewCounts/);
assert.match(questionCountsLoader, /setQuestionCountsLoaded\(true\)/);
assert.doesNotMatch(questionCountsLoader, /getSavedReviewProgress/);
assert.ok(pageLoadingExpression, "page loading expression was not found");
assert.doesNotMatch(pageLoadingExpression, /questionCountsLoading/);
assert.match(pageLoadingExpression, /progressLoading/);
assert.match(page, /const \[progressLoading, setProgressLoading\]/);
assert.match(page, /const \[progressError, setProgressError\]/);
assert.match(page, /const \[progressLoaded, setProgressLoaded\]/);
assert.match(
  page,
  /const \[questionCountsLoading, setQuestionCountsLoading\]/,
);
assert.match(page, /const \[questionCountsError, setQuestionCountsError\]/);
assert.match(page, /const \[questionCountsLoaded, setQuestionCountsLoaded\]/);
assert.match(
  page,
  /ps:\s*questionCountsLoaded\s*\?\s*questionFilters\.ps\s*:\s*\{\s*\.\.\.questionFilters\.ps,\s*status:\s*REVIEW_FILTER_ALL\s*\}/,
);
assert.match(
  page,
  /mp:\s*questionCountsLoaded\s*\?\s*questionFilters\.mp\s*:\s*\{\s*\.\.\.questionFilters\.mp,\s*status:\s*REVIEW_FILTER_ALL\s*\}/,
);
assert.match(
  page,
  /"question-ps": getReviewProgress\(\s*allWorkspaceItems\["question-ps"\]/,
);
assert.match(
  page,
  /"question-mp": getReviewProgress\(\s*allWorkspaceItems\["question-mp"\]/,
);
assert.match(page, /: navigableWorkspaceItems\[workspace\]/);
assert.match(
  page,
  /"answer-ps": allWorkspaceItems\["answer-ps"\]/,
);
assert.match(
  page,
  /"answer-mp": allWorkspaceItems\["answer-mp"\]/,
);
assert.match(
  page,
  /questionReviewCount=\{\s*questionCountsLoaded\s*\? \(questionReviewCounts\.get\(activeQuestion\.id\) \?\? 0\)/,
);
assert.match(page, /alreadyReviewed/);
assert.match(
  page,
  /if \(\s*!alreadyReviewed &&\s*progressLoaded &&\s*questionCountsLoaded\s*\)/,
);
assert.match(page, /statusAvailable=\{questionCountsLoaded\}/);
assert.match(page, /statusLoading=\{questionCountsLoading\}/);
assert.match(page, /statusError=\{questionCountsError\}/);
assert.match(page, /Status agregat review belum dapat dimuat\./);
assert.match(
  page,
  /telah selesai oleh \$\{QUESTION_REVIEWED_THRESHOLD\} reviewer/,
);
assert.match(
  page,
  /has been completed by \$\{QUESTION_REVIEWED_THRESHOLD\} reviewers/,
);
assert.match(page, /selectAfterQuestionReview/);
assert.match(page, /selectAfterAnswerReview/);
assert.match(page, /onReviewAnswer=/);
assert.match(
  page,
  /useState<ReviewQuestionFilterSessionState>\(readStoredQuestionFilters\)/,
);
assert.match(page, /effectiveQuestionFilters\.ps/);
assert.match(page, /effectiveQuestionFilters\.mp/);
assert.match(page, /filters=\{questionFilters\[activeParentKind\]\}/);
assert.match(
  page,
  /setQuestionFilters\(\(current\) => \(\{\s*\.\.\.current,\s*\[activeParentKind\]: filters,/,
);
assert.match(
  page,
  /setActiveQuestionFilters\(\{\s*\.\.\.DEFAULT_REVIEW_QUESTION_FILTERS,/,
);
assert.match(page, /REVIEW_QUESTION_FILTER_SESSION_KEY/);
assert.match(page, /window\.sessionStorage\.getItem/);
assert.match(page, /window\.sessionStorage\.setItem/);
assert.doesNotMatch(page, /localStorage/);
assert.match(
  page,
  /reviewedQuestionIds\.includes\(activeQuestion\.id\)/,
);
assert.match(
  page,
  /questionReviewCounts\.get\(activeQuestion\.id\)[\s\S]{0,100}>=\s*QUESTION_REVIEWED_THRESHOLD/,
);
assert.match(
  page,
  /activeQuestionLocked\s*=\s*activeQuestionGloballyComplete && !activeQuestionReviewedByMe/,
);
assert.match(
  page,
  /reviewedAnswerIds\.includes\(activeAnswer\.id\)/,
);
assert.match(
  page,
  /activeAnswerGloballyComplete\s*&&\s*!activeAnswerReviewedByMe/,
);
assert.match(
  page,
  /if \(!progressLoaded \|\| activeQuestionLocked\) return;/,
);
assert.match(
  page,
  /if \([\s\S]{0,120}!progressLoaded \|\|[\s\S]{0,120}!answerCountsLoaded \|\|[\s\S]{0,120}activeAnswerLocked[\s\S]{0,40}\) return;/,
);
assert.match(
  page,
  /await saveQuestionReview\(\s*activeQuestion\.id,\s*activeQuestion\.sourceVersion,\s*values/,
);
assert.match(
  page,
  /await saveAnswerReview\(\s*activeAnswer\.id,\s*answerQuestion\.id,\s*activeAnswer\.sourceVersion,\s*values/,
);
assert.match(
  page,
  /progressUnavailable=\{\s*!progressLoaded \|\|\s*!sourceVersionsLoaded \|\|[\s\S]{0,120}!activeQuestion\.sourceVersion\s*\}/,
);
assert.match(
  page,
  /progressUnavailable=\{\s*!progressLoaded \|\|\s*!answerCountsLoaded \|\|\s*!sourceVersionsLoaded \|\|[\s\S]{0,120}!activeAnswer\.sourceVersion\s*\}/,
);
assert.equal(
  page.match(/const formUnavailable = locked \|\| progressUnavailable;/g)
    ?.length,
  1,
);
assert.equal(
  page.match(
    /const formUnavailable = readOnly \|\| locked \|\| progressUnavailable;/g,
  )?.length,
  1,
);
assert.equal(page.match(/\sdisabled=\{formUnavailable\}/g)?.length, 2);
assert.equal(
  page.match(/progressUnavailable \? \(\s*<ReviewProgressUnavailableNotice \/>/g)
    ?.length,
  2,
);
assert.match(page, /if \(\s*formUnavailable \|\|\s*!canSubmit/);
assert.match(
  page,
  /Status review Anda belum dapat dimuat\. Muat ulang halaman sebelum melanjutkan review\./,
);
assert.match(page, /onClick=\{\(\) => window\.location\.reload\(\)\}/);
assert.match(page, /Muat ulang/);
assert.match(page, /Anda sudah mereview soal ini\./);
assert.match(page, /Hapus review jawaban ini\?/);
assert.match(page, /Lihat review saya/);
assert.match(page, /navigate\("\/review\/riwayat"\)/);
assert.match(page, /onPrevious=\{\(\) => selectOffset\(-1\)\}/);
assert.match(page, /onNext=\{\(\) => selectOffset\(1\)\}/);
assert.match(
  filterComponent,
  /const statusDisabled = statusLoading \|\| !statusAvailable/,
);
assert.match(filterComponent, /disabled=\{statusDisabled\}/);
assert.match(filterComponent, /aria-disabled=\{statusDisabled\}/);
assert.match(
  filterComponent,
  /value=\{statusAvailable \? filters\.status : REVIEW_FILTER_ALL\}/,
);
assert.match(filterComponent, /review-question-status-help/);
assert.match(filterComponent, /Tanpa miskonsepsi/);
assert.match(filterComponent, /misconceptionLabel\(misconception, language\)/);

assert.match(
  repeatReviewMigration,
  /create or replace function public\.prevent_repeat_lecturer_review_update\(\)/i,
);
assert.match(repeatReviewMigration, /language plpgsql/i);
assert.match(repeatReviewMigration, /security invoker/i);
assert.match(repeatReviewMigration, /set search_path\s*=\s*''/i);
assert.match(
  repeatReviewMigration,
  /if\s+\(select auth\.uid\(\)\)\s*=\s*old\.reviewer_id\s+then/i,
);
assert.match(repeatReviewMigration, /REVIEW_ALREADY_SUBMITTED/);
assert.equal(
  repeatReviewMigration.match(/create trigger\s+\w+/gi)?.length,
  2,
);
assert.match(
  repeatReviewMigration,
  /create trigger question_reviews_prevent_repeat_lecturer_update\s+before update on public\.question_reviews/i,
);
assert.match(
  repeatReviewMigration,
  /create trigger answer_reviews_prevent_repeat_lecturer_update\s+before update on public\.answer_reviews/i,
);
assert.doesNotMatch(repeatReviewMigration, /\bgrant\b[\s\S]*?\banon\b/i);
assert.doesNotMatch(repeatReviewMigration, /alter table|unique\s*\(/i);
for (const rpc of [
  "save_question_review_v3",
  "save_answer_review_v3",
  "delete_question_review_v3",
  "delete_answer_review_v3",
]) {
  assert.match(repository, new RegExp(`supabase\\.rpc\\("${rpc}"`));
}
assert.doesNotMatch(
  repository,
  /\.from\("(?:question_reviews|answer_reviews)"\)[\s\S]{0,200}\.(?:insert|update|upsert|delete)\(/,
);

console.log("Review question filter self-check passed.");
