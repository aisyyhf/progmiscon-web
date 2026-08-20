import { createClient } from "@supabase/supabase-js";
// @deno-types="npm:@types/papaparse@5.5.2"
import Papa from "papaparse";

import {
  buildTrustedMasterSnapshot,
  type MasterCsvRow,
  parseSyncIntent,
  summarizeTrustedMasterSnapshot,
  type TrustedMasterIssue,
  type TrustedMasterRows,
} from "../_shared/trustedMasterSync.ts";

const MAX_REQUEST_BYTES = 1_024;
const MAX_CSV_BYTES = 5 * 1_024 * 1_024;
const FETCH_TIMEOUT_MS = 15_000;

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};

type SourceName =
  | "questions"
  | "answers"
  | "questionMisconceptions"
  | "answerMisconceptions"
  | "misconceptions";

type SourceConfiguration = {
  name: SourceName;
  url: string;
  requiredHeaders: string[];
};

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly issues?: TrustedMasterIssue[];

  constructor(
    status: number,
    code: string,
    message: string,
    issues?: TrustedMasterIssue[],
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.issues = issues;
  }
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim() ?? "";
  if (!value) {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "Trusted sync server configuration is incomplete",
    );
  }
  return value;
}

function readSourceConfiguration(): SourceConfiguration[] {
  return [
    {
      name: "questions",
      url: requiredEnvironment("MASTER_QUESTIONS_CSV_URL"),
      requiredHeaders: [
        "question_id",
        "question_type",
        "question_ind",
        "question_en",
        "active",
      ],
    },
    {
      name: "answers",
      url: requiredEnvironment("MASTER_ANSWERS_CSV_URL"),
      requiredHeaders: ["answer_id", "question_id", "answer_role", "active"],
    },
    {
      name: "questionMisconceptions",
      url: requiredEnvironment("MASTER_QUESTION_MISCONCEPTIONS_CSV_URL"),
      requiredHeaders: ["question_id", "misconception_id", "active"],
    },
    {
      name: "answerMisconceptions",
      url: requiredEnvironment("MASTER_ANSWER_MISCONCEPTIONS_CSV_URL"),
      requiredHeaders: ["answer_id", "misconception_id", "active"],
    },
    {
      name: "misconceptions",
      url: requiredEnvironment("MASTER_MISCONCEPTIONS_CSV_URL"),
      requiredHeaders: ["misconception_id", "active"],
    },
  ];
}

async function authorizeActiveAdmin(
  request: Request,
): Promise<{ supabaseUrl: string; userId: string }> {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
  if (!match) {
    throw new HttpError(
      401,
      "AUTHENTICATION_REQUIRED",
      "A valid bearer token is required",
    );
  }

  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    requiredEnvironment("SUPABASE_ANON_KEY");
  const accessToken = match[1];
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(
    accessToken,
  );
  if (userError || !userData.user) {
    throw new HttpError(
      401,
      "AUTHENTICATION_REQUIRED",
      "A valid bearer token is required",
    );
  }

  const { data: profile, error: profileError } = await userClient
    .from("lecturer_profiles")
    .select("active")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (profileError) {
    throw new HttpError(
      503,
      "AUTHORIZATION_UNAVAILABLE",
      "Authorization could not be verified",
    );
  }
  if (profile?.active !== true) {
    throw new HttpError(
      403,
      "ADMIN_ACCESS_REQUIRED",
      "Active Admin access is required",
    );
  }

  const { data: isAdmin, error: adminError } = await userClient.rpc(
    "current_user_is_admin",
  );
  if (adminError) {
    throw new HttpError(
      503,
      "AUTHORIZATION_UNAVAILABLE",
      "Authorization could not be verified",
    );
  }
  if (isAdmin !== true) {
    throw new HttpError(
      403,
      "ADMIN_ACCESS_REQUIRED",
      "Active Admin access is required",
    );
  }

  return { supabaseUrl, userId: userData.user.id };
}

async function readRequestIntent(
  request: Request,
): Promise<"preview" | "sync"> {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body is too large");
  }

  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body is too large");
  }

  let body: unknown;
  try {
    body = text.trim() ? JSON.parse(text) : undefined;
  } catch {
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      "Request body contains invalid JSON",
    );
  }
  const intent = parseSyncIntent(body);
  if (!intent.ok) {
    throw new HttpError(400, "INVALID_REQUEST", intent.error);
  }
  return intent.mode;
}

function validateConfiguredUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "Trusted sync source configuration is invalid",
    );
  }
  if (url.protocol !== "https:") {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "Trusted sync sources must use HTTPS",
    );
  }
  return url;
}

