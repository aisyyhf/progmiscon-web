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
export const MAX_CSV_BYTES = 5 * 1_024 * 1_024;
export const MAX_CSV_ROWS = 20_000;
export const MAX_CSV_FIELD_CHARACTERS = 128 * 1_024;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_REDIRECT_HOPS = 3;

const JSON_HEADERS = {
  "cache-control": "no-store",
  "content-type": "application/json; charset=utf-8",
  "x-content-type-options": "nosniff",
};
const CORS_HEADERS = {
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "authorization, apikey, content-type",
};
const ACCEPTED_CSV_CONTENT_TYPES = new Set([
  "text/csv",
  "text/plain",
  "text/comma-separated-values",
  "application/csv",
  "application/vnd.ms-excel",
]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type SourceName =
  | "questions"
  | "answers"
  | "questionMisconceptions"
  | "answerMisconceptions"
  | "misconceptions";

export type SourceDefinition = {
  name: SourceName;
  environmentName: string;
  frozenFileName: string;
  requiredHeaders: readonly string[];
};

type SourceConfiguration = SourceDefinition & { url: string };

export const TRUSTED_MASTER_SOURCE_DEFINITIONS: readonly SourceDefinition[] = [
  {
    name: "questions",
    environmentName: "MASTER_QUESTIONS_CSV_URL",
    frozenFileName: "questions.csv",
    requiredHeaders: [
      "question_id",
      "question_type",
      "question_ind",
      "question_en",
      "question_code",
      "content_blocks_ind",
      "content_blocks_en",
      "input_description_ind",
      "input_description_en",
      "output_description_ind",
      "output_description_en",
      "sample_inputs",
      "sample_outputs",
      "test_cases_json",
      "active",
    ],
  },
  {
    name: "answers",
    environmentName: "MASTER_ANSWERS_CSV_URL",
    frozenFileName: "answers.csv",
    requiredHeaders: ["answer_id", "question_id", "answer_role", "active"],
  },
  {
    name: "questionMisconceptions",
    environmentName: "MASTER_QUESTION_MISCONCEPTIONS_CSV_URL",
    frozenFileName: "question_misconceptions.csv",
    requiredHeaders: [
      "question_id",
      "misconception_id",
      "source",
      "evidence_level",
      "rationale_ind",
      "source_question_id",
      "active",
    ],
  },
  {
    name: "answerMisconceptions",
    environmentName: "MASTER_ANSWER_MISCONCEPTIONS_CSV_URL",
    frozenFileName: "answer_misconceptions.csv",
    requiredHeaders: [
      "answer_id",
      "misconception_id",
      "reason_ind",
      "reason_en",
      "active",
    ],
  },
  {
    name: "misconceptions",
    environmentName: "MASTER_MISCONCEPTIONS_CSV_URL",
    frozenFileName: "misconceptions.csv",
    requiredHeaders: ["misconception_id", "active"],
  },
];

export type SyncDependencies = {
  envGet: (name: string) => string | undefined;
  fetch: typeof globalThis.fetch;
  createClient: typeof createClient;
};

const DEFAULT_DEPENDENCIES: SyncDependencies = {
  envGet: (name) => Deno.env.get(name),
  fetch: globalThis.fetch,
  createClient,
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

class SizeLimitError extends Error {}

function mergedHeaders(...inputs: HeadersInit[]): Headers {
  const headers = new Headers();
  for (const input of inputs) {
    new Headers(input).forEach((value, name) => headers.set(name, value));
  }
  return headers;
}

function jsonResponse(
  status: number,
  body: Record<string, unknown>,
  headers: HeadersInit,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: mergedHeaders(JSON_HEADERS, headers),
  });
}

function requiredEnvironment(
  name: string,
  dependencies: SyncDependencies,
): string {
  const value = dependencies.envGet(name)?.trim() ?? "";
  if (!value) {
    throw new HttpError(
      500,
      "SERVER_CONFIGURATION_ERROR",
      "Trusted sync server configuration is incomplete",
    );
  }
  return value;
}

