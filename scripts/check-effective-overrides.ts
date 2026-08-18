import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import {
  applyPublishedMasterOverrides,
  buildConsensusSnapshot,
  buildMisconceptionQuestionBackReferences,
  normalizeEffectiveIds,
} from "../src/utils/effectiveMasterData.ts";
import { createInvalidatablePromiseCache } from "../src/utils/invalidatablePromiseCache.ts";
import {
  buildAnswerReviewValues,
  buildQuestionReviewValues,
  getAdditionalMisconceptionCandidates,
  initialMisconceptionReviewFormState,
  misconceptionReviewFormReducer,
} from "../src/utils/reviewMisconceptionForm.ts";
import { buildQuestionOptions } from "../src/utils/questionMetadata.ts";
import type { MasterData, PublishedMasterOverrides } from "../src/types/index.ts";

const baseline: MasterData = {
  topics: [],
  misconceptions: [
    {
      misconception_id: "EX-01",
      topic_id: "T1",
      title_ind: "",
      title_en: "",
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
      misconception_id: "IO-02",
      topic_id: "T1",
      title_ind: "",
      title_en: "",
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
    {
      misconception_id: "SQ-03",
      topic_id: "T1",
      title_ind: "",
      title_en: "",
      description_ind: "",
      description_en: "",
      wrong_example: "",
      correct_example: "",
      correction_ind: "",
      correction_en: "",
      common_cause_ind: "",
      common_cause_en: "",
      order_no: "3",
      active: "TRUE",
    },
  ],
  questions: [
    {
      question_id: "Q022",
      question_type: "MP",
      title_ind: "Judul",
      title_en: "Title",
      question_ind: "Soal baseline",
      question_en: "Baseline question",
      question_code: "PRINT 1",
      reference_solution: "",
      expected_output: "",
      week: "2",
      source_no: "22",
      order_no: "22",
      active: "TRUE",
      data_status: "active",
      source_system: "sheet",
    },
    {
      question_id: "Q023",
      question_type: "PS",
      title_ind: "Tetap",
      title_en: "Unchanged",
      question_ind: "Tanpa override",
      question_en: "No override",
      question_code: "",
      reference_solution: "",
      expected_output: "",
      week: "3",
      source_no: "23",
      order_no: "23",
      active: "TRUE",
      data_status: "active",
      source_system: "sheet",
    },
  ],
  questionTopics: [],
  questionMisconceptions: [
    {
      question_id: "Q022",
      misconception_id: "EX-01",
      source: "sheet",
      active: "TRUE",
    },
    {
      question_id: "Q022",
      misconception_id: "IO-02",
      source: "sheet",
      active: "TRUE",
    },
    {
      question_id: "Q023",
      misconception_id: "EX-01",
      source: "sheet",
      active: "TRUE",
    },
  ],
  answers: [
    {
      answer_id: "A022-A",
      question_id: "Q022",
      answer_text: "Opsi baseline",
      answer_role: "mp_option",
      status: "incorrect",
      explanation_ind: "",
      explanation_en: "",
      order_no: "1",
      active: "TRUE",
      source_system: "sheet",
    },
  ],
  answerMisconceptions: [
    {
      answer_id: "A022-A",
      misconception_id: "EX-01",
      reason_ind: "baseline",
      reason_en: "baseline",
      active: "TRUE",
    },
  ],
  similarMisconceptions: [],
};

const overrides: PublishedMasterOverrides = {
  questionContentOverrides: [
    {
      question_id: "Q022",
      question_ind: "Soal efektif",
      question_en: "",
      question_code: "PRINT 2",
      updated_at: "2026-07-28T00:00:00Z",
    },
  ],
  answerContentOverrides: [
    {
      answer_id: "A022-A",
      answer_text: "Opsi efektif",
      updated_at: "2026-07-28T00:00:00Z",
    },
  ],
  questionMisconceptionOverrides: [
    {
      question_id: "Q022",
      misconception_ids: [" SQ-03 ", "IO-02", "SQ-03", ""],
      published_at: "2026-07-28T00:00:00Z",
      updated_at: "2026-07-28T00:00:00Z",
    },
  ],
  answerMisconceptionOverrides: [
    {
      answer_id: "A022-A",
      question_id: "Q022",
      misconception_ids: ["SQ-03", "SQ-03"],
      published_at: "2026-07-28T00:00:00Z",
      updated_at: "2026-07-28T00:00:00Z",
    },
  ],
};

assert.deepEqual(
  buildConsensusSnapshot(
    ["EX-01", "IO-02"],
    { "EX-01": 2, "IO-02": 1 },
    { "SQ-03": 2, "NO-04": 1 },
  ),
  ["IO-02", "SQ-03"],
  "majority 2/3 must apply while 1/3 must not",
);
assert.deepEqual(
  normalizeEffectiveIds(["SQ-03", "", " IO-02 ", "SQ-03"]),
  ["IO-02", "SQ-03"],
  "IDs must be trimmed, deduplicated, blank-free, and deterministic",
);

const effective = applyPublishedMasterOverrides(baseline, overrides);
const effectiveQuestion = effective.questions.find(
  (row) => row.question_id === "Q022",
)!;
assert.equal(effectiveQuestion.question_ind, "Soal efektif");
assert.equal(
  effectiveQuestion.question_en,
  "",
  "an intentionally empty field must not fall back to baseline content",
);
assert.equal(effectiveQuestion.question_code, "PRINT 2");
assert.equal(effectiveQuestion.week, "2");
assert.equal(effectiveQuestion.source_system, "sheet");
assert.equal(
  effective.questions.find((row) => row.question_id === "Q023")?.question_ind,
  "Tanpa override",
);
assert.equal(effective.answers[0].answer_text, "Opsi efektif");
assert.equal(effective.answers[0].status, "incorrect");
assert.deepEqual(
  effective.questionMisconceptions
    .filter((row) => row.question_id === "Q022")
    .map((row) => row.misconception_id),
  ["IO-02", "SQ-03"],
  "relation override must replace the baseline snapshot",
);
assert.deepEqual(
  effective.questionMisconceptions
    .filter((row) => row.question_id === "Q023")
    .map((row) => row.misconception_id),
  ["EX-01"],
  "targets without overrides must keep baseline relations",
);

const inactiveRelationEffective = applyPublishedMasterOverrides(
  {
    ...baseline,
    questionMisconceptions: baseline.questionMisconceptions.map((row) =>
      row.question_id === "Q022" && row.misconception_id === "EX-01"
        ? { ...row, active: "FALSE" }
        : row,
    ),
    answerMisconceptions: baseline.answerMisconceptions.map((row) => ({
      ...row,
      active: "FALSE",
      reason_ind: "Alasan lama",
      reason_en: "Existing reason",
    })),
  },
  {
    questionContentOverrides: [],
    answerContentOverrides: [],
    questionMisconceptionOverrides: [
      {
        question_id: " Q022 ",
        misconception_ids: [" EX-01 "],
        published_at: "2026-07-28T00:00:00Z",
        updated_at: "2026-07-28T00:00:00Z",
      },
    ],
    answerMisconceptionOverrides: [
      {
        answer_id: " A022-A ",
        question_id: "Q022",
        misconception_ids: [" EX-01 "],
        published_at: "2026-07-28T00:00:00Z",
        updated_at: "2026-07-28T00:00:00Z",
      },
    ],
  },
);
assert.deepEqual(
  inactiveRelationEffective.questionMisconceptions.find(
    (row) =>
      row.question_id === "Q022" && row.misconception_id === "EX-01",
  ),
  {
    question_id: "Q022",
    misconception_id: "EX-01",
    source: "published_override",
    active: "TRUE",
  },
  "a published question relation must be active even when its baseline row was inactive",
);
assert.deepEqual(
  inactiveRelationEffective.answerMisconceptions.find(
    (row) =>
      row.answer_id === "A022-A" && row.misconception_id === "EX-01",
  ),
  {
    answer_id: "A022-A",
    misconception_id: "EX-01",
    reason_ind: "Alasan lama",
    reason_en: "Existing reason",
    active: "TRUE",
  },
  "a published answer relation must be active while preserving existing reasons",
);

const backReferences = buildMisconceptionQuestionBackReferences(effective);
assert.deepEqual(backReferences.get("SQ-03"), ["Q022"]);
assert.deepEqual(backReferences.get("EX-01"), ["Q023"]);

const optionRelations = new Map([
  [
    "A022-A",
    effective.answerMisconceptions
      .filter((row) => row.answer_id === "A022-A")
      .map((row) => row.misconception_id),
  ],
]);
const options = buildQuestionOptions(effective.answers, optionRelations);
assert.equal(options[0].text.id, "Opsi efektif");
assert.deepEqual(options[0].misconceptionIds, ["SQ-03"]);
assert.equal(options[0].misconceptionId, "SQ-03");
const multiRelationOptions = buildQuestionOptions(
  effective.answers,
  new Map([["A022-A", ["SQ-03", "EX-01", "IO-02"]]]),
);
assert.deepEqual(
  multiRelationOptions[0].misconceptionIds,
  ["EX-01", "IO-02", "SQ-03"],
  "all option relations must be preserved",
);
assert.equal(
  multiRelationOptions[0].misconceptionId,
  undefined,
  "legacy singular relation is only valid for exactly one ID",
);

const emptyQuestionSnapshot = applyPublishedMasterOverrides(baseline, {
  ...overrides,
  questionMisconceptionOverrides: [
    {
      question_id: "Q022",
      misconception_ids: [],
      published_at: "2026-07-28T00:00:00Z",
      updated_at: "2026-07-28T00:00:00Z",
    },
  ],
  answerMisconceptionOverrides: [
    {
      answer_id: "A022-A",
      question_id: "Q022",
      misconception_ids: [],
      published_at: "2026-07-28T00:00:00Z",
      updated_at: "2026-07-28T00:00:00Z",
    },
  ],
});
assert.deepEqual(
  emptyQuestionSnapshot.questionMisconceptions.filter(
    (row) => row.question_id === "Q022",
  ),
  [],
  "an empty published snapshot must not fall back to baseline relations",
);
assert.deepEqual(
  emptyQuestionSnapshot.answerMisconceptions.filter(
    (row) => row.answer_id === "A022-A",
  ),
  [],
  "an empty answer snapshot must not fall back to baseline relations",
);

let form = misconceptionReviewFormReducer(
  initialMisconceptionReviewFormState,
  { type: "set_presence", field: "addition", value: true },
);
form = misconceptionReviewFormReducer(form, {
  type: "set_ids",
  field: "addition",
  ids: ["SQ-03"],
});
form = misconceptionReviewFormReducer(form, {
  type: "set_reason",
  field: "addition",
  value: "Perlu ditambahkan",
});
form = misconceptionReviewFormReducer(form, {
  type: "set_presence",
  field: "removal",
  value: true,
});
form = misconceptionReviewFormReducer(form, {
  type: "set_ids",
  field: "removal",
  ids: ["EX-01"],
});
form = misconceptionReviewFormReducer(form, {
  type: "set_reason",
  field: "removal",
  value: "Tidak sesuai",
});
assert.deepEqual(form.additionalMisconceptionIds, ["SQ-03"]);
assert.deepEqual(form.removedMisconceptionIds, ["EX-01"]);
assert.deepEqual(
  getAdditionalMisconceptionCandidates(
    [{ id: "EX-01" }, { id: "SQ-03" }],
    ["EX-01"],
  ),
  [{ id: "SQ-03" }],
);
assert.deepEqual(buildQuestionReviewValues(form), {
  hasIncorrectMisconceptions: true,
  removedMisconceptionIds: ["EX-01"],
  removalReason: "Tidak sesuai",
  hasAdditionalMisconceptions: true,
  additionalMisconceptionIds: ["SQ-03"],
  additionReason: "Perlu ditambahkan",
  note: null,
});
assert.deepEqual(buildAnswerReviewValues(form), {
  hasMismatchedMisconceptions: true,
  removedMisconceptionIds: ["EX-01"],
  removalReason: "Tidak sesuai",
  hasAdditionalMisconceptions: true,
  additionalMisconceptionIds: ["SQ-03"],
  additionReason: "Perlu ditambahkan",
  note: null,
});
form = misconceptionReviewFormReducer(form, {
  type: "set_presence",
  field: "addition",
  value: false,
});
assert.deepEqual(form.additionalMisconceptionIds, []);
assert.equal(form.additionReason, "");
assert.deepEqual(form.removedMisconceptionIds, ["EX-01"]);

let loads = 0;
const cache = createInvalidatablePromiseCache(async () => ++loads);
assert.equal(await cache.get(), 1);
assert.equal(await cache.get(), 1);
cache.invalidate();
assert.equal(await cache.get(), 2, "invalidated cache must not retain old data");

let retryLoads = 0;
const retryCache = createInvalidatablePromiseCache(async () => {
  retryLoads += 1;
  if (retryLoads === 1) throw new Error("temporary failure");
  return retryLoads;
});
await assert.rejects(retryCache.get(), /temporary failure/);
assert.equal(
  await retryCache.get(),
  2,
  "a rejected load must be evicted so the next get can recover",
);

let rejectOldLoad: ((reason?: unknown) => void) | undefined;
let resolveFreshLoad: ((value: number) => void) | undefined;
let concurrentLoads = 0;
const generationCache = createInvalidatablePromiseCache(() => {
  concurrentLoads += 1;
  return new Promise<number>((resolve, reject) => {
    if (concurrentLoads === 1) rejectOldLoad = reject;
    else resolveFreshLoad = resolve;
  });
});
const oldLoad = generationCache.get();
generationCache.invalidate();
const freshLoad = generationCache.get();
rejectOldLoad?.(new Error("stale failure"));
await assert.rejects(oldLoad, /stale failure/);
resolveFreshLoad?.(42);
assert.equal(await freshLoad, 42);
assert.equal(
  await generationCache.get(),
  42,
  "an old rejection must not clear a newer in-flight cache generation",
);

const migration = readFileSync(
  "supabase/migrations/20260728_003_effective_content_overrides.sql",
  "utf8",
);
const baselineMigration = readFileSync(
  "supabase/migrations/20260728_004_fix_baseline_sync_safe_delete.sql",
  "utf8",
);
const upsertMigration = readFileSync(
  "supabase/migrations/20260729_005_fix_override_upsert_conflicts.sql",
  "utf8",
);
const sqlFunction = (source: string, name: string): string => {
  const start = source.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1, `${name} function is missing`);
  const end = source.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `${name} function body is incomplete`);
  return source.slice(start, end + 4).replace(/\r\n/g, "\n");
};
const unsafeBaselineDelete =
  /delete from public\.(?:question_misconception_baselines|answer_misconception_baselines|master_misconception_catalog)\s*;/i;
