// Read-only staging reader for the Master Data sync impact preflight.
//
// HARD RULES (enforced below and by checks/baseline-sync-impact-preflight.mjs):
//   * The ONLY network verb this module ever issues is HTTP GET.
//   * It refuses to talk to any project whose ref is not the shared staging ref.
//   * There is no --production path and no way to reach production from here.
//
// RLS note: the *_misconception_baselines / *_overrides tables have RLS enabled
// with NO select policy for anon/authenticated, so a meaningful read needs the
// service-role key (which bypasses RLS). The key is used for GET requests only
// and is never logged.

export const STAGING_REF = "ineefknatilxkqatbbrm";

export function parseSupabaseRef(url) {
  let host;
  try {
    host = new URL(url).host;
  } catch {
    throw new Error(`not a valid URL: ${url}`);
  }
  const ref = host.split(".")[0];
  if (!/^[a-z0-9]{16,}$/i.test(ref)) {
    throw new Error(`could not extract a Supabase project ref from: ${url}`);
  }
  return ref;
}

export function assertStagingRef(url) {
  const ref = parseSupabaseRef(url);
  if (ref !== STAGING_REF) {
    throw new Error(
      `refusing to connect: project ref "${ref}" is not the shared staging ref ` +
        `"${STAGING_REF}". This preflight never connects to any other project ` +
        "(there is no production mode).",
    );
  }
  return ref;
}

// One choke point for every network call. method is hard-coded to GET.
async function stagingGet(baseUrl, key, pathAndQuery) {
  const url = `${baseUrl.replace(/\/$/, "")}/rest/v1/${pathAndQuery}`;
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const to = from + pageSize - 1;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        apikey: key,
        authorization: `Bearer ${key}`,
        accept: "application/json",
        range: `${from}-${to}`,
        "range-unit": "items",
      },
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`GET ${pathAndQuery} failed: HTTP ${response.status} ${body.slice(0, 200)}`);
    }
    const page = await response.json();
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}

function countActiveReviewers(reviewRows, targetKey, baselineByTarget) {
  const byTarget = new Map();
  for (const row of reviewRows) {
    const id = String(row[targetKey] ?? "").trim();
    const baseline = baselineByTarget.get(id);
    if (!baseline) continue;
    if ((row.source_version ?? null) !== (baseline.source_version ?? null)) continue;
    if (!byTarget.has(id)) byTarget.set(id, new Set());
    byTarget.get(id).add(row.reviewer_id);
  }
  const counts = new Map();
  for (const [id, reviewers] of byTarget) counts.set(id, reviewers.size);
  return counts;
}

export async function fetchBaselineStateFromStaging({ url, key }) {
  assertStagingRef(url);
  if (!key) throw new Error("STAGING_SUPABASE_SERVICE_ROLE_KEY is required for --from-staging (read-only GET use).");

  const [
    questionBaselines,
    answerBaselines,
    questionOverrides,
    answerOverrides,
    questionReviews,
    answerReviews,
  ] = await Promise.all([
    stagingGet(url, key, "question_misconception_baselines?select=question_id,source_version,source_fingerprint,misconception_ids"),
    stagingGet(url, key, "answer_misconception_baselines?select=answer_id,question_id,source_version,source_fingerprint,misconception_ids"),
    stagingGet(url, key, "question_misconception_overrides?select=question_id"),
    stagingGet(url, key, "answer_misconception_overrides?select=answer_id"),
    stagingGet(url, key, "question_reviews?select=question_id,reviewer_id,source_version&is_active=eq.true"),
    stagingGet(url, key, "answer_reviews?select=answer_id,reviewer_id,source_version&is_active=eq.true"),
  ]);

  const questionBaselineById = new Map(
    questionBaselines.map((row) => [String(row.question_id).trim(), row]),
  );
  const answerBaselineById = new Map(
    answerBaselines.map((row) => [String(row.answer_id).trim(), row]),
  );
  const questionOverrideIds = new Set(questionOverrides.map((row) => String(row.question_id).trim()));
  const answerOverrideIds = new Set(answerOverrides.map((row) => String(row.answer_id).trim()));

  const questionReviewCounts = countActiveReviewers(questionReviews, "question_id", questionBaselineById);
  const answerReviewCounts = countActiveReviewers(answerReviews, "answer_id", answerBaselineById);

  return {
    source: "staging",
    questions: questionBaselines.map((row) => ({
      question_id: String(row.question_id).trim(),
      source_version: row.source_version ?? null,
      source_fingerprint: row.source_fingerprint ?? null,
      misconception_ids: row.misconception_ids ?? [],
      active_review_count: questionReviewCounts.get(String(row.question_id).trim()) ?? 0,
      override_exists: questionOverrideIds.has(String(row.question_id).trim()),
    })),
    answers: answerBaselines.map((row) => ({
      answer_id: String(row.answer_id).trim(),
      question_id: row.question_id != null ? String(row.question_id).trim() : null,
      source_version: row.source_version ?? null,
      source_fingerprint: row.source_fingerprint ?? null,
      misconception_ids: row.misconception_ids ?? [],
      active_review_count: answerReviewCounts.get(String(row.answer_id).trim()) ?? 0,
      override_exists: answerOverrideIds.has(String(row.answer_id).trim()),
    })),
  };
}
