import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import {
  REVIEW_SESSION_EXPIRED_MESSAGE,
  REVIEW_SESSION_REFRESH_MARGIN_MS,
  ReviewSessionPreparationError,
  isReviewSessionAuthError,
  withPreparedReviewSession,
} from "../src/services/reviewSession.ts";
import {
  clearReviewSessionDraft,
  loadReviewSessionDraft,
  saveReviewSessionDraft,
} from "../src/utils/reviewSessionDraft.ts";

const now = 1_800_000_000_000;
const session = (expiresInMs) => ({
  expires_at: Math.floor((now + expiresInMs) / 1000),
  user: { id: "lecturer-1" },
});

function authClient({ current, refreshed, getError = null, refreshError = null }) {
  const calls = { get: 0, refresh: 0 };
  return {
    calls,
    client: {
      async getSession() {
        calls.get += 1;
        return { data: { session: current }, error: getError };
      },
      async refreshSession() {
        calls.refresh += 1;
        return { data: { session: refreshed }, error: refreshError };
      },
    },
  };
}

for (const targetType of ["question", "answer"]) {
  {
    const auth = authClient({
      current: session(REVIEW_SESSION_REFRESH_MARGIN_MS + 60_000),
      refreshed: null,
    });
    let writes = 0;
    const result = await withPreparedReviewSession(
      auth.client,
      async () => {
        writes += 1;
        return `${targetType}-saved`;
      },
      now,
    );

    assert.equal(result, `${targetType}-saved`);
    assert.deepEqual(auth.calls, { get: 1, refresh: 0 });
    assert.equal(writes, 1, `${targetType} fresh-session write runs once`);
  }

  {
    const auth = authClient({
      current: session(REVIEW_SESSION_REFRESH_MARGIN_MS),
      refreshed: session(3_600_000),
    });
    let writes = 0;
    await withPreparedReviewSession(
      auth.client,
      async () => {
        writes += 1;
      },
      now,
    );

    assert.deepEqual(auth.calls, { get: 1, refresh: 1 });
    assert.equal(writes, 1, `${targetType} refreshes before one write`);
  }

  {
    const auth = authClient({ current: null, refreshed: null });
    let writes = 0;
    await assert.rejects(
      withPreparedReviewSession(
        auth.client,
        async () => {
          writes += 1;
        },
        now,
      ),
      (error) =>
        error instanceof ReviewSessionPreparationError &&
        error.code === "SESSION_EXPIRED",
    );
    assert.deepEqual(auth.calls, { get: 1, refresh: 0 });
    assert.equal(writes, 0, `${targetType} missing session blocks the write`);
  }

  {
    const auth = authClient({
      current: session(1_000),
      refreshed: null,
      refreshError: { message: "refresh failed" },
    });
    let writes = 0;
    await assert.rejects(
      withPreparedReviewSession(
        auth.client,
        async () => {
          writes += 1;
        },
        now,
      ),
      (error) =>
        error instanceof ReviewSessionPreparationError &&
        error.code === "SESSION_EXPIRED",
    );
    assert.deepEqual(auth.calls, { get: 1, refresh: 1 });
    assert.equal(writes, 0, `${targetType} failed refresh blocks the write`);
  }

  {
    const auth = authClient({
      current: session(3_600_000),
      refreshed: null,
    });
    const expiredRpcError = { code: "PGRST301", message: "JWT expired" };
    let writes = 0;
    const rpcResult = await withPreparedReviewSession(
      auth.client,
      async () => {
        writes += 1;
        return { error: expiredRpcError };
      },
      now,
    );

    assert.equal(writes, 1, `${targetType} post-write expiry is never replayed`);
    assert.equal(rpcResult.error, expiredRpcError);
    assert.equal(isReviewSessionAuthError(rpcResult.error), true);
  }

  {
    const auth = authClient({
      current: session(3_600_000),
      refreshed: null,
    });
    const rpcFailure = Object.assign(new Error("transport ended"), {
      code: "NETWORK",
    });
    let writes = 0;
    await assert.rejects(
      withPreparedReviewSession(
        auth.client,
        async () => {
          writes += 1;
          throw rpcFailure;
        },
        now,
      ),
      (error) => error === rpcFailure,
    );
    assert.equal(writes, 1, `${targetType} thrown write failure is not retried`);
  }
}

