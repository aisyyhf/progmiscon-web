import type { AdminReviewConsensusItem } from "../types";
import { buildConsensusSnapshot } from "../utils/effectiveMasterData";
import { invalidateEffectiveMasterData } from "./masterDataRepository";
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
