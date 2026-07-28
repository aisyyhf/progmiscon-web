import type {
  AdminAnswerReviewHistoryItem,
  AdminQuestionReviewHistoryItem,
  AdminReviewer,
  AdminReviewHistory,
  AnswerReviewCount,
  AnswerReviewHistoryItem,
  AnswerReviewValues,
  QuestionReviewHistoryItem,
  QuestionReviewCount,
  QuestionReviewValues,
  ReviewerHistory,
  ReviewProgress,
} from "../types";
import {
  mapReviewStatusRow,
  type ReviewStatusRow,
} from "../utils/reviewStatus";
import {
  mapAnswerReviewCountRows,
  mapQuestionReviewCountRows,
} from "../utils/questionReviewCounts";
import { supabase } from "./supabaseClient";

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

type ReviewerProfileRow = {
  user_id: string;
  full_name: string;
  email: string;
};

const REVIEW_ALREADY_SUBMITTED = "REVIEW_ALREADY_SUBMITTED";
const REVIEW_CAP_REACHED = "REVIEW_CAP_REACHED";

function storageError(scope: string, error: { message?: string }): Error {
  const detail = error.message?.trim();

  if (detail?.includes(REVIEW_ALREADY_SUBMITTED)) {
    return new Error(
      "Review ini sudah pernah dikirim dan tidak dapat dikirim ulang.",
    );
  }

  if (detail?.includes(REVIEW_CAP_REACHED)) {
    return new Error(
      "Target ini sudah memiliki tiga reviewer. Review keempat tidak dapat disimpan.",
    );
  }

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

function mapReviewer(row: ReviewerProfileRow): AdminReviewer {
  return {
    reviewerId: row.user_id,
    fullName: row.full_name,
    email: row.email,
  };
}

function mapAdminQuestionReviewHistory(
  row: QuestionReviewHistoryRow,
  reviewers: Map<string, AdminReviewer>,
): AdminQuestionReviewHistoryItem {
  const reviewer = reviewers.get(row.reviewer_id);

  return {
    ...mapQuestionReviewHistory(row),
    fullName: reviewer?.fullName ?? row.reviewer_id,
    email: reviewer?.email ?? "",
  };
}

function mapAdminAnswerReviewHistory(
  row: AnswerReviewHistoryRow,
  reviewers: Map<string, AdminReviewer>,
): AdminAnswerReviewHistoryItem {
  const reviewer = reviewers.get(row.reviewer_id);

  return {
    ...mapAnswerReviewHistory(row),
    fullName: reviewer?.fullName ?? row.reviewer_id,
    email: reviewer?.email ?? "",
  };
}

export async function getReviewProgress(): Promise<ReviewProgress> {
  const { data, error } = await supabase.rpc("get_my_review_status");

  if (error) {
    throw storageError("Progres validasi dimuat", error);
  }

  return mapReviewStatusRow((data?.[0] as ReviewStatusRow | undefined) ?? null);
}

export async function getQuestionReviewCounts(): Promise<
  QuestionReviewCount[]
> {
  const { data, error } = await supabase.rpc("get_question_review_counts");

  if (error) {
    throw storageError("Status agregat review soal dimuat", error);
  }

  return mapQuestionReviewCountRows(data);
}

export async function getAnswerReviewCounts(): Promise<AnswerReviewCount[]> {
  const { data, error } = await supabase.rpc("get_answer_review_counts");

  if (error) {
    throw storageError("Status agregat review jawaban dimuat", error);
  }

  return mapAnswerReviewCountRows(data);
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

export async function getAdminReviewHistory(): Promise<AdminReviewHistory> {
  const [questionResult, answerResult] = await Promise.all([
    supabase
      .from("question_reviews")
      .select(
        "id,reviewer_id,question_id,has_incorrect_misconceptions,removed_misconception_ids,removal_reason,has_additional_misconceptions,additional_misconception_ids,addition_reason,note,created_at,updated_at",
      )
      .order("updated_at", { ascending: false }),

    supabase
      .from("answer_reviews")
      .select(
        "id,reviewer_id,answer_id,question_id,has_mismatched_misconceptions,removed_misconception_ids,removal_reason,has_additional_misconceptions,additional_misconception_ids,addition_reason,note,created_at,updated_at",
      )
      .order("updated_at", { ascending: false }),
  ]);

  if (questionResult.error) {
    throw storageError("Riwayat validasi soal Admin dimuat", questionResult.error);
  }

  if (answerResult.error) {
    throw storageError("Riwayat validasi jawaban Admin dimuat", answerResult.error);
  }

  const questionRows = (questionResult.data ??
    []) as QuestionReviewHistoryRow[];
  const answerRows = (answerResult.data ??
    []) as AnswerReviewHistoryRow[];
  const reviewerIds = [
    ...new Set([
      ...questionRows.map((row) => row.reviewer_id),
      ...answerRows.map((row) => row.reviewer_id),
    ]),
  ];

  let reviewers: AdminReviewer[] = [];

  if (reviewerIds.length > 0) {
    const { data, error } = await supabase.rpc(
      "get_admin_reviewer_profiles",
      { input_reviewer_ids: reviewerIds },
    );

    if (error) {
      throw storageError("Profil reviewer Admin dimuat", error);
    }

    reviewers = ((data ?? []) as ReviewerProfileRow[])
      .map(mapReviewer)
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }

  const reviewerMap = new Map(
    reviewers.map((reviewer) => [reviewer.reviewerId, reviewer]),
  );

  return {
    questionReviews: questionRows.map((row) =>
      mapAdminQuestionReviewHistory(row, reviewerMap),
    ),
    answerReviews: answerRows.map((row) =>
      mapAdminAnswerReviewHistory(row, reviewerMap),
    ),
    reviewers,
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
