import type {
  AdminReviewConsensusItem,
  MasterBaselineSyncResult,
  MasterData,
  QuestionWordingAuthorityState,
  SaveQuestionWordingOverrideInput,
  SaveQuestionWordingOverrideResult,
} from "../types";
import {
  buildConsensusSnapshot,
  normalizeEffectiveIds,
} from "../utils/effectiveMasterData";
import { isActiveValue } from "../utils/masterDataValidation";
import {
  invalidateEffectiveMasterData,
  reloadBaselineMasterData,
} from "./masterDataRepository";
import { supabase } from "./supabaseClient";
import { getAnswers } from "./answerRepository";
import { getQuestions } from "./questionRepository";
import {
  assertAnswerReviewEligible,
  filterAdminReviewConsensusItems,
} from "../utils/reviewWorkspace";

type AdminReviewConsensusRow = {
  target_type: "question" | "answer";
  target_id: string;
  question_id: string;
  review_count: number;
  removed_votes: Record<string, number> | null;
  additional_votes: Record<string, number> | null;
  published_misconception_ids: string[] | null;
  published_at: string | null;
  baseline_misconception_ids: string[] | null;
  baseline_synced_at: string | null;
};

type MasterBaselineSyncRow = {
  question_count: number;
  answer_count: number;
  misconception_count: number;
  synced_at: string;
};

type QuestionWordingFunctionEnvelope = {
  data?: unknown;
  error?: unknown;
};

export class QuestionWordingRequestError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = "QuestionWordingRequestError";
    this.code = code;
  }
}

function adminError(scope: string, error: { message?: string }): Error {
  const detail = error.message?.trim() ?? "";
  if (detail.includes("CONSENSUS_REQUIRES_THREE_REVIEWERS")) {
    return new Error("Target harus memiliki tepat tiga reviewer sebelum dipublikasikan.");
  }
  if (detail.includes("ADMIN_ACCESS_REQUIRED")) {
    return new Error("Akses Admin aktif diperlukan untuk tindakan ini.");
  }
  if (detail.includes("BASELINE_NOT_SYNCED")) {
    return new Error(
      "Baseline target belum disinkronkan. Sinkronkan baseline melalui halaman Admin terlebih dahulu.",
    );
  }
  if (detail.includes("INVALID_MISCONCEPTION_ID")) {
    return new Error("Review memuat ID misconception yang tidak ada di katalog baseline.");
  }
  return new Error(detail ? `${scope} gagal: ${detail}` : `${scope} gagal.`);
}

async function runAdminMutation(
  name: string,
  args: Record<string, unknown>,
  scope: string,
): Promise<void> {
  const { error } = await supabase.rpc(name, args);
  if (error) throw adminError(scope, error);
  invalidateEffectiveMasterData();
}

export async function getAdminReviewConsensus(): Promise<
  AdminReviewConsensusItem[]
> {
  const { data, error } = await supabase.rpc("get_admin_review_consensus");
  if (error) throw adminError("Consensus review dimuat", error);

  const items = ((data ?? []) as AdminReviewConsensusRow[]).map((row) => ({
    targetType: row.target_type,
    targetId: row.target_id,
    questionId: row.question_id,
    reviewCount: row.review_count,
    removedVotes: row.removed_votes ?? {},
    additionalVotes: row.additional_votes ?? {},
    publishedMisconceptionIds: row.published_misconception_ids,
    publishedAt: row.published_at,
    baselineMisconceptionIds: row.baseline_misconception_ids,
    baselineSyncedAt: row.baseline_synced_at,
  }));
  const questions = await getQuestions();
  return filterAdminReviewConsensusItems(
    items,
    new Map(questions.map((question) => [question.id, question])),
  );
}

export function previewConsensus(
  baselineIds: string[],
  item: AdminReviewConsensusItem,
): string[] {
  return buildConsensusSnapshot(
    baselineIds,
    item.removedVotes,
    item.additionalVotes,
  );
}

