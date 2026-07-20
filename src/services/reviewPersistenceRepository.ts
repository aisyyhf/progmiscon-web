import type {
  AnswerReviewHistoryItem,
  AnswerReviewValues,
  QuestionReviewHistoryItem,
  QuestionReviewValues,
  ReviewerHistory,
  ReviewProgress,
} from "../types";
import { supabase } from "./supabaseClient";

type QuestionReviewProgressRow = {
  question_id: string;
};

type AnswerReviewProgressRow = {
  answer_id: string;
};

type QuestionReviewHistoryRow = {
  id: string;
  reviewer_id: string;
  question_id: string;
  has_incorrect_misconceptions: boolean;
  removed_misconception_ids: string[] | null;
  removal_reason: string | null;
  has_additional_misconceptions: boolean;
  additional_misconception_ids: string[] | null;
  addition_reason: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type AnswerReviewHistoryRow = {
  id: string;
  reviewer_id: string;
  answer_id: string;
  question_id: string;
  has_mismatched_misconceptions: boolean;
  removed_misconception_ids: string[] | null;
  removal_reason: string | null;
  has_additional_misconceptions: boolean;
  additional_misconception_ids: string[] | null;
  addition_reason: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

function storageError(scope: string, error: { message?: string }): Error {
  const detail = error.message?.trim();

  return new Error(
    detail ? `${scope} gagal: ${detail}` : `${scope} belum dapat dilakukan.`,
  );
}

function mapQuestionReviewHistory(
  row: QuestionReviewHistoryRow,
): QuestionReviewHistoryItem {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    questionId: row.question_id,
    hasIncorrectMisconceptions: row.has_incorrect_misconceptions,
    removedMisconceptionIds: row.removed_misconception_ids ?? [],
    removalReason: row.removal_reason,
    hasAdditionalMisconceptions: row.has_additional_misconceptions,
    additionalMisconceptionIds: row.additional_misconception_ids ?? [],
    additionReason: row.addition_reason,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAnswerReviewHistory(
  row: AnswerReviewHistoryRow,
): AnswerReviewHistoryItem {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    answerId: row.answer_id,
    questionId: row.question_id,
    hasMismatchedMisconceptions: row.has_mismatched_misconceptions,
    removedMisconceptionIds: row.removed_misconception_ids ?? [],
    removalReason: row.removal_reason,
    hasAdditionalMisconceptions: row.has_additional_misconceptions,
    additionalMisconceptionIds: row.additional_misconception_ids ?? [],
    additionReason: row.addition_reason,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getReviewProgress(
  reviewerId: string,
): Promise<ReviewProgress> {
  const [questionResult, answerResult] = await Promise.all([
    supabase
      .from("question_reviews")
      .select("question_id")
      .eq("reviewer_id", reviewerId),
    supabase
      .from("answer_reviews")
      .select("answer_id")
      .eq("reviewer_id", reviewerId),
  ]);

  if (questionResult.error) {
    throw storageError("Progres validasi soal dimuat", questionResult.error);
  }

  if (answerResult.error) {
    throw storageError("Progres validasi jawaban dimuat", answerResult.error);
  }

  const questionRows = (questionResult.data ??
    []) as QuestionReviewProgressRow[];

  const answerRows = (answerResult.data ?? []) as AnswerReviewProgressRow[];

  return {
    questionIds: [...new Set(questionRows.map((row) => row.question_id))],
    answerIds: [...new Set(answerRows.map((row) => row.answer_id))],
  };
}

export async function getReviewerHistory(
  reviewerId: string,
): Promise<ReviewerHistory> {
  const [questionResult, answerResult] = await Promise.all([
    supabase
      .from("question_reviews")
      .select(
        "id,reviewer_id,question_id,has_incorrect_misconceptions,removed_misconception_ids,removal_reason,has_additional_misconceptions,additional_misconception_ids,addition_reason,note,created_at,updated_at",
      )
      .eq("reviewer_id", reviewerId)
      .order("updated_at", { ascending: false }),

    supabase
      .from("answer_reviews")
      .select(
        "id,reviewer_id,answer_id,question_id,has_mismatched_misconceptions,removed_misconception_ids,removal_reason,has_additional_misconceptions,additional_misconception_ids,addition_reason,note,created_at,updated_at",
      )
      .eq("reviewer_id", reviewerId)
      .order("updated_at", { ascending: false }),
  ]);

  if (questionResult.error) {
    throw storageError("Riwayat validasi soal dimuat", questionResult.error);
  }

  if (answerResult.error) {
    throw storageError("Riwayat validasi jawaban dimuat", answerResult.error);
  }

  const questionRows = (questionResult.data ??
    []) as QuestionReviewHistoryRow[];

  const answerRows = (answerResult.data ?? []) as AnswerReviewHistoryRow[];

  return {
    questionReviews: questionRows.map(mapQuestionReviewHistory),
    answerReviews: answerRows.map(mapAnswerReviewHistory),
  };
}

export async function saveQuestionReview(
  reviewerId: string,
  questionId: string,
  values: QuestionReviewValues,
): Promise<void> {
  const { error } = await supabase.from("question_reviews").upsert(
    {
      reviewer_id: reviewerId,
      question_id: questionId,
      has_incorrect_misconceptions: values.hasIncorrectMisconceptions,
      removed_misconception_ids: values.removedMisconceptionIds,
      removal_reason: values.removalReason,
      has_additional_misconceptions: values.hasAdditionalMisconceptions,
      additional_misconception_ids: values.additionalMisconceptionIds,
      addition_reason: values.additionReason,
      note: values.note,
    },
    {
      onConflict: "reviewer_id,question_id",
    },
  );

  if (error) {
    throw storageError("Validasi soal disimpan", error);
  }
}

export async function saveAnswerReview(
  reviewerId: string,
  answerId: string,
  questionId: string,
  values: AnswerReviewValues,
): Promise<void> {
  const { error } = await supabase
    .from("answer_reviews")
    .upsert(
      {
        reviewer_id: reviewerId,
        answer_id: answerId,
        question_id: questionId,
        has_mismatched_misconceptions: values.hasMismatchedMisconceptions,
        removed_misconception_ids: values.removedMisconceptionIds,
        removal_reason: values.removalReason,
        has_additional_misconceptions: values.hasAdditionalMisconceptions,
        additional_misconception_ids: values.additionalMisconceptionIds,
        addition_reason: values.additionReason,
        note: values.note,
      },
      {
        onConflict: "reviewer_id,answer_id",
      },
    )
    .select("id,reviewer_id,answer_id,question_id,note")
    .single();

  if (error) {
    console.error("[Progmiscon] Validasi jawaban gagal disimpan", error);

    throw storageError("Validasi jawaban disimpan", error);
  }
}