async function fetchCsvSource(
  source: SourceConfiguration,
): Promise<MasterCsvRow[]> {
  const url = validateConfiguredUrl(source.url);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { accept: "text/csv,text/plain;q=0.9" },
      redirect: "follow",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new HttpError(
        502,
        "MASTER_SOURCE_UNAVAILABLE",
        `Configured ${source.name} source could not be loaded`,
      );
    }

    const declaredLength = Number(
      response.headers.get("content-length") ?? "0",
    );
    if (Number.isFinite(declaredLength) && declaredLength > MAX_CSV_BYTES) {
      throw new HttpError(
        502,
        "MASTER_SOURCE_TOO_LARGE",
        `Configured ${source.name} source exceeds the size limit`,
      );
    }

    const csvText = await response.text();
    if (!csvText.trim()) {
      throw new HttpError(
        422,
        "INVALID_MASTER_DATA",
        `Configured ${source.name} source is empty`,
      );
    }
    if (new TextEncoder().encode(csvText).byteLength > MAX_CSV_BYTES) {
      throw new HttpError(
        502,
        "MASTER_SOURCE_TOO_LARGE",
        `Configured ${source.name} source exceeds the size limit`,
      );
    }

    const parsed = Papa.parse<MasterCsvRow>(csvText, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
    });
    if (parsed.errors.length > 0) {
      throw new HttpError(
        422,
        "INVALID_MASTER_DATA",
        `Configured ${source.name} CSV could not be parsed`,
      );
    }
    const headers = new Set(parsed.meta.fields ?? []);
    if (source.requiredHeaders.some((header) => !headers.has(header))) {
      throw new HttpError(
        422,
        "INVALID_MASTER_DATA",
        `Configured ${source.name} CSV is missing required columns`,
      );
    }
    if (parsed.data.length === 0) {
      throw new HttpError(
        422,
        "INVALID_MASTER_DATA",
        `Configured ${source.name} CSV contains no data rows`,
      );
    }
    return parsed.data;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      "MASTER_SOURCE_UNAVAILABLE",
      `Configured ${source.name} source could not be loaded`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function loadTrustedMasterRows(): Promise<TrustedMasterRows> {
  const sources = readSourceConfiguration();
  const loaded = await Promise.all(sources.map(fetchCsvSource));
  return Object.fromEntries(
    sources.map((source, index) => [source.name, loaded[index]]),
  ) as TrustedMasterRows;
}

function safeDatabaseSummary(data: unknown): Record<string, unknown> {
  const candidate = Array.isArray(data) ? data[0] : data;
  if (!candidate || typeof candidate !== "object") return { completed: true };
  const row = candidate as Record<string, unknown>;
  return {
    completed: true,
    ...(typeof row.question_count === "number"
      ? { questionCount: row.question_count }
      : {}),
    ...(typeof row.answer_count === "number"
      ? { answerCount: row.answer_count }
      : {}),
    ...(typeof row.misconception_count === "number"
      ? { misconceptionCount: row.misconception_count }
      : {}),
  };
}

async function handleRequest(request: Request): Promise<Response> {
  try {
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({
          error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" },
        }),
        { status: 405, headers: { ...JSON_HEADERS, allow: "POST" } },
      );
    }

    const { supabaseUrl } = await authorizeActiveAdmin(request);
    const mode = await readRequestIntent(request);
    const masterRows = await loadTrustedMasterRows();
    const built = await buildTrustedMasterSnapshot(masterRows);
    if (!built.ok) {
      throw new HttpError(
        422,
        "INVALID_MASTER_DATA",
        "Trusted master data validation failed",
        built.issues,
      );
    }

    const summary = summarizeTrustedMasterSnapshot(built.snapshot);
    if (mode === "preview") {
      return jsonResponse(200, { mode, summary });
    }

    if (
      Deno.env.get("TRUSTED_MASTER_SYNC_ENABLED")?.trim().toLowerCase() !==
        "true"
    ) {
      throw new HttpError(
        503,
        "SYNC_DISABLED",
        "Trusted master sync is disabled until rollout validation is complete",
      );
    }

    const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    const { data, error } = await serviceClient.rpc(
      "sync_master_relation_baselines_v2",
      {
        input_question_baselines: built.snapshot.questionBaselines,
        input_answer_baselines: built.snapshot.answerBaselines,
        input_misconception_ids: built.snapshot.misconceptionIds,
      },
    );
    if (error) {
      throw new HttpError(
        502,
        "SYNC_FAILED",
        "The atomic database sync failed",
      );
    }

    return jsonResponse(200, {
      mode,
      summary,
      database: safeDatabaseSummary(data),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(error.status, {
        error: {
          code: error.code,
          message: error.message,
          ...(error.issues
            ? {
              validationErrorCount: error.issues.length,
              validationErrors: error.issues.slice(0, 20),
            }
            : {}),
        },
      });
    }
    return jsonResponse(500, {
      error: {
        code: "INTERNAL_ERROR",
        message: "Trusted master sync could not be completed",
      },
    });
  }
}

export default { fetch: handleRequest };