assert.equal(isReviewSessionAuthError({ code: "pgrst301" }), true);
assert.equal(isReviewSessionAuthError({ message: " JWT has expired " }), true);
assert.equal(isReviewSessionAuthError({ message: "JWT expired" }), true);
assert.equal(isReviewSessionAuthError({ code: "401", message: "Unauthorized" }), false);
assert.equal(isReviewSessionAuthError({ message: "permission denied" }), false);
assert.doesNotMatch(REVIEW_SESSION_EXPIRED_MESSAGE, /jwt|postgrest|pgrst/i);

class MemoryStorage {
  values = new Map();

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

const storage = new MemoryStorage();
const form = {
  removalChoice: true,
  removedMisconceptionIds: ["M-1"],
  removalReason: "Tidak sesuai",
  additionChoice: true,
  additionalMisconceptionIds: ["M-2"],
  additionReason: "Perlu ditambahkan",
  note: "Draf penting",
};
const identity = {
  reviewerId: "lecturer-1",
  targetType: "question",
  targetId: "question-1",
  sourceVersion: "source-v1",
};

saveReviewSessionDraft(storage, identity, form);
assert.deepEqual(loadReviewSessionDraft(storage, identity), form);
assert.equal(
  loadReviewSessionDraft(storage, { ...identity, reviewerId: "lecturer-2" }),
  undefined,
  "a different reviewer cannot restore the draft",
);
assert.equal(
  loadReviewSessionDraft(storage, { ...identity, sourceVersion: "source-v2" }),
  undefined,
  "a different source version cannot restore the draft",
);
clearReviewSessionDraft(storage, identity);
assert.equal(loadReviewSessionDraft(storage, identity), undefined);

const repository = await readFile(
  new URL("../src/services/reviewPersistenceRepository.ts", import.meta.url),
  "utf8",
);
const reviewPage = await readFile(
  new URL("../src/pages/LecturerReviewPage.tsx", import.meta.url),
  "utf8",
);
const loginPage = await readFile(
  new URL("../src/pages/LecturerLoginPage.tsx", import.meta.url),
  "utf8",
);
const questionWorkspace = reviewPage.slice(
  reviewPage.indexOf("export function QuestionValidationWorkspace"),
  reviewPage.indexOf("export function AnswerValidationWorkspace"),
);
const answerWorkspace = reviewPage.slice(
  reviewPage.indexOf("export function AnswerValidationWorkspace"),
);
const questionSave = repository.slice(
  repository.indexOf("export async function saveQuestionReview"),
  repository.indexOf("export async function saveAnswerReview"),
);
const answerSave = repository.slice(
  repository.indexOf("export async function saveAnswerReview"),
  repository.indexOf("export async function deleteQuestionReview"),
);

for (const [label, source, rpc] of [
  ["question", questionSave, "save_question_review_v3"],
  ["answer", answerSave, "save_answer_review_v3"],
]) {
  assert.match(source, /runPreparedReviewWrite\(\(\) =>/);
  assert.equal(source.match(/runPreparedReviewWrite/g)?.length, 1);
  assert.equal(source.match(new RegExp(`supabase\\.rpc\\("${rpc}"`, "g"))?.length, 1);
  assert.doesNotMatch(source, /refreshSession|catch\s*\([\s\S]*supabase\.rpc/);
  assert.match(source, /throw (?:storageError\(|mappedError)/);
  assert.ok(source.length > 0, `${label} save source was located`);
}

assert.doesNotMatch(
  answerSave,
  /console\.error\([^;]*,\s*error\s*\)/s,
  "the answer save path must not log a raw Supabase auth error",
);

assert.match(repository, /SESSION_EXPIRED: REVIEW_SESSION_EXPIRED_MESSAGE/);
assert.match(repository, /isReviewSessionAuthError\(error\)/);
assert.equal(
  reviewPage.match(/if \(formUnavailable \|\| submitting\) return;/g)?.length,
  2,
);
assert.equal(
  reviewPage.match(/isReviewPersistenceError\(error, "SESSION_EXPIRED"\)/g)
    ?.length,
  2,
);
assert.equal(reviewPage.match(/preserveReviewForm\(draftIdentity, form\)/g)?.length, 2);
assert.equal(reviewPage.match(/clearPreservedReviewForm\(draftIdentity\)/g)?.length, 2);
for (const [label, workspace] of [
  ["question", questionWorkspace],
  ["answer", answerWorkspace],
]) {
  const preservedAt = workspace.indexOf("preserveReviewForm(draftIdentity, form)");
  const submittedAt = workspace.indexOf("await onSubmit(");
  const clearedAt = workspace.indexOf("clearPreservedReviewForm(draftIdentity)");
  assert.ok(preservedAt >= 0 && preservedAt < submittedAt, `${label} draft is preserved before auth/write`);
  assert.ok(clearedAt > submittedAt, `${label} draft is cleared only after save success`);
}
assert.match(reviewPage, /href="\/dosen\/login\?reauth=1"/);
assert.match(loginPage, /!reauthenticate && !loading && isLecturer/);
assert.doesNotMatch(
  `${repository}\n${reviewPage}\n${loginPage}`,
  /Authorization|access_token|localStorage\.(?:setItem|getItem)/,
  "the hotfix must not implement manual token handling",
);

if (process.argv.includes("--local")) {
  const docker = (arguments_) => {
    try {
      return execFileSync("docker", arguments_, {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch {
      throw new Error("Local Docker Supabase Auth compatibility check is unavailable.");
    }
  };
  const kongContainer = docker([
    "ps",
    "--filter",
    "name=supabase_kong_",
    "--format",
    "{{.Names}}",
  ])
    .trim()
    .split(/\r?\n/)
    .find(Boolean);
  assert.ok(kongContainer, "a running local Supabase Kong container is required");
  const projectId = docker([
    "inspect",
    "--format",
    '{{index .Config.Labels "com.supabase.cli.project"}}',
    kongContainer,
  ]).trim();
  assert.ok(projectId, "the local Supabase project label was not found");

  const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
  const supabaseCli = join(
    repositoryRoot,
    "node_modules",
    "supabase",
    "dist",
    "supabase.js",
  );
  const statusWorkdir = mkdtempSync(
    join(tmpdir(), "progmiscon-review-auth-check-"),
  );
  let status;
  try {
    execFileSync(
      process.execPath,
      [supabaseCli, "init", "--force", "--workdir", statusWorkdir],
      { cwd: statusWorkdir, stdio: ["ignore", "pipe", "pipe"] },
    );
    const configPath = join(statusWorkdir, "supabase", "config.toml");
    writeFileSync(
      configPath,
      readFileSync(configPath, "utf8").replace(
        /^project_id\s*=.*$/m,
        `project_id = ${JSON.stringify(projectId)}`,
      ),
      "utf8",
    );
    status = JSON.parse(
      execFileSync(
        process.execPath,
        [
          supabaseCli,
          "status",
          "--output",
          "json",
          "--workdir",
          statusWorkdir,
        ],
        {
          cwd: statusWorkdir,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        },
      ),
    );
  } catch {
    throw new Error("Local Supabase Auth status compatibility check failed.");
  } finally {
    rmSync(statusWorkdir, { recursive: true, force: true });
  }
  const apiUrl = status.API_URL ?? status.api_url;
  const anonKey = status.ANON_KEY ?? status.anon_key;
  assert.ok(apiUrl && anonKey, "local Supabase status omitted auth settings");
  assert.ok(
    ["127.0.0.1", "localhost", "[::1]", "::1"].includes(
      new URL(apiUrl).hostname,
    ),
    "the local Supabase API must be on loopback",
  );

  const localSupabase = createClient(
    apiUrl,
    anonKey,
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      global: {
        fetch: async (input, init) => {
          assert.match(String(input), /\/auth\/v1\/token\?grant_type=refresh_token$/);
          assert.equal(init?.method, "POST");
          return fetch(input, init);
        },
      },
    },
  );
  const current = await localSupabase.auth.getSession();
  assert.equal(current.error, null);
  assert.equal(current.data.session, null);

  const refreshed = await localSupabase.auth.refreshSession({
    refresh_token: "review-hotfix-invalid-local-refresh-token",
  });
  assert.ok(refreshed.error, "local GoTrue must reject the invalid refresh credential");
  assert.equal(refreshed.data.session, null);
  assert.equal(refreshed.data.user, null);
  console.log(
    "Supabase JS 2.110.5 local auth compatibility check passed (real loopback GoTrue refresh failure, no user/session created).",
  );
}

console.log(
  "Review session-expiry checks passed (question/answer preflight, no retry, safe UX, scoped draft).",
);
