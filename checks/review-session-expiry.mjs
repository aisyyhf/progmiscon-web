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
  hasActiveReviewSession,
  isReviewSessionAuthError,
  withPreparedReviewSession,
} from "../src/services/reviewSession.ts";
import {
  clearReviewSessionDraft,
  loadReviewSessionDraft,
  saveReviewSessionDraft,
} from "../src/utils/reviewSessionDraft.ts";
import {
  buildReviewReauthPath,
  sanitizeReviewReturnTo,
} from "../src/utils/reviewReauthReturn.ts";

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

// The blocking dialog only releases once Supabase Auth confirms a real session.
assert.equal(
  await hasActiveReviewSession({
    async getSession() {
      return { data: { session: { user: { id: "lecturer-1" } } }, error: null };
    },
  }),
  true,
);
assert.equal(
  await hasActiveReviewSession({
    async getSession() {
      return { data: { session: null }, error: null };
    },
  }),
  false,
  "no session keeps the dialog open",
);
assert.equal(
  await hasActiveReviewSession({
    async getSession() {
      return { data: { session: { user: { id: "lecturer-1" } } }, error: { message: "network" } };
    },
  }),
  false,
  "a getSession error keeps the dialog open",
);
assert.equal(
  await hasActiveReviewSession({
    async getSession() {
      throw new Error("offline");
    },
  }),
  false,
  "a thrown getSession keeps the dialog open",
);

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
assert.equal(
  loadReviewSessionDraft(storage, { ...identity, targetId: "question-2" }),
  undefined,
  "a different target id cannot restore the draft",
);
assert.equal(
  loadReviewSessionDraft(storage, { ...identity, targetType: "answer" }),
  undefined,
  "a different target type cannot restore the draft",
);
clearReviewSessionDraft(storage, identity);
assert.equal(loadReviewSessionDraft(storage, identity), undefined);

// returnTo may only round-trip safe internal Review routes; never an open redirect.
assert.equal(sanitizeReviewReturnTo("/review?week=1&item=q-1"), "/review?week=1&item=q-1");
assert.equal(sanitizeReviewReturnTo("/review/answer/a-1"), "/review/answer/a-1");
assert.equal(sanitizeReviewReturnTo("/dashboard"), null, "non-review routes are rejected");
assert.equal(sanitizeReviewReturnTo("https://evil.example/review"), null);
assert.equal(sanitizeReviewReturnTo("//evil.example"), null);
assert.equal(sanitizeReviewReturnTo("/\\evil.example"), null);
assert.equal(sanitizeReviewReturnTo("/review/../admin/reviews"), null, "path traversal is rejected");
assert.equal(sanitizeReviewReturnTo("javascript:alert(1)"), null);
assert.equal(sanitizeReviewReturnTo("/review\t/x"), null, "control characters are rejected");
assert.equal(sanitizeReviewReturnTo(null), null);
assert.equal(
  buildReviewReauthPath("/review?week=2"),
  "/dosen/login?reauth=1&returnTo=%2Freview%3Fweek%3D2",
);
assert.equal(
  buildReviewReauthPath("https://evil.example"),
  "/dosen/login?reauth=1",
  "an unsafe current path falls back to a bare login redirect",
);

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
// Success-only draft clearing: exactly one clear per workspace, and only after
// the explicit write resolves.
assert.equal(reviewPage.match(/clearPreservedReviewForm\(draftIdentity\)/g)?.length, 2);
for (const [label, workspace] of [
  ["question", questionWorkspace],
  ["answer", answerWorkspace],
]) {
  const submittedAt = workspace.indexOf("await onSubmit(");
  const clearedAt = workspace.indexOf("clearPreservedReviewForm(draftIdentity)");
  const flushedAt = workspace.indexOf("preserveReviewForm(draftIdentity, form)");
  assert.ok(submittedAt >= 0, `${label} workspace submits through onSubmit`);
  assert.ok(
    flushedAt >= 0 && flushedAt < submittedAt,
    `${label} draft is flushed before the write`,
  );
  assert.ok(
    clearedAt > submittedAt,
    `${label} draft is cleared only after save success`,
  );

  // The failure branch must keep the draft.
  const catchStart = workspace.indexOf("} catch (error) {", submittedAt);
  const catchEnd = workspace.indexOf("} finally {", catchStart);
  const catchBlock = workspace.slice(catchStart, catchEnd);
  assert.doesNotMatch(
    catchBlock,
    /clearPreservedReviewForm/,
    `${label} save failure must not clear the draft`,
  );
  assert.match(
    catchBlock,
    /isReviewPersistenceError\(error, "SESSION_EXPIRED"\)/,
    `${label} still classifies SESSION_EXPIRED`,
  );
}

// Browser-local autosave never reaches Supabase.
assert.match(
  reviewPage,
  /Browser-local autosave[\s\S]*?preserveReviewForm\(draftIdentity, form\)/,
  "the autosave effect writes only the sessionStorage draft",
);
assert.doesNotMatch(
  reviewPage,
  /\.rpc\(/,
  "the Review page never calls a Supabase RPC directly",
);
assert.equal(
  reviewPage.match(/saveQuestionReview\(/g)?.length,
  1,
  "exactly one deliberate question Review write call site",
);
assert.equal(
  reviewPage.match(/saveAnswerReview\(/g)?.length,
  1,
  "exactly one deliberate answer Review write call site",
);
assert.doesNotMatch(reviewPage, /setInterval\(/, "no polling was introduced");

// Same-tab reauthentication with a safe return path, no new-tab anchor.
assert.match(reviewPage, /buildReviewReauthPath\(/);
const dialogSlice = reviewPage.slice(
  reviewPage.indexOf("function ReviewSessionExpiredDialog"),
  reviewPage.indexOf("function ReviewStepNavigation"),
);
assert.doesNotMatch(dialogSlice, /target="_blank"/, "reauth navigates in the same tab");
assert.doesNotMatch(dialogSlice, /href=/, "reauth uses router navigation, not an anchor href");
assert.match(dialogSlice, /Kembali ke Halaman Login/);
assert.match(dialogSlice, /onBeforeReauth\(\);/, "the draft is flushed before navigating away");
assert.match(dialogSlice, /createPortal\(/, "the blocking overlay is portalled to document.body");

// Login page looks normal again: the special reauth notice is gone, and a
// validated returnTo drives the post-login redirect.
assert.doesNotMatch(
  loginPage,
  /memperbarui sesi Review|Draf tetap tersimpan|refresh your Review session/,
  "the special reauth notice was removed from the login page",
);
assert.match(loginPage, /sanitizeReviewReturnTo\(/);
assert.match(loginPage, /safeReturnTo \?\? "\/dashboard"/);
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