export async function publishQuestionMisconceptionOverride(
  questionId: string,
): Promise<void> {
  await runAdminMutation(
    "publish_question_misconception_override",
    { input_question_id: questionId },
    "Relasi soal dipublikasikan",
  );
}

async function assertReviewableAnswerId(answerId: string): Promise<void> {
  const [answers, questions] = await Promise.all([getAnswers(), getQuestions()]);
  const answer = answers.find((item) => item.id === answerId);
  assertAnswerReviewEligible(
    questions.find((question) => question.id === answer?.questionId),
  );
}

export async function publishAnswerMisconceptionOverride(
  answerId: string,
): Promise<void> {
  await assertReviewableAnswerId(answerId);

  await runAdminMutation(
    "publish_answer_misconception_override",
    { input_answer_id: answerId },
    "Relasi jawaban dipublikasikan",
  );
}

export async function syncMasterRelationBaselines(): Promise<MasterBaselineSyncResult> {
  const masterData: MasterData = await reloadBaselineMasterData();
  const misconceptionIds = normalizeEffectiveIds(
    masterData.misconceptions
      .filter((item) => isActiveValue(item.active))
      .map((item) => item.misconception_id),
  );
  const activeQuestionIds = new Set(
    masterData.questions
      .filter((item) => isActiveValue(item.active))
      .map((item) => item.question_id.trim()),
  );
  const questionRelations = new Map(
    [...activeQuestionIds].map((questionId) => [questionId, [] as string[]]),
  );
  for (const relation of masterData.questionMisconceptions) {
    const questionId = relation.question_id.trim();
    if (isActiveValue(relation.active) && questionRelations.has(questionId)) {
      questionRelations.get(questionId)!.push(relation.misconception_id);
    }
  }

  const answerRelations = new Map<string, { questionId: string; ids: string[] }>();
  for (const answer of masterData.answers) {
    const answerId = answer.answer_id.trim();
    const questionId = answer.question_id.trim();
    if (
      isActiveValue(answer.active)
      && activeQuestionIds.has(questionId)
      && answerId
    ) {
      answerRelations.set(answerId, { questionId, ids: [] });
    }
  }
  for (const relation of masterData.answerMisconceptions) {
    const entry = answerRelations.get(relation.answer_id.trim());
    if (entry && isActiveValue(relation.active)) {
      entry.ids.push(relation.misconception_id);
    }
  }

  const { data, error } = await supabase.rpc("sync_master_relation_baselines", {
    input_question_baselines: [...questionRelations].map(
      ([question_id, ids]) => ({
        question_id,
        misconception_ids: normalizeEffectiveIds(ids),
      }),
    ),
    input_answer_baselines: [...answerRelations].map(
      ([answer_id, entry]) => ({
        answer_id,
        question_id: entry.questionId,
        misconception_ids: normalizeEffectiveIds(entry.ids),
      }),
    ),
    input_misconception_ids: misconceptionIds,
  });
  if (error) throw adminError("Baseline Google Sheets disinkronkan", error);

  const row = ((data ?? []) as MasterBaselineSyncRow[])[0];
  if (!row) throw new Error("Sinkronisasi baseline tidak mengembalikan hasil.");
  return {
    questionCount: row.question_count,
    answerCount: row.answer_count,
    misconceptionCount: row.misconception_count,
    syncedAt: row.synced_at,
  };
}

async function functionErrorCode(error: unknown): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context instanceof Response) {
    try {
      const payload = await context.clone().json() as QuestionWordingFunctionEnvelope;
      if (typeof payload.error === "string") return payload.error;
    } catch {
      // The UI receives only the stable fallback code below.
    }
  }
  return "UNEXPECTED_ERROR";
}

