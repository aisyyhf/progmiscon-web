import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveQuestionWordingRevision } from "../src/utils/reviewWorkspace.ts";

const migration = await readFile(
  new URL(
    "../supabase/migrations/20260821011940_admin_question_wording_revisions.sql",
    import.meta.url,
  ),
  "utf8",
);
const adminRepository = await readFile(
  new URL("../src/services/adminOverrideRepository.ts", import.meta.url),
  "utf8",
);
const reviewRepository = await readFile(
  new URL("../src/services/reviewPersistenceRepository.ts", import.meta.url),
  "utf8",
);
const app = await readFile(
  new URL("../src/app/App.tsx", import.meta.url),
  "utf8",
);
const adminQuestions = await readFile(
  new URL("../src/pages/AdminQuestionsPage.tsx", import.meta.url),
  "utf8",
);

const saveFunction = migration.match(
  /create or replace function public\.save_question_wording_revision_v1[\s\S]*?(?=\ncreate or replace function public\.get_question_wording_revisions)/i,
)?.[0];
assert.ok(saveFunction, "wording revision save function was not found");

assert.match(migration, /create table public\.question_wording_revisions/i);
assert.match(
  migration,
  /primary key\s*\(\s*question_id\s*,\s*source_version\s*\)/i,
);
assert.match(migration, /revision_origin in \('captured_pre_edit', 'admin_edit'\)/i);
assert.match(migration, /before update or delete on public\.question_wording_revisions/i);
assert.match(migration, /QUESTION_WORDING_REVISION_IMMUTABLE/);
assert.match(saveFunction, /security definer/i);
assert.match(saveFunction, /set search_path\s*=\s*''/i);
assert.match(saveFunction, /public\.current_user_is_admin\(\)/i);
assert.match(saveFunction, /profile\.active\s*=\s*true/i);
assert.match(saveFunction, /input_expected_source_version uuid/i);
assert.match(saveFunction, /for update/i);
assert.match(saveFunction, /input_expected_source_version is null/i);
assert.match(
  saveFunction,
  /input_expected_source_version is distinct from current_source_version/i,
);
assert.match(saveFunction, /DATA_VERSION_CHANGED/);
assert.match(saveFunction, /public\.answer_misconception_baselines/i);
assert.match(saveFunction, /MP_WORDING_EDIT_NOT_SUPPORTED/);
assert.match(saveFunction, /'captured_pre_edit'/);
assert.match(saveFunction, /on conflict \(question_id, source_version\) do nothing/i);
assert.match(saveFunction, /insert into public\.question_content_overrides/i);
assert.match(saveFunction, /set source_version = next_source_version/i);
assert.match(saveFunction, /pg_catalog\.gen_random_uuid\(\)/i);
assert.match(saveFunction, /update public\.question_reviews/i);
assert.match(saveFunction, /is_active = false/i);
assert.match(saveFunction, /inactive_reason = 'source_updated'/i);
assert.match(saveFunction, /delete from public\.question_misconception_overrides/i);
assert.match(saveFunction, /'admin_edit'/);
assert.doesNotMatch(saveFunction, /delete from public\.question_reviews/i);
assert.doesNotMatch(saveFunction, /answer_content_overrides|options_json|correct_option/i);
assert.doesNotMatch(saveFunction, /question_code/i);
assert.doesNotMatch(saveFunction, /set\s+misconception_ids|source_fingerprint\s*=/i);
assert.doesNotMatch(saveFunction, /set\s+question_id\s*=/i);
assert.ok(
  saveFunction.indexOf("'master_relation_baselines'") <
    saveFunction.indexOf("'question_review:'"),
  "baseline synchronization lock must be acquired before the target Review lock",
);
assert.ok(
  saveFunction.toLowerCase().indexOf("for update") <
    saveFunction.indexOf("DATA_VERSION_CHANGED"),
  "the baseline row must be locked before the expected version is checked",
);
assert.ok(
  saveFunction.indexOf("DATA_VERSION_CHANGED") <
    saveFunction.toLowerCase().indexOf("insert into public.question_wording_revisions"),
  "no snapshot or write may occur before the expected version is accepted",
);

