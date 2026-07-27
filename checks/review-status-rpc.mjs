import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mapReviewStatusRow } from "../src/utils/reviewStatus.ts";

const migrationUrl = new URL(
  "../supabase/migrations/20260727_001_review_status_rpc.sql",
  import.meta.url,
);
const repositoryUrl = new URL(
  "../src/services/reviewPersistenceRepository.ts",
  import.meta.url,
);

assert.deepEqual(
  mapReviewStatusRow({
    question_ids: [" Q-2 ", "Q-1", "Q-2", "", "   "],
    answer_ids: [" A-1 ", "A-1"],
    question_review_count: "2",
    answer_review_count: 1,
    latest_updated_at: "2026-07-27T12:00:00Z",
  }),
  {
    questionIds: ["Q-2", "Q-1"],
    answerIds: ["A-1"],
    questionReviewCount: 2,
    answerReviewCount: 1,
    latestUpdatedAt: "2026-07-27T12:00:00Z",
  },
);

assert.deepEqual(
  mapReviewStatusRow({
    question_ids: null,
    answer_ids: ["A-1", "A-2"],
    question_review_count: -1,
    answer_review_count: "invalid",
    latest_updated_at: null,
  }),
  {
    questionIds: [],
    answerIds: ["A-1", "A-2"],
    questionReviewCount: 0,
    answerReviewCount: 2,
    latestUpdatedAt: null,
  },
);

const emptyProgress = {
  questionIds: [],
  answerIds: [],
  questionReviewCount: 0,
  answerReviewCount: 0,
  latestUpdatedAt: null,
};
assert.deepEqual(mapReviewStatusRow(null), emptyProgress);
assert.deepEqual(mapReviewStatusRow({}), emptyProgress);

const migration = await readFile(migrationUrl, "utf8");
const repository = await readFile(repositoryUrl, "utf8");
const progressFunction = repository.match(
  /export async function getReviewProgress\(\)[\s\S]*?(?=\nexport async function)/,
)?.[0];

assert.ok(progressFunction, "getReviewProgress function was not found");
assert.match(
  migration,
  /create or replace function public\.get_my_review_status\s*\(\s*\)/i,
);
assert.match(migration, /security invoker/i);
assert.match(migration, /set search_path\s*=\s*''/i);
assert.match(
  migration,
  /from public\.question_reviews[\s\S]*?where reviewer_id\s*=\s*\(select auth\.uid\(\)\)/i,
);
assert.match(
  migration,
  /from public\.answer_reviews[\s\S]*?where reviewer_id\s*=\s*\(select auth\.uid\(\)\)/i,
);
assert.doesNotMatch(migration, /input_reviewer_id|reviewer\s+(uuid|text)/i);
assert.match(
  migration,
  /revoke all on function public\.get_my_review_status\(\) from public/i,
);
assert.match(
  migration,
  /revoke all on function public\.get_my_review_status\(\) from anon,\s*service_role/i,
);
assert.match(
  migration,
  /grant execute on function public\.get_my_review_status\(\) to authenticated/i,
);
assert.doesNotMatch(migration, /grant execute[\s\S]*?\bto anon\b/i);
assert.doesNotMatch(migration, /grant execute[\s\S]*?\bto service_role\b/i);
assert.match(progressFunction, /\.rpc\("get_my_review_status"\)/);
assert.doesNotMatch(progressFunction, /\.from\("question_reviews"\)/);
assert.doesNotMatch(progressFunction, /\.from\("answer_reviews"\)/);

console.log("Review status RPC self-check passed.");