function authorityState(value: unknown): QuestionWordingAuthorityState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new QuestionWordingRequestError("UNEXPECTED_ERROR");
  }
  const row = value as Record<string, unknown>;
  if (
    typeof row.questionId !== "string"
    || typeof row.questionInd !== "string"
    || typeof row.questionEn !== "string"
    || typeof row.editable !== "boolean"
    || (row.readOnlyReason !== null && typeof row.readOnlyReason !== "string")
    || typeof row.authoritySha256 !== "string"
    || !/^[0-9a-f]{64}$/.test(row.authoritySha256)
    || (row.overrideVersion !== null && typeof row.overrideVersion !== "string")
    || (row.updatedAt !== null && typeof row.updatedAt !== "string")
  ) throw new QuestionWordingRequestError("UNEXPECTED_ERROR");

  return {
    questionId: row.questionId,
    questionInd: row.questionInd,
    questionEn: row.questionEn,
    editable: row.editable,
    readOnlyReason: row.readOnlyReason,
    authoritySha256: row.authoritySha256,
    overrideVersion: row.overrideVersion,
    updatedAt: row.updatedAt,
  };
}

async function invokeQuestionWording(
  body: Record<string, unknown>,
): Promise<QuestionWordingAuthorityState> {
  const { data, error } = await supabase.functions.invoke(
    "admin-question-wording",
    { body },
  );
  if (error) throw new QuestionWordingRequestError(await functionErrorCode(error));
  const envelope = data as QuestionWordingFunctionEnvelope | null;
  if (typeof envelope?.error === "string") {
    throw new QuestionWordingRequestError(envelope.error);
  }
  return authorityState(envelope?.data);
}

export async function loadQuestionWordingAuthority(
  questionId: string,
): Promise<QuestionWordingAuthorityState> {
  return invokeQuestionWording({ action: "load", questionId });
}

export async function saveQuestionWordingOverride(
  input: SaveQuestionWordingOverrideInput,
): Promise<SaveQuestionWordingOverrideResult> {
  const result = await invokeQuestionWording({
    action: "save",
    questionId: input.questionId,
    expectedAuthoritySha256: input.expectedAuthoritySha256,
    expectedOverrideVersion: input.expectedOverrideVersion,
    questionInd: input.questionInd,
    questionEn: input.questionEn,
  });
  invalidateEffectiveMasterData();
  return result;
}

export async function saveQuestionContentOverride(
  questionId: string,
  questionInd: string,
  questionEn: string,
  questionCode: string,
): Promise<void> {
  await runAdminMutation(
    "save_question_content_override",
    {
      input_question_id: questionId,
      input_question_ind: questionInd,
      input_question_en: questionEn,
      input_question_code: questionCode,
    },
    "Konten soal disimpan",
  );
}

export async function saveAnswerContentOverride(
  answerId: string,
  answerText: string,
): Promise<void> {
  await runAdminMutation(
    "save_answer_content_override",
    { input_answer_id: answerId, input_answer_text: answerText },
    "Konten jawaban disimpan",
  );
}

export async function resetQuestionContentOverride(
  questionId: string,
): Promise<void> {
  await runAdminMutation(
    "reset_question_content_override",
    { input_question_id: questionId },
    "Override konten soal dihapus",
  );
}

export async function resetAnswerContentOverride(
  answerId: string,
): Promise<void> {
  await runAdminMutation(
    "reset_answer_content_override",
    { input_answer_id: answerId },
    "Override konten jawaban dihapus",
  );
}

export async function resetQuestionMisconceptionOverride(
  questionId: string,
): Promise<void> {
  await runAdminMutation(
    "reset_question_misconception_override",
    { input_question_id: questionId },
    "Override relasi soal dihapus",
  );
}

export async function resetAnswerMisconceptionOverride(
  answerId: string,
): Promise<void> {
  await assertReviewableAnswerId(answerId);
  await runAdminMutation(
    "reset_answer_misconception_override",
    { input_answer_id: answerId },
    "Override relasi jawaban dihapus",
  );
}
