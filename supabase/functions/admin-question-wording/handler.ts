import type {
  QuestionAuthorityDataset,
  QuestionAuthorityRow,
} from "../_shared/questionAuthority.ts";

export type AuthorityRead = {
  dataset: QuestionAuthorityDataset;
  driveVersion: string;
};

export type OverrideState = {
  questionInd: string | null;
  questionEn: string | null;
  contentVersion: string;
  updatedAt: string;
} | null;

export type SavedOverride = {
  questionId: string;
  questionInd: string;
  questionEn: string;
  contentVersion: string;
  updatedAt: string;
};

export type AdminQuestionWordingDependencies = {
  allowedOrigin: string;
  reviewedQuestionIds: ReadonlySet<string>;
  authenticate: (accessToken: string) => Promise<{ id: string } | null>;
  actorIsAuthorized: (actorId: string) => Promise<boolean>;
  readAuthority: () => Promise<AuthorityRead>;
  readDriveVersion: () => Promise<string>;
  loadOverride: (questionId: string) => Promise<OverrideState>;
  saveOverride: (input: {
    actorId: string;
    questionId: string;
    expectedContentVersion: string | null;
    authoritySha256: string;
    driveVersion: string;
    trustedQuestionInd: string;
    trustedQuestionEn: string;
    questionInd: string;
    questionEn: string;
  }) => Promise<SavedOverride>;
};

export class AdminQuestionWordingError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "AdminQuestionWordingError";
    this.code = code;
    this.status = status;
  }
}

const MAX_BODY_BYTES = 64 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

function edgeError(code: string, status: number): never {
  throw new AdminQuestionWordingError(code, status);
}

function response(
  origin: string,
  body: Record<string, unknown>,
  status = 200,
): Response {
  return new Response(status === 204 ? null : JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
      "access-control-allow-methods": "POST, OPTIONS",
      vary: "Origin",
    },
  });
}

function exactKeys(
  value: Record<string, unknown>,
  expected: readonly string[],
): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function questionIdFrom(value: unknown): string {
  if (typeof value !== "string" || !/^Q\d{3}$/.test(value.trim())) {
    return edgeError("INVALID_REQUEST", 400);
  }
  return value.trim();
}

function safeBlockedReason(target: QuestionAuthorityRow): string | null {
  return target.blockedReason;
}

function authorityFailure(error: unknown): never {
  if (error instanceof AdminQuestionWordingError) throw error;
  return edgeError("AUTHORITY_UNAVAILABLE", 503);
}

export function createAdminQuestionWordingHandler(
  dependencies: AdminQuestionWordingDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const origin = request.headers.get("origin") ?? "";
    if (!origin || origin !== dependencies.allowedOrigin) {
      return response(dependencies.allowedOrigin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
    }
    if (request.method === "OPTIONS") return response(origin, {}, 204);
    if (request.method !== "POST") {
      return response(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
    }

    try {
      const contentLength = Number(request.headers.get("content-length") ?? 0);
      if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
        edgeError("INVALID_REQUEST", 413);
      }
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
        edgeError("INVALID_REQUEST", 413);
      }
      let body: unknown;
      try {
        body = JSON.parse(rawBody);
      } catch {
        edgeError("INVALID_REQUEST", 400);
      }
      if (!body || typeof body !== "object" || Array.isArray(body)) {
        edgeError("INVALID_REQUEST", 400);
      }
      const input = body as Record<string, unknown>;
      const action = input.action;
      if (action !== "load" && action !== "save") {
        edgeError("INVALID_REQUEST", 400);
      }
      const expectedKeys = action === "load"
        ? ["action", "questionId"]
        : [
          "action",
          "questionId",
          "expectedAuthoritySha256",
          "expectedOverrideVersion",
          "questionInd",
          "questionEn",
        ];
      if (!exactKeys(input, expectedKeys)) edgeError("INVALID_REQUEST", 400);
      const questionId = questionIdFrom(input.questionId);
      if (!dependencies.reviewedQuestionIds.has(questionId)) {
        edgeError("QUESTION_NOT_REVIEWED", 404);
      }

      const authorization = request.headers.get("authorization") ?? "";
      const match = authorization.match(/^Bearer\s+([^\s]+)$/i);
      if (!match) edgeError("UNAUTHORIZED", 401);
      const user = await dependencies.authenticate(match[1]);
      if (!user) edgeError("UNAUTHORIZED", 401);
      if (!await dependencies.actorIsAuthorized(user.id)) {
        edgeError("FORBIDDEN", 403);
      }

      let authority: AuthorityRead;
      try {
        authority = await dependencies.readAuthority();
      } catch (error) {
        authorityFailure(error);
      }
      const target = authority.dataset.byId.get(questionId);
      if (!target) edgeError("QUESTION_NOT_FOUND", 404);

      if (action === "load") {
        const override = await dependencies.loadOverride(questionId);
        return response(origin, {
          data: {
            questionId,
            questionInd: override?.questionInd?.trim() || target.values.question_ind,
            questionEn: override?.questionEn?.trim() || target.values.question_en,
            editable: target.editable,
            readOnlyReason: safeBlockedReason(target),
            authoritySha256: target.targetSha256,
            overrideVersion: override?.contentVersion ?? null,
            updatedAt: override?.updatedAt ?? null,
          },
        });
      }

      if (
        typeof input.expectedAuthoritySha256 !== "string" ||
        !SHA256.test(input.expectedAuthoritySha256) ||
        (input.expectedOverrideVersion !== null &&
          (typeof input.expectedOverrideVersion !== "string" ||
            !UUID.test(input.expectedOverrideVersion))) ||
        typeof input.questionInd !== "string" ||
        typeof input.questionEn !== "string"
      ) {
        edgeError("INVALID_REQUEST", 400);
      }
      const questionInd = input.questionInd.trim();
      const questionEn = input.questionEn.trim();
      if (!questionInd || !questionEn) edgeError("INVALID_QUESTION_WORDING", 400);
      if (input.expectedAuthoritySha256 !== target.targetSha256) {
        edgeError("SOURCE_CHANGED_RELOAD_REQUIRED", 409);
      }
      if (!target.editable) {
        edgeError(target.blockedReason ?? "QUESTION_EDIT_NOT_SUPPORTED", 409);
      }

      let finalVersion: string;
      try {
        finalVersion = await dependencies.readDriveVersion();
      } catch (error) {
        authorityFailure(error);
      }
      if (finalVersion !== authority.driveVersion) {
        edgeError("SOURCE_CHANGED_RELOAD_REQUIRED", 409);
      }

      const saved = await dependencies.saveOverride({
        actorId: user.id,
        questionId,
        expectedContentVersion: input.expectedOverrideVersion,
        authoritySha256: target.targetSha256,
        driveVersion: authority.driveVersion,
        trustedQuestionInd: target.values.question_ind,
        trustedQuestionEn: target.values.question_en,
        questionInd,
        questionEn,
      });
      return response(origin, {
        data: {
          ...saved,
          editable: true,
          readOnlyReason: null,
          authoritySha256: target.targetSha256,
          overrideVersion: saved.contentVersion,
        },
      });
    } catch (error) {
      if (error instanceof AdminQuestionWordingError) {
        return response(origin, { error: error.code }, error.status);
      }
      return response(origin, { error: "UNEXPECTED_ERROR" }, 500);
    }
  };
}
