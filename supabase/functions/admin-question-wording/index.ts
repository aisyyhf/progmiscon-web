import { createClient } from "@supabase/supabase-js";
import {
  parseGoogleServiceAccountCredential,
  readGoogleDriveVersion,
  readTrustedGoogleQuestionAuthority,
  type GoogleQuestionAuthorityConfig,
} from "../_shared/googleQuestionAuthority.ts";
import {
  REVIEWED_QUESTION_IDS,
  REVIEWED_QUESTION_SOURCE,
} from "../_shared/questionAuthorityManifest.ts";
import {
  AdminQuestionWordingError,
  createAdminQuestionWordingHandler,
  type SavedOverride,
} from "./handler.ts";

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required server configuration: ${name}`);
  return value;
}

const allowedOrigin = requiredEnvironment("PROGMISCON_ALLOWED_ORIGIN");
const supabaseUrl = requiredEnvironment("SUPABASE_URL");
const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
const spreadsheetId = requiredEnvironment("PROGMISCON_GOOGLE_SPREADSHEET_ID");
const configuredSheetId = Number(
  requiredEnvironment("PROGMISCON_GOOGLE_QUESTIONS_SHEET_ID"),
);
if (configuredSheetId !== REVIEWED_QUESTION_SOURCE.questionsSheetId) {
  throw new Error("Trusted Questions sheet configuration does not match provenance");
}

const googleConfig: GoogleQuestionAuthorityConfig = {
  credential: parseGoogleServiceAccountCredential(
    requiredEnvironment("GOOGLE_SERVICE_ACCOUNT_JSON"),
  ),
  spreadsheetId,
  spreadsheetTitle: REVIEWED_QUESTION_SOURCE.spreadsheetTitle,
  sheetId: configuredSheetId,
  tab: REVIEWED_QUESTION_SOURCE.tab,
  range: REVIEWED_QUESTION_SOURCE.range,
  reviewedSourceIdentitySha256:
    REVIEWED_QUESTION_SOURCE.reviewedSourceIdentitySha256,
};
const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function databaseFailure(message: string): never {
  if (message.includes("QUESTION_OVERRIDE_STALE")) {
    throw new AdminQuestionWordingError(
      "OVERRIDE_CHANGED_RELOAD_REQUIRED",
      409,
    );
  }
  if (message.includes("QUESTION_WORDING_UNCHANGED")) {
    throw new AdminQuestionWordingError("QUESTION_WORDING_UNCHANGED", 409);
  }
  if (message.includes("INVALID_QUESTION_WORDING")) {
    throw new AdminQuestionWordingError("INVALID_QUESTION_WORDING", 400);
  }
  if (message.includes("ADMIN_ACCESS_REQUIRED")) {
    throw new AdminQuestionWordingError("FORBIDDEN", 403);
  }
  throw new Error("Trusted wording save failed");
}

const handler = createAdminQuestionWordingHandler({
  allowedOrigin,
  reviewedQuestionIds: new Set(REVIEWED_QUESTION_IDS),
  async authenticate(accessToken) {
    const { data, error } = await serviceClient.auth.getUser(accessToken);
    return error || !data.user ? null : { id: data.user.id };
  },
  async actorIsAuthorized(actorId) {
    const { data, error } = await serviceClient.rpc(
      "admin_question_wording_actor_is_authorized_v1",
      { input_actor_id: actorId },
    );
    if (error) throw new Error("Admin authorization unavailable");
    return data === true;
  },
  readAuthority: () => readTrustedGoogleQuestionAuthority(googleConfig),
  readDriveVersion: () => readGoogleDriveVersion(googleConfig),
  async loadOverride(questionId) {
    const { data, error } = await serviceClient
      .from("question_content_overrides")
      .select("question_ind,question_en,content_version,updated_at")
      .eq("question_id", questionId)
      .maybeSingle();
    if (error) throw new Error("Override state unavailable");
    if (!data) return null;
    return {
      questionInd: data.question_ind,
      questionEn: data.question_en,
      contentVersion: data.content_version,
      updatedAt: data.updated_at,
    };
  },
  async saveOverride(input): Promise<SavedOverride> {
    const { data, error } = await serviceClient.rpc(
      "admin_save_question_wording_override_v1",
      {
        input_actor_id: input.actorId,
        input_question_id: input.questionId,
        input_expected_content_version: input.expectedContentVersion,
        input_authority_sha256: input.authoritySha256,
        input_google_drive_version: input.driveVersion,
        input_trusted_question_ind: input.trustedQuestionInd,
        input_trusted_question_en: input.trustedQuestionEn,
        input_question_ind: input.questionInd,
        input_question_en: input.questionEn,
      },
    );
    if (error) databaseFailure(error.message);
    const row = (data as Array<Record<string, unknown>> | null)?.[0];
    if (
      !row ||
      typeof row.question_id !== "string" ||
      typeof row.question_ind !== "string" ||
      typeof row.question_en !== "string" ||
      typeof row.content_version !== "string" ||
      typeof row.updated_at !== "string"
    ) throw new Error("Trusted wording save returned an invalid result");
    return {
      questionId: row.question_id,
      questionInd: row.question_ind,
      questionEn: row.question_en,
      contentVersion: row.content_version,
      updatedAt: row.updated_at,
    };
  },
});

Deno.serve(handler);