function configuredAllowedOrigins(dependencies: SyncDependencies): Set<string> {
  const configured = requiredEnvironment("ADMIN_APP_ORIGINS", dependencies);
  const origins = new Set<string>();
  for (const rawOrigin of configured.split(",")) {
    const candidate = rawOrigin.trim();
    if (!candidate || candidate === "*") {
      throw new HttpError(
        500,
        "SERVER_CONFIGURATION_ERROR",
        "Trusted sync browser origin configuration is invalid",
      );
    }
    let url: URL;
    try {
      url = new URL(candidate);
    } catch {
      throw new HttpError(
        500,
        "SERVER_CONFIGURATION_ERROR",
        "Trusted sync browser origin configuration is invalid",
      );
    }
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.origin === "null"
    ) {
      throw new HttpError(
        500,
        "SERVER_CONFIGURATION_ERROR",
        "Trusted sync browser origin configuration is invalid",
      );
    }
    origins.add(url.origin);
  }
  return origins;
}

function corsHeadersForRequest(
  request: Request,
  dependencies: SyncDependencies,
): Headers {
  const headers = new Headers({ vary: "Origin" });
  const origin = request.headers.get("origin");
  if (!origin) {
    if (request.method === "OPTIONS") {
      throw new HttpError(
        403,
        "ORIGIN_NOT_ALLOWED",
        "Browser origin is not allowed",
      );
    }
    return headers;
  }

  if (!configuredAllowedOrigins(dependencies).has(origin)) {
    throw new HttpError(
      403,
      "ORIGIN_NOT_ALLOWED",
      "Browser origin is not allowed",
    );
  }

  headers.set("access-control-allow-origin", origin);
  for (const [name, value] of Object.entries(CORS_HEADERS)) {
    headers.set(name, value);
  }
  return headers;
}

function readSourceConfiguration(
  dependencies: SyncDependencies,
): SourceConfiguration[] {
  return TRUSTED_MASTER_SOURCE_DEFINITIONS.map((definition) => ({
    ...definition,
    url: requiredEnvironment(definition.environmentName, dependencies),
  }));
}