for (const [countFunction, expectedReturnColumns] of [
  [
    "get_question_review_counts",
    ["question_id text", "review_count integer", "latest_updated_at timestamptz"],
  ],
  [
    "get_answer_review_counts",
    ["answer_id text", "review_count integer", "latest_updated_at timestamptz"],
  ],
  [
    "get_my_review_status",
    [
      "question_ids text[]",
      "answer_ids text[]",
      "question_review_count integer",
      "answer_review_count integer",
      "latest_updated_at timestamptz",
    ],
  ],
]) {
  const definition = migration.match(
    new RegExp(
      `create or replace function public\\.${countFunction}\\s*\\([\\s\\S]*?(?=\\n(?:create or replace function|revoke all on function))`,
      "i",
    ),
  )?.[0];
  assert.ok(definition, `${countFunction} was not found`);
  assert.match(definition, /review\.is_active\s*=\s*true/i);
  assert.match(definition, /baseline\.source_version\s*=\s*review\.source_version/i);
  const returnedColumns = definition
    .match(/returns table\s*\(([\s\S]*?)\)\s*language sql/i)?.[1]
    .split(",")
    .map((column) => column.replace(/\s+/g, " ").trim());
  assert.deepEqual(returnedColumns, expectedReturnColumns);
}

assert.match(
  migration,
  /revoke all on function public\.save_question_content_override\([\s\S]*?authenticated/i,
);
assert.match(
  migration,
  /revoke all on function public\.save_answer_content_override\([\s\S]*?authenticated/i,
);
assert.match(
  migration,
  /revoke all on function public\.reset_question_content_override\([\s\S]*?authenticated/i,
);
assert.match(
  migration,
  /revoke all on function public\.reset_answer_content_override\([\s\S]*?authenticated/i,
);
assert.match(migration, /create or replace function public\.get_question_wording_revisions/i);
assert.match(migration, /input_question_ids text\[\]/i);
assert.match(migration, /profile\.active\s*=\s*true/i);
assert.match(
  migration,
  /grant execute on function public\.get_question_wording_revisions\(text\[\]\)[\s\S]*?to authenticated/i,
);

const saveWrapper = adminRepository.match(
  /export async function saveQuestionWordingRevision[\s\S]*?(?=\nexport async function)/,
)?.[0];
assert.ok(saveWrapper, "typed wording revision wrapper was not found");
assert.match(saveWrapper, /\.rpc\(\s*"save_question_wording_revision_v1"/);
assert.match(saveWrapper, /input_expected_source_version/);
assert.match(saveWrapper, /invalidateEffectiveMasterData\(\)/);
assert.doesNotMatch(saveWrapper, /\.from\(|answer|options_json|correct_option/i);
assert.match(
  reviewRepository,
  /export async function getQuestionWordingRevisions[\s\S]*?\.rpc\(\s*"get_question_wording_revisions"/,
);

assert.doesNotMatch(app, /AdminQuestionEditPage|admin\/questions\/:.*edit/i);
assert.doesNotMatch(adminQuestions, /saveQuestionWordingRevision|AdminQuestionContentEditor/);
assert.doesNotMatch(adminQuestions, />\s*(?:Edit|Sunting)\s*</i);

const currentQuestion = {
  id: "Q-PS-1",
  prompt: { id: "Wording saat ini", en: "Current wording" },
};
const revisions = [
  {
    questionId: "Q-PS-1",
    sourceVersion: "old-version",
    questionInd: "Wording lama",
    questionEn: "Old wording",
    revisionOrigin: "captured_pre_edit",
    capturedAt: "2026-08-21T00:00:00Z",
  },
];
assert.deepEqual(
  resolveQuestionWordingRevision(
    currentQuestion,
    "Q-PS-1",
    "old-version",
    revisions,
  ),
  { id: "Wording lama", en: "Old wording" },
);
assert.deepEqual(
  resolveQuestionWordingRevision(
    currentQuestion,
    "Q-PS-1",
    "unedited-version",
    revisions,
  ),
  currentQuestion.prompt,
);

console.log("Question wording revision foundation checks passed.");
