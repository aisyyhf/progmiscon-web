import type {
  AnswerReviewValues,
  QuestionReviewValues,
  ReviewProgress,
} from "../types";
import { supabase } from "./supabaseClient";

type QuestionReviewProgressRow = {
  question_id: string;
};

type AnswerReviewProgressRow = {
  answer_id: string;
};

function storageError(scope: string, error: { message?: string }): Error {
  const detail = error.message?.trim();
  return new Error(
    detail ? `${scope} gagal: ${detail}` : `${scope} belum dapat dilakukan.`,
  );
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
    { onConflict: "reviewer_id,question_id" },
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
    .select("id, reviewer_id, answer_id, question_id, note")
    .single();

  if (error) {
    console.error("[Progmiscon] Validasi jawaban gagal disimpan", error);

    throw storageError("Validasi jawaban disimpan", error);
  }
}