async function authorizeActiveAdmin(
  request: Request,
  dependencies: SyncDependencies,
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

  const supabaseUrl = requiredEnvironment("SUPABASE_URL", dependencies);
  const anonKey = dependencies.envGet("SUPABASE_PUBLISHABLE_KEY")?.trim() ||
    requiredEnvironment("SUPABASE_ANON_KEY", dependencies);
  const accessToken = match[1];
  const userClient = dependencies.createClient(supabaseUrl, anonKey, {
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

function declaredLength(headers: Headers): number | undefined {
  const raw = headers.get("content-length");
  if (!raw) return undefined;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

async function readBoundedUtf8(
  body: ReadableStream<Uint8Array> | null,
  maximumBytes: number,
): Promise<{ text: string; byteLength: number }> {
  if (!body) return { text: "", byteLength: 0 };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maximumBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size error below is authoritative even if cancellation fails.
        }
        throw new SizeLimitError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return {
    text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
    byteLength,
  };
}

function mediaType(value: string | null): string {
  return (value ?? "").split(";", 1)[0].trim().toLowerCase();
}

function isJsonContentType(value: string | null): boolean {
  const type = mediaType(value);
  return type === "application/json" || type.endsWith("+json");
}

async function readRequestIntent(
  request: Request,
): Promise<"preview" | "sync"> {
  if ((declaredLength(request.headers) ?? 0) > MAX_REQUEST_BYTES) {
    throw new HttpError(413, "REQUEST_TOO_LARGE", "Request body is too large");
  }

  let bounded: { text: string; byteLength: number };
  try {
    bounded = await readBoundedUtf8(request.body, MAX_REQUEST_BYTES);
  } catch (error) {
    if (error instanceof SizeLimitError) {
      throw new HttpError(
        413,
        "REQUEST_TOO_LARGE",
        "Request body is too large",
      );
    }
    throw new HttpError(
      400,
      "INVALID_REQUEST",
      "Request body is not valid UTF-8 JSON",
    );
  }

  if (
    bounded.byteLength > 0 &&
    !isJsonContentType(request.headers.get("content-type"))
  ) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Request body must use an application/json content type",
    );
  }

  let body: unknown;
  try {
    body = bounded.text.trim() ? JSON.parse(bounded.text) : undefined;
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

function isAcceptedGoogleHost(hostname: string): boolean {
  return hostname === "docs.google.com" ||
    hostname === "googleusercontent.com" ||
    hostname.endsWith(".googleusercontent.com");
}

function validateGoogleSourceUrl(
  value: string | URL,
  status: 500 | 502,
): URL {
  let url: URL;
  try {
    url = value instanceof URL ? value : new URL(value);
  } catch {
    throw new HttpError(
      status,
      status === 500
        ? "SERVER_CONFIGURATION_ERROR"
        : "MASTER_SOURCE_REDIRECT_REJECTED",
      status === 500
        ? "Trusted sync source configuration is invalid"
        : "Configured master source redirected outside the trusted boundary",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !isAcceptedGoogleHost(url.hostname)
  ) {
    throw new HttpError(
      status,
      status === 500
        ? "SERVER_CONFIGURATION_ERROR"
        : "MASTER_SOURCE_REDIRECT_REJECTED",
      status === 500
        ? "Trusted sync sources must use approved HTTPS Google hosts"
        : "Configured master source redirected outside the trusted boundary",
    );
  }
  return url;
}

async function fetchWithTrustedRedirects(
  source: SourceConfiguration,
  dependencies: SyncDependencies,
  signal: AbortSignal,
): Promise<Response> {
  let url = validateGoogleSourceUrl(source.url, 500);

  for (let redirects = 0;; redirects += 1) {
    const response = await dependencies.fetch(url, {
      cache: "no-store",
      headers: { accept: "text/csv,text/plain;q=0.9" },
      redirect: "manual",
      signal,
    });
    if (!REDIRECT_STATUSES.has(response.status)) return response;
    if (redirects >= MAX_REDIRECT_HOPS) {
      await response.body?.cancel();
      throw new HttpError(
        502,
        "MASTER_SOURCE_REDIRECT_LIMIT",
        `Configured ${source.name} source exceeded the redirect limit`,
      );
    }
    const location = response.headers.get("location");
    await response.body?.cancel();
    if (!location) {
      throw new HttpError(
        502,
        "MASTER_SOURCE_REDIRECT_REJECTED",
        `Configured ${source.name} source returned an invalid redirect`,
      );
    }
    let redirected: URL;
    try {
      redirected = new URL(location, url);
    } catch {
      throw new HttpError(
        502,
        "MASTER_SOURCE_REDIRECT_REJECTED",
        `Configured ${source.name} source returned an invalid redirect`,
      );
    }
    url = validateGoogleSourceUrl(redirected, 502);
  }
}

export function parseTrustedMasterCsv(
  source: SourceDefinition,
  csvText: string,
): MasterCsvRow[] {
  if (!csvText.trim()) {
    throw new HttpError(
      422,
      "INVALID_MASTER_DATA",
      `Configured ${source.name} source is empty`,
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
  if (parsed.data.length > MAX_CSV_ROWS) {
    throw new HttpError(
      422,
      "INVALID_MASTER_DATA",
      `Configured ${source.name} CSV exceeds the row limit`,
    );
  }
  if (
    parsed.data.some((row) =>
      Object.values(row).some((value) =>
        (value?.length ?? 0) > MAX_CSV_FIELD_CHARACTERS
      )
    )
  ) {
    throw new HttpError(
      422,
      "INVALID_MASTER_DATA",
      `Configured ${source.name} CSV contains an oversized field`,
    );
  }
  return parsed.data;
}

async function fetchCsvSource(
  source: SourceConfiguration,
  dependencies: SyncDependencies,
): Promise<MasterCsvRow[]> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchWithTrustedRedirects(
      source,
      dependencies,
      controller.signal,
    );
    if (!response.ok) {
      throw new HttpError(
        502,
        "MASTER_SOURCE_UNAVAILABLE",
        `Configured ${source.name} source could not be loaded`,
      );
    }
    if (
      !ACCEPTED_CSV_CONTENT_TYPES.has(
        mediaType(response.headers.get("content-type")),
      )
    ) {
      await response.body?.cancel();
      throw new HttpError(
        502,
        "MASTER_SOURCE_CONTENT_TYPE_INVALID",
        `Configured ${source.name} source returned an invalid content type`,
      );
    }
    if ((declaredLength(response.headers) ?? 0) > MAX_CSV_BYTES) {
      await response.body?.cancel();
      throw new HttpError(
        502,
        "MASTER_SOURCE_TOO_LARGE",
        `Configured ${source.name} source exceeds the size limit`,
      );
    }

    let csvText: string;
    try {
      csvText = (await readBoundedUtf8(response.body, MAX_CSV_BYTES)).text;
    } catch (error) {
      if (error instanceof SizeLimitError) {
        throw new HttpError(
          502,
          "MASTER_SOURCE_TOO_LARGE",
          `Configured ${source.name} source exceeds the size limit`,
        );
      }
      throw new HttpError(
        422,
        "INVALID_MASTER_DATA",
        `Configured ${source.name} CSV is not valid UTF-8`,
      );
    }
    return parseTrustedMasterCsv(source, csvText);
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

async function loadTrustedMasterRows(
  dependencies: SyncDependencies,
): Promise<TrustedMasterRows> {
  const sources = readSourceConfiguration(dependencies);
  const loaded = await Promise.all(
    sources.map((source) => fetchCsvSource(source, dependencies)),
  );
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

async function handleRequest(
  request: Request,
  dependencies: SyncDependencies,
): Promise<Response> {
  let responseHeaders = new Headers({ vary: "Origin" });
  try {
    responseHeaders = corsHeadersForRequest(request, dependencies);
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: mergedHeaders(
          { "cache-control": "no-store" },
          responseHeaders,
        ),
      });
    }
    if (request.method !== "POST") {
      return jsonResponse(
        405,
        { error: { code: "METHOD_NOT_ALLOWED", message: "Use POST" } },
        mergedHeaders(responseHeaders, { allow: "POST, OPTIONS" }),
      );
    }

    const { supabaseUrl } = await authorizeActiveAdmin(request, dependencies);
    const mode = await readRequestIntent(request);
    const masterRows = await loadTrustedMasterRows(dependencies);
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
      return jsonResponse(200, { mode, summary }, responseHeaders);
    }

    if (
      dependencies.envGet("TRUSTED_MASTER_SYNC_ENABLED")?.trim()
        .toLowerCase() !== "true"
    ) {
      throw new HttpError(
        503,
        "SYNC_DISABLED",
        "Trusted master sync is disabled until rollout validation is complete",
      );
    }

    const serviceRoleKey = requiredEnvironment(
      "SUPABASE_SERVICE_ROLE_KEY",
      dependencies,
    );
    const serviceClient = dependencies.createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
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

    return jsonResponse(
      200,
      {
        mode,
        summary,
        database: safeDatabaseSummary(data),
      },
      responseHeaders,
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        error.status,
        {
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
        },
        responseHeaders,
      );
    }
    return jsonResponse(
      500,
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Trusted master sync could not be completed",
        },
      },
      responseHeaders,
    );
  }
}

export function createTrustedMasterSyncHandler(
  overrides: Partial<SyncDependencies> = {},
): (request: Request) => Promise<Response> {
  const dependencies = { ...DEFAULT_DEPENDENCIES, ...overrides };
  return (request) => handleRequest(request, dependencies);
}

const fetchHandler = createTrustedMasterSyncHandler();
export default { fetch: fetchHandler };
