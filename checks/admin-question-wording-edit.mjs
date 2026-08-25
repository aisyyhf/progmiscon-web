import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyPublishedMasterOverrides,
  replaceSingleTextContentBlock,
} from "../src/utils/effectiveMasterData.ts";
import { resolveQuestionWordingForReview } from "../src/utils/reviewWorkspace.ts";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [
  migration,
  handler,
  edge,
  authority,
  googleAuthority,
  runtimeManifest,
  editor,
  questionsPage,
  repository,
  supabaseConfig,
  denoConfig,
  edgeReadme,
  gitignore,
] =
  await Promise.all([
    read("../supabase/migrations/20260824000000_admin_question_wording_edit_phase_2a.sql"),
    read("../supabase/functions/admin-question-wording/handler.ts"),
    read("../supabase/functions/admin-question-wording/index.ts"),
    read("../supabase/functions/_shared/questionAuthority.ts"),
    read("../supabase/functions/_shared/googleQuestionAuthority.ts"),
    read("../supabase/functions/_shared/questionAuthorityManifest.ts"),
    read("../src/components/admin/AdminQuestionWordingEditor.tsx"),
    read("../src/pages/AdminQuestionsPage.tsx"),
    read("../src/services/adminOverrideRepository.ts"),
    read("../supabase/config.toml"),
    read("../supabase/functions/admin-question-wording/deno.json"),
    read("../supabase/functions/admin-question-wording/README.md"),
    read("../.gitignore"),
  ]);