assert.doesNotMatch(
  migration,
  unsafeBaselineDelete,
  "migration 003 baseline deletes must include an explicit WHERE clause",
);
assert.doesNotMatch(
  baselineMigration,
  unsafeBaselineDelete,
  "migration 004 baseline deletes must include an explicit WHERE clause",
);
for (const table of [
  "question_misconception_baselines",
  "answer_misconception_baselines",
  "master_misconception_catalog",
]) {
  assert.match(
    baselineMigration,
    new RegExp(`delete from public\\.${table} where true;`, "i"),
  );
}
assert.match(
  baselineMigration,
  /create or replace function public\.sync_master_relation_baselines\(/,
);
assert.doesNotMatch(baselineMigration, /drop\s+table/i);
assert.match(
  baselineMigration,
  /security definer\s+set search_path = ''/i,
);
assert.match(
  baselineMigration,
  /revoke all on function public\.sync_master_relation_baselines\(jsonb, jsonb, text\[\]\)\s+from public, anon, service_role;/i,
);
assert.match(
  baselineMigration,
  /grant execute on function public\.sync_master_relation_baselines\(jsonb, jsonb, text\[\]\)\s+to authenticated;/i,
);
assert.doesNotMatch(
  baselineMigration,
  /grant execute on function public\.sync_master_relation_baselines[\s\S]{0,120}\bto\s+(?:anon|service_role|public)\b/i,
);
assert.equal(
  sqlFunction(baselineMigration, "sync_master_relation_baselines"),
  sqlFunction(migration, "sync_master_relation_baselines"),
  "migration 004 must preserve the complete sync function from migration 003",
);
const upsertFunctions = [
  {
    name: "publish_question_misconception_override",
    constraint: "question_misconception_overrides_pkey",
    signature: "text",
  },
  {
    name: "publish_answer_misconception_override",
    constraint: "answer_misconception_overrides_pkey",
    signature: "text",
  },
  {
    name: "save_question_content_override",
    constraint: "question_content_overrides_pkey",
    signature: "text, text, text, text",
  },
  {
    name: "save_answer_content_override",
    constraint: "answer_content_overrides_pkey",
    signature: "text, text",
  },
] as const;
assert.deepEqual(
  [
    ...upsertMigration.matchAll(
      /create or replace function public\.([a-z_]+)\(/g,
    ),
  ].map((match) => match[1]),
  upsertFunctions.map((item) => item.name),
  "migration 005 must replace exactly the four override upsert functions",
);
for (const item of upsertFunctions) {
  const freshInstallFunction = sqlFunction(migration, item.name);
  const hotfixFunction = sqlFunction(upsertMigration, item.name);
  assert.match(
    freshInstallFunction,
    new RegExp(`on conflict on constraint ${item.constraint} do update`, "i"),
  );
  assert.doesNotMatch(
    freshInstallFunction,
    /on conflict \((?:question_id|answer_id)\)/i,
  );
  assert.equal(
    hotfixFunction,
    freshInstallFunction,
    `migration 005 must preserve the complete ${item.name} body from migration 003`,
  );
  assert.match(hotfixFunction, /security definer\s+set search_path = ''/i);
  const escapedSignature = item.signature.replaceAll("[]", "\\[\\]");
  assert.match(
    upsertMigration,
    new RegExp(
      `revoke all on function public\\.${item.name}\\(${escapedSignature}\\)\\s+from public, anon, service_role;`,
      "i",
    ),
  );
  assert.match(
    upsertMigration,
    new RegExp(
      `grant execute on function public\\.${item.name}\\(${escapedSignature}\\)\\s+to authenticated;`,
      "i",
    ),
  );
}
assert.doesNotMatch(
  upsertMigration,
  /grant execute on function public\.[\s\S]{0,160}\bto\s+(?:anon|service_role|public)\b/i,
);
assert.doesNotMatch(upsertMigration, /drop\s+(?:function|table)/i);
assert.doesNotMatch(upsertMigration, /truncate/i);
assert.doesNotMatch(
  upsertMigration,
  /delete\s+from\s+public\.(?:question_reviews|answer_reviews)/i,
);
assert.match(migration, /set search_path = ''/);
assert.match(migration, /current_user_is_admin\(\)/);
assert.doesNotMatch(
  migration,
  /input_(?:published_by|source_review_count|review_count)/,
);
assert.match(
  migration,
  /count\(distinct review\.reviewer_id\)/i,
);
assert.match(migration, /question_reviews_enforce_cap/);
assert.match(migration, /answer_reviews_enforce_cap/);
assert.match(
  migration,
  /REVIEW_CAP_REACHED/,
);
assert.doesNotMatch(
  migration,
  /grant execute on function public\.publish_[^(]+\([^;]+ to anon/i,
);
assert.match(migration, /create table public\.question_misconception_baselines/);
assert.match(migration, /create table public\.answer_misconception_baselines/);
assert.match(migration, /create table public\.master_misconception_catalog/);
assert.match(
  migration,
  /revoke all on table public\.question_misconception_baselines from public, anon, authenticated, service_role/,
);
assert.match(
  migration,
  /revoke all on table public\.answer_misconception_baselines from public, anon, authenticated, service_role/,
);
assert.match(
  migration,
  /revoke all on table public\.master_misconception_catalog from public, anon, authenticated, service_role/,
);
assert.match(
  migration,
  /create or replace function public\.sync_master_relation_baselines\([\s\S]+security definer[\s\S]+set search_path = ''/,
);
assert.match(
  migration,
  /grant execute on function public\.sync_master_relation_baselines\(jsonb, jsonb, text\[\]\) to authenticated/,
);
assert.match(migration, /BASELINE_NOT_SYNCED/);
assert.match(migration, /INVALID_MISCONCEPTION_ID/);
assert.doesNotMatch(
  migration,
  /publish_question_misconception_override\(\s*input_question_id text\s*,/,
);
assert.doesNotMatch(
  migration,
  /publish_answer_misconception_override\(\s*input_answer_id text\s*,/,
);
const questionPublish = migration.slice(
  migration.indexOf(
    "create or replace function public.publish_question_misconception_override",
  ),
  migration.indexOf(
    "create or replace function public.publish_answer_misconception_override",
  ),
);
const answerPublish = migration.slice(
  migration.indexOf(
    "create or replace function public.publish_answer_misconception_override",
  ),
  migration.indexOf(
    "create or replace function public.save_question_content_override",
  ),
);
for (const [target, publishSource] of [
  ["question", questionPublish],
  ["answer", answerPublish],
] as const) {
  const catalogValidation = publishSource.slice(
    publishSource.indexOf("select added.id"),
    publishSource.indexOf("select public.normalize_text_id_array", publishSource.indexOf("select added.id")),
  );
  assert.match(
    catalogValidation,
    /from pg_catalog\.unnest\(added_ids\) as added\(id\)/,
    `${target} catalog validation must read majority additions`,
  );
  assert.match(
    catalogValidation,
    /from public\.master_misconception_catalog as catalog/,
  );
  assert.match(
    catalogValidation,
    /raise exception using message = 'INVALID_MISCONCEPTION_ID'/,
    `unknown ${target} additions must still be rejected`,
  );
  assert.doesNotMatch(
    catalogValidation,
    /removed_ids/,
    `stale ${target} removals must not be checked against the catalog`,
  );
  assert.match(
    publishSource,
    /where not \(baseline\.id = any\(removed_ids\)\)[\s\S]+select added\.id from pg_catalog\.unnest\(added_ids\)/,
    `${target} final snapshot must remain baseline minus removals plus additions`,
  );
}
assert.match(
  migration,
  /question_content_overrides_has_content[\s\S]+btrim\(coalesce\(question_ind, ''\)\)/,
);
const questionContentSave = migration.slice(
  migration.indexOf(
    "create or replace function public.save_question_content_override",
  ),
  migration.indexOf(
    "create or replace function public.save_answer_content_override",
  ),
);
assert.match(
  questionContentSave,
  /from public\.question_misconception_baselines as baseline[\s\S]+baseline\.question_id = normalized_question_id/,
  "arbitrary question IDs must be rejected unless their baseline target exists",
);
assert.match(
  questionContentSave,
  /raise exception using message = 'BASELINE_NOT_SYNCED'/,
);
assert.match(
  questionContentSave,
  /insert into public\.question_content_overrides/,
  "a valid synced question target must still be saved",
);
const answerContentSave = migration.slice(
  migration.indexOf(
    "create or replace function public.save_answer_content_override",
  ),
  migration.indexOf(
    "create or replace function public.reset_question_content_override",
  ),
);
assert.match(
  answerContentSave,
  /from public\.answer_misconception_baselines as baseline[\s\S]+baseline\.answer_id = normalized_answer_id/,
  "arbitrary answer IDs must be rejected unless their baseline target exists",
);
assert.match(
  answerContentSave,
  /raise exception using message = 'BASELINE_NOT_SYNCED'/,
);
assert.match(
  answerContentSave,
  /insert into public\.answer_content_overrides/,
  "a valid synced answer target must still be saved",
);
assert.match(
  migration,
  /revoke all on table public\.question_content_overrides from public, anon, authenticated, service_role/,
);
assert.match(
  migration,
  /revoke all on table public\.answer_content_overrides from public, anon, authenticated, service_role/,
);
const publicLoader = migration.slice(
  migration.indexOf(
    "create or replace function public.get_published_master_overrides",
  ),
  migration.indexOf(
    "revoke all on function public.normalize_text_id_array",
  ),
);
assert.doesNotMatch(
  publicLoader,
  /reviewer_(?:id|email)|removal_reason|addition_reason|review note/i,
);

for (const sourcePath of [
  "src/components/review/QuestionPanel.tsx",
  "src/components/review/AnswerCasePanel.tsx",
  "src/pages/LecturerReviewPage.tsx",
]) {
  const source = readFileSync(sourcePath, "utf8");
  assert.match(source, /getQuestionOptionMisconceptionIds/);
  assert.doesNotMatch(source, /option\??\.misconceptionId/);
}
const editorSource = readFileSync(
  "src/components/review/AdminContentEditor.tsx",
  "utf8",
);
assert.match(editorSource, /Minimal satu konten soal harus diisi\./);
assert.match(editorSource, /window\.confirm\("Kembalikan soal ke data asli\?"\)/);
assert.match(
  editorSource,
  /window\.confirm\("Kembalikan jawaban ke data asli\?"\)/,
);

const masterDataSource = readFileSync(
  "src/services/masterDataRepository.ts",
  "utf8",
);
assert.match(
  masterDataSource,
  /baselineMasterDataCache = createInvalidatablePromiseCache\(\s*loadBaselineMasterData/,
);
assert.doesNotMatch(masterDataSource, /baselineMasterDataPromise/);
assert.match(
  masterDataSource,
  /reloadBaselineMasterData\(\)[\s\S]+baselineMasterDataCache\.invalidate\(\)[\s\S]+invalidateEffectiveMasterData\(\)[\s\S]+baselineMasterDataCache\.get\(\)/,
);
const adminRepositorySource = readFileSync(
  "src/services/adminOverrideRepository.ts",
  "utf8",
);
assert.match(
  adminRepositorySource,
  /if \(error\) throw adminError\(scope, error\);\s+invalidateEffectiveMasterData\(\);/,
  "failed mutation RPCs must throw before effective cache invalidation",
);
assert.match(
  adminRepositorySource,
  /syncMasterRelationBaselines\(\): Promise<MasterBaselineSyncResult>[\s\S]+await reloadBaselineMasterData\(\)/,
);
assert.doesNotMatch(
  adminRepositorySource,
  /syncMasterRelationBaselines\(\s*masterData/,
);
const finalizationSource = readFileSync(
  "src/components/admin/AdminFinalizationPanel.tsx",
  "utf8",
);
assert.match(finalizationSource, /syncMasterRelationBaselines\(\)/);
assert.doesNotMatch(finalizationSource, /syncMasterRelationBaselines\(baseline\)/);

const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".sql",
  ".css",
  ".html",
]);
function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return sourceExtensions.has(extname(entry.name)) ? [path] : [];
  });
}
const scannedSourceFiles = [
  ...sourceFiles("src"),
  ...sourceFiles("scripts"),
  ...sourceFiles("checks"),
  "supabase/migrations/20260728_003_effective_content_overrides.sql",
  "supabase/migrations/20260728_004_fix_baseline_sync_safe_delete.sql",
  "supabase/migrations/20260729_005_fix_override_upsert_conflicts.sql",
];
const mojibake = /\u0393\u00c7|\u0393\u00e5|\u00c3|\u00c2|\u252c/u;
const manualMisconceptionLabel = [
  /\$\{misconception\.id\}[^`\n]*\$\{misconceptionLabel\(/,
  /<code>\{misconception\.id\}<\/code>[\s\S]{0,100}\{misconceptionLabel\(/,
  /\{misconception\.id\}\s*(?:-|:|\||\u2014)\s*\{misconceptionLabel\(/,
];
for (const sourcePath of scannedSourceFiles) {
  const source = readFileSync(sourcePath, "utf8");
  assert.doesNotMatch(source, mojibake, `mojibake found in ${sourcePath}`);
  for (const pattern of manualMisconceptionLabel) {
    assert.doesNotMatch(
      source,
      pattern,
      `manual misconception ID duplicates misconceptionLabel in ${sourcePath}`,
    );
  }
}

console.log("effective override checks passed");