assert.doesNotMatch(migration, /question_wording_edit_targets/i);
assert.doesNotMatch(migration, /\('Q\d{3}',/);
assert.doesNotMatch(migration, /\bmd5\s*\(/i);
assert.doesNotMatch(migration, /public\.save_question_wording_override_v1/i);
assert.match(migration, /content_version uuid/i);
assert.match(migration, /rotate_question_content_version/i);
assert.match(migration, /admin_question_wording_actor_is_authorized_v1/i);
assert.match(migration, /admin_save_question_wording_override_v1/i);
assert.match(migration, /pg_advisory_xact_lock/i);
assert.match(migration, /for update/i);
assert.match(migration, /QUESTION_OVERRIDE_STALE/);
assert.match(migration, /QUESTION_WORDING_UNCHANGED/);
assert.match(migration, /input_trusted_question_ind text/i);
assert.match(migration, /input_trusted_question_en text/i);
assert.match(
  migration,
  /case when current_exists then current_override\.question_ind else normalized_trusted_question_ind end/i,
);
assert.match(
  migration,
  /case when current_exists then current_override\.question_en else normalized_trusted_question_en end/i,
);
assert.match(migration, /question_wording_revisions_immutable/i);
assert.match(migration, /These rows are not Review snapshots/i);
assert.match(
  migration,
  /grant execute on function public\.admin_save_question_wording_override_v1\([\s\S]*?\) to service_role/i,
);
assert.doesNotMatch(
  migration,
  /grant execute on function public\.admin_save_question_wording_override_v1\([\s\S]*?\) to authenticated/i,
);
assert.match(
  migration,
  /revoke execute on function public\.save_question_content_override\([\s\S]*?authenticated/i,
);
assert.match(
  migration,
  /revoke execute on function public\.reset_question_content_override\(text\)[\s\S]*?authenticated/i,
);
assert.doesNotMatch(
  migration,
  /create or replace function public\.(?:save|delete)_(?:question|answer)_review_v3/i,
);

assert.match(authority, /QUESTION_AUTHORITY_HEADERS/);
assert.match(authority, /crypto\.subtle\.digest\("SHA-256"/);
assert.match(authority, /MALFORMED_STRUCTURAL_JSON/);
assert.match(authority, /DuplicateJsonKeyError/);
assert.match(authority, /DUPLICATE_QUESTION_ID/);
assert.match(authority, /rawSingleText/);
assert.match(googleAuthority, /grid\.columnCount !== 37/);
assert.doesNotMatch(googleAuthority, /grid\.columnCount < 37/);
assert.match(runtimeManifest, /REVIEWED_QUESTION_SOURCE/);
assert.match(runtimeManifest, /REVIEWED_QUESTION_IDS/);
assert.doesNotMatch(runtimeManifest, /question_ind|question_en|question_type|editable/i);

assert.match(edge, /GOOGLE_SERVICE_ACCOUNT_JSON/);
assert.match(edge, /PROGMISCON_GOOGLE_SPREADSHEET_ID/);
assert.match(edge, /PROGMISCON_GOOGLE_QUESTIONS_SHEET_ID/);
assert.match(edge, /SUPABASE_SERVICE_ROLE_KEY/);
assert.match(edge, /input_trusted_question_ind: input\.trustedQuestionInd/);
assert.match(edge, /input_trusted_question_en: input\.trustedQuestionEn/);
assert.match(edge, /readTrustedGoogleQuestionAuthority/);
assert.match(edge, /readGoogleDriveVersion/);
assert.match(edge, /admin_save_question_wording_override_v1/);
assert.doesNotMatch(edge, /console\.(?:log|error)|private_key.*(?:return|console)/i);
assert.match(handler, /SOURCE_CHANGED_RELOAD_REQUIRED/);
assert.match(handler, /trustedQuestionInd: target\.values\.question_ind/);
assert.match(handler, /trustedQuestionEn: target\.values\.question_en/);
assert.match(handler, /expectedAuthoritySha256/);
assert.match(handler, /expectedOverrideVersion/);
assert.match(handler, /finalVersion !== authority\.driveVersion/);
assert.match(handler, /QUESTION_NOT_REVIEWED/);
assert.match(handler, /ORIGIN_NOT_ALLOWED/);
assert.match(handler, /UNEXPECTED_ERROR/);
assert.doesNotMatch(
  handler.match(/const expectedKeys = action === "load"[\s\S]*?if \(!exactKeys/)?.[0] ?? "",
  /trustedQuestion(?:Ind|En)/,
  "browser request contract cannot include trusted previous wording",
);

assert.match(supabaseConfig, /\[functions\.admin-question-wording\][\s\S]*verify_jwt = true/);
assert.match(denoConfig, /npm:@supabase\/supabase-js@2\.110\.5/);
for (const name of [
  "PROGMISCON_ALLOWED_ORIGIN",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "PROGMISCON_GOOGLE_SPREADSHEET_ID",
  "PROGMISCON_GOOGLE_QUESTIONS_SHEET_ID",
  "GOOGLE_SERVICE_ACCOUNT_JSON",
]) assert.match(edgeReadme, new RegExp(name));
assert.doesNotMatch(edgeReadme, /BEGIN (?:RSA )?PRIVATE KEY|eyJ[A-Za-z0-9_-]+\./);
assert.match(gitignore, /^supabase\/\.temp\/$/m);

assert.match(repository, /supabase\.functions\.invoke\(\s*"admin-question-wording"/);
assert.doesNotMatch(repository, /trustedQuestion(?:Ind|En)/);
assert.doesNotMatch(repository, /["']save_question_wording_override_v1["']/);
assert.doesNotMatch(repository, /get_admin_question_wording_edit_targets/);
assert.match(editor, /loadQuestionWordingAuthority/);
assert.match(editor, /authority\.editable/);
assert.doesNotMatch(editor, /hasSingleTextBlock|question\.type === "short_answer"/);
assert.match(editor, /expectedAuthoritySha256: authority\.authoritySha256/);
assert.match(editor, /expectedOverrideVersion: authority\.overrideVersion/);
assert.match(editor, /!questionInd\.trim\(\) \|\| !questionEn\.trim\(\)/);
assert.match(editor, /disabled=\{saving/);
assert.match(editor, /Draft tetap disimpan di layar/);
assert.match(questionsPage, /AdminQuestionWordingEditor/);
assert.doesNotMatch(questionsPage, /getAdminQuestionWordingEditTargets/);

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx)$/.test(entry.name)) files.push(path);
  }
  return files;
}
const sourceRoot = fileURLToPath(new URL("../src", import.meta.url));
const allSource = (await Promise.all(
  (await sourceFiles(sourceRoot)).map((path) => readFile(path, "utf8")),
)).join("\n");
assert.equal(
  allSource.match(/AdminQuestionContentEditor/g)?.length,
  1,
  "legacy generic question editor is declared but never mounted or imported",
);
assert.doesNotMatch(
  allSource,
  /from\s+["'][^"']*AdminContentEditor["']/,
  "legacy generic content editor has no live import",
);
assert.doesNotMatch(
  allSource,
  /\.from\(["']question_content_overrides["']\)[\s\S]{0,300}?\.(?:insert|update|upsert|delete)\(/,
  "frontend must not directly mutate question overrides",
);

const simple = JSON.stringify([{ type: "text", content: "Old wording" }]);
const structured = JSON.stringify([
  { type: "text", content: "Old wording" },
  { type: "code", content: "print(1)" },
]);
assert.equal(
  replaceSingleTextContentBlock(simple, "New wording"),
  JSON.stringify([{ type: "text", content: "New wording" }]),
);
assert.equal(
  replaceSingleTextContentBlock(structured, "New wording"),
  structured,
  "structured content must never be flattened",
);

const effective = applyPublishedMasterOverrides(
  {
    topics: [],
    questions: [{
      question_id: "Q001",
      question_ind: "Old ID",
      question_en: "Old EN",
      question_code: "print('keep me')",
      content_blocks_ind: simple,
      content_blocks_en: structured,
      active: "TRUE",
    }],
    answers: [],
    misconceptions: [],
    questionMisconceptions: [],
    answerMisconceptions: [],
  },
  {
    questionContentOverrides: [{
      question_id: "Q001",
      question_ind: "New ID",
      question_en: "New EN",
      question_code: null,
      updated_at: "2026-08-25T10:00:00Z",
    }],
    answerContentOverrides: [],
    questionMisconceptionOverrides: [],
    answerMisconceptionOverrides: [],
  },
);
assert.equal(effective.questions[0].question_ind, "New ID");
assert.equal(effective.questions[0].question_en, "New EN");
assert.equal(effective.questions[0].question_code, "print('keep me')");
assert.equal(effective.questions[0].content_blocks_ind, JSON.stringify([
  { type: "text", content: "New ID" },
]));
assert.equal(effective.questions[0].content_blocks_en, structured);

assert.equal(
  resolveQuestionWordingForReview(
    {
      id: "Q001",
      prompt: { id: "Current wording", en: "Current wording" },
      contentUpdatedAt: "2026-08-25T10:00:00Z",
    },
    {
      questionId: "Q001",
      reviewUpdatedAt: "2026-08-25T11:00:00Z",
      reviewSourceVersion: "current-version",
      currentSourceVersion: "current-version",
    },
  ),
  undefined,
  "an edited wording is not fabricated as a Review snapshot",
);
assert.deepEqual(
  resolveQuestionWordingForReview(
    { id: "Q002", prompt: { id: "Unedited", en: "Unedited" } },
    {
      questionId: "Q002",
      reviewUpdatedAt: "2026-08-25T11:00:00Z",
      reviewSourceVersion: "current-version",
      currentSourceVersion: "current-version",
    },
  ),
  { id: "Unedited", en: "Unedited" },
);

console.log("Admin question wording edit corrected Phase 2A checks passed");
