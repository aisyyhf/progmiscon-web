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
  ReviewLifecycleRow,
  ReviewProgress,
  ReviewSourceVersions,
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
import { getAnswers } from "./answerRepository";
import {
  invalidateEffectiveMasterData,
  reloadBaselineMasterData,
} from "./masterDataRepository";
import { getQuestionById, getQuestions } from "./questionRepository";
import { assertAnswerReviewEligible } from "../utils/reviewWorkspace";
import { haveSameReviewSourceVersions } from "../utils/reviewSourceVersions";
import {
  REVIEW_SESSION_EXPIRED_MESSAGE,
  ReviewSessionPreparationError,
  isReviewSessionAuthError,
  withPreparedReviewSession,
} from "./reviewSession";

type QuestionReviewHistoryRow = {
  id: string;
  reviewer_id: string;
  question_id: string;
  source_version: string;
  is_active: boolean;
  inactive_reason: string | null;
  inactive_at: string | null;
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
  source_version: string;
  is_active: boolean;
  inactive_reason: string | null;
  inactive_at: string | null;
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

type ReviewSourceVersionRow = {
  target_type: unknown;
  target_id: unknown;
  parent_question_id: unknown;
  source_version: unknown;
};

type StorageErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

const reviewErrorMessages = {
  SESSION_EXPIRED: REVIEW_SESSION_EXPIRED_MESSAGE,
  AUTH_REQUIRED: "Sesi lecturer tidak ditemukan. Silakan masuk kembali.",
  LECTURER_INACTIVE: "Akun lecturer ini tidak aktif.",
  QUESTION_NOT_FOUND: "Soal tidak ditemukan atau sudah tidak tersedia.",
  ANSWER_NOT_FOUND: "Jawaban tidak ditemukan atau sudah tidak tersedia.",
  DATA_VERSION_CHANGED:
    "Data sumber telah diperbarui. Muat ulang data lalu review kembali.",
  REVIEWER_CAP_REACHED: "Target ini sudah memiliki tiga reviewer aktif.",
  REVIEW_NOT_FOUND: "Review tidak ditemukan atau sudah tidak tersedia.",
  INVALID_REVIEW_INPUT: "Data review belum lengkap atau tidak valid.",
  REMOVAL_DETAILS_REQUIRED:
    "Pilih miskonsepsi yang dilepas dan tuliskan alasannya.",
  ADDITION_DETAILS_REQUIRED:
    "Pilih miskonsepsi yang ditambahkan dan tuliskan alasannya.",
  REMOVAL_NOT_IN_BASELINE:
    "Miskonsepsi yang akan dilepas tidak ada pada data sumber saat ini.",
  ADDITION_ALREADY_IN_BASELINE:
    "Miskonsepsi yang akan ditambahkan sudah ada pada data sumber.",
  REVIEW_SELECTION_OVERLAP:
    "Miskonsepsi yang sama tidak dapat dilepas dan ditambahkan sekaligus.",
  INVALID_MISCONCEPTION_ID: "Terdapat ID miskonsepsi yang tidak valid.",
  REVIEW_CAP_INVARIANT_BROKEN:
    "Status reviewer tidak konsisten. Muat ulang data sebelum mencoba lagi.",
} as const;

export type ReviewPersistenceErrorCode = keyof typeof reviewErrorMessages;

export class ReviewPersistenceError extends Error {
  readonly reviewCode?: ReviewPersistenceErrorCode;

  constructor(
    message: string,
    reviewCode?: ReviewPersistenceErrorCode,
  ) {
    super(message);
    this.name = "ReviewPersistenceError";
    this.reviewCode = reviewCode;
  }
}

function getReviewErrorCode(
  error: StorageErrorLike,
): ReviewPersistenceErrorCode | undefined {
  const detail = [error.code, error.message, error.details, error.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ");

  return (Object.keys(reviewErrorMessages) as ReviewPersistenceErrorCode[]).find(
    (token) => detail.includes(token),
  );
}

export function isReviewPersistenceError(
  error: unknown,
  code: ReviewPersistenceErrorCode,
): boolean {
  return error instanceof ReviewPersistenceError && error.reviewCode === code;
}

function storageError(scope: string, error: StorageErrorLike): Error {
  if (isReviewSessionAuthError(error)) {
    return new ReviewPersistenceError(
      reviewErrorMessages.SESSION_EXPIRED,
      "SESSION_EXPIRED",
    );
  }

  const reviewCode = getReviewErrorCode(error);
  if (reviewCode) {
    return new ReviewPersistenceError(
      reviewErrorMessages[reviewCode],
      reviewCode,
    );
  }

  const detail = error.message?.trim();
  return new ReviewPersistenceError(
    detail ? `${scope} gagal: ${detail}` : `${scope} belum dapat dilakukan.`,
  );
}

async function runPreparedReviewWrite<T>(
  write: () => PromiseLike<T>,
): Promise<T> {
  try {
    return await withPreparedReviewSession(supabase.auth, write);
  } catch (error) {
    if (error instanceof ReviewSessionPreparationError) {
      throw new ReviewPersistenceError(
        reviewErrorMessages.SESSION_EXPIRED,
        "SESSION_EXPIRED",
      );
    }
    throw error;
  }
}

function mapQuestionReviewHistory(
  row: QuestionReviewHistoryRow,
): QuestionReviewHistoryItem {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    questionId: row.question_id,
    sourceVersion: row.source_version,
    isActive: row.is_active,
    inactiveReason: row.inactive_reason,
    inactiveAt: row.inactive_at,
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
    sourceVersion: row.source_version,
    isActive: row.is_active,
    inactiveReason: row.inactive_reason,
    inactiveAt: row.inactive_at,
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

export async function getReviewSourceVersions(): Promise<ReviewSourceVersions> {
  const { data, error } = await supabase.rpc("get_review_source_versions");

  if (error) {
    throw storageError("Versi sumber review dimuat", error);
  }

  const questions = new Map<string, string>();
  const answers = new Map<
    string,
    { questionId: string; sourceVersion: string }
  >();

  for (const row of (data ?? []) as ReviewSourceVersionRow[]) {
    const targetType =
      typeof row.target_type === "string" ? row.target_type.trim() : "";
    const targetId =
      typeof row.target_id === "string" ? row.target_id.trim() : "";
    const parentQuestionId =
      typeof row.parent_question_id === "string"
        ? row.parent_question_id.trim()
        : "";
    const sourceVersion =
      typeof row.source_version === "string" ? row.source_version.trim() : "";

    if (!targetId || !sourceVersion) continue;

    if (targetType === "question") {
      questions.set(targetId, sourceVersion);
    } else if (targetType === "answer" && parentQuestionId) {
      answers.set(targetId, {
        questionId: parentQuestionId,
        sourceVersion,
      });
    }
  }

  return { questions, answers };
}

export async function getReviewWorkspaceSnapshot() {
  let sourceVersions = await getReviewSourceVersions();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    await reloadBaselineMasterData();
    const [questions, answers] = await Promise.all([
      getQuestions(),
      getAnswers(),
    ]);
    const confirmedSourceVersions = await getReviewSourceVersions();

    if (haveSameReviewSourceVersions(sourceVersions, confirmedSourceVersions)) {
      return {
        questions: questions.map((question) => ({
          ...question,
          sourceVersion: sourceVersions.questions.get(question.id),
        })),
        answers: answers.map((answer) => {
          const source = sourceVersions.answers.get(answer.id);
          return {
            ...answer,
            sourceVersion:
              source?.questionId === answer.questionId
                ? source.sourceVersion
                : undefined,
          };
        }),
        sourceVersions,
      };
    }

    sourceVersions = confirmedSourceVersions;
  }

  throw new Error(
    "Data sumber berubah saat workspace review dimuat. Silakan muat ulang.",
  );
}

export async function getReviewerHistory(
  reviewerId: string,
): Promise<ReviewerHistory> {
  const [questionResult, answerResult] = await Promise.all([
    supabase
      .from("question_reviews")
      .select(
        "id,reviewer_id,question_id,source_version,is_active,inactive_reason,inactive_at,has_incorrect_misconceptions,removed_misconception_ids,removal_reason,has_additional_misconceptions,additional_misconception_ids,addition_reason,note,created_at,updated_at",
      )
      .eq("reviewer_id", reviewerId)
      .order("updated_at", { ascending: false }),

    supabase
      .from("answer_reviews")
      .select(
        "id,reviewer_id,answer_id,question_id,source_version,is_active,inactive_reason,inactive_at,has_mismatched_misconceptions,removed_misconception_ids,removal_reason,has_additional_misconceptions,additional_misconception_ids,addition_reason,note,created_at,updated_at",
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
        "id,reviewer_id,question_id,source_version,is_active,inactive_reason,inactive_at,has_incorrect_misconceptions,removed_misconception_ids,removal_reason,has_additional_misconceptions,additional_misconception_ids,addition_reason,note,created_at,updated_at",
      )
      .order("updated_at", { ascending: false }),

    supabase
      .from("answer_reviews")
      .select(
        "id,reviewer_id,answer_id,question_id,source_version,is_active,inactive_reason,inactive_at,has_mismatched_misconceptions,removed_misconception_ids,removal_reason,has_additional_misconceptions,additional_misconception_ids,addition_reason,note,created_at,updated_at",
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

type ReviewLifecycleRpcRow = {
  review_type?: unknown;
  review_id?: unknown;
  last_event_type?: unknown;
  last_event_at?: unknown;
  edited?: unknown;
  last_deleted_at?: unknown;
  last_deleted_before?: unknown;
};

function mapReviewLifecycleRow(
  row: ReviewLifecycleRpcRow,
): ReviewLifecycleRow | null {
  const reviewType = row.review_type === "answer" ? "answer" : "question";
  const reviewId = typeof row.review_id === "string" ? row.review_id : "";
  if (!reviewId) return null;

  return {
    reviewType,
    reviewId,
    lastEventType:
      typeof row.last_event_type === "string" ? row.last_event_type : "",
    lastEventAt:
      typeof row.last_event_at === "string" ? row.last_event_at : null,
    edited: row.edited === true,
    lastDeletedAt:
      typeof row.last_deleted_at === "string" ? row.last_deleted_at : null,
    lastDeletedBefore:
      row.last_deleted_before && typeof row.last_deleted_before === "object"
        ? (row.last_deleted_before as Record<string, unknown>)
        : null,
  };
}

/**
 * Admin-only. Read-only lifecycle projection of review_audit_log used to label
 * "Status Review" / "Aktivitas Terakhir" and to reconstruct a deleted
 * generation that has since been reactivated. Never feeds counts or consensus.
 */
export async function getAdminReviewLifecycle(): Promise<ReviewLifecycleRow[]> {
  const { data, error } = await supabase.rpc("get_admin_review_lifecycle");

  if (error) {
    throw storageError("Riwayat siklus review Admin dimuat", error);
  }

  return ((data ?? []) as ReviewLifecycleRpcRow[])
    .map(mapReviewLifecycleRow)
    .filter((row): row is ReviewLifecycleRow => row !== null);
}

export async function saveQuestionReview(
  questionId: string,
  sourceVersion: string,
  values: QuestionReviewValues,
): Promise<void> {
  const { error } = await runPreparedReviewWrite(() =>
    supabase.rpc("save_question_review_v3", {
      p_question_id: questionId,
      p_source_version: sourceVersion,
      p_has_incorrect_misconceptions: values.hasIncorrectMisconceptions,
      p_removed_misconception_ids: values.removedMisconceptionIds,
      p_removal_reason: values.removalReason,
      p_has_additional_misconceptions: values.hasAdditionalMisconceptions,
      p_additional_misconception_ids: values.additionalMisconceptionIds,
      p_addition_reason: values.additionReason,
      p_note: values.note,
    }),
  );

  if (error) {
    throw storageError("Validasi soal disimpan", error);
  }
}

export async function saveAnswerReview(
  answerId: string,
  questionId: string,
  sourceVersion: string,
  values: AnswerReviewValues,
): Promise<void> {
  assertAnswerReviewEligible(await getQuestionById(questionId));

  const { error } = await runPreparedReviewWrite(() =>
    supabase.rpc("save_answer_review_v3", {
      p_answer_id: answerId,
      p_source_version: sourceVersion,
      p_has_mismatched_misconceptions: values.hasMismatchedMisconceptions,
      p_removed_misconception_ids: values.removedMisconceptionIds,
      p_removal_reason: values.removalReason,
      p_has_additional_misconceptions: values.hasAdditionalMisconceptions,
      p_additional_misconception_ids: values.additionalMisconceptionIds,
      p_addition_reason: values.additionReason,
      p_note: values.note,
    }),
  );

  if (error) {
    const mappedError = storageError("Validasi jawaban disimpan", error);
    console.error("[Progmiscon] Validasi jawaban gagal disimpan", mappedError);
    throw mappedError;
  }
}

export async function deleteQuestionReview(
  questionId: string,
  sourceVersion: string,
): Promise<void> {
  const { error } = await supabase.rpc("delete_question_review_v3", {
    p_question_id: questionId,
    p_source_version: sourceVersion,
  });

  if (error) {
    throw storageError("Review soal dihapus", error);
  }
}

/**
 * Resets the caller's entire review workflow for one question: their active
 * Question Review and every active Answer Review they hold for that question
 * (each matched against the answer's own current source version) are
 * deactivated in one atomic RPC, and question + answer consensus are
 * recomputed. Idempotent server-side, so a retry after a partial failure is
 * safe. `sourceVersion` is the question's source version only.
 */
export async function deleteQuestionReviewWorkflow(
  questionId: string,
  sourceVersion: string,
): Promise<void> {
  const { error } = await supabase.rpc("delete_question_review_workflow_v3", {
    p_question_id: questionId,
    p_source_version: sourceVersion,
  });

  if (error) {
    throw storageError("Review soal dihapus", error);
  }
}

export async function deleteAnswerReview(
  answerId: string,
  sourceVersion: string,
): Promise<void> {
  const { error } = await supabase.rpc("delete_answer_review_v3", {
    p_answer_id: answerId,
    p_source_version: sourceVersion,
  });

  if (error) {
    throw storageError("Review jawaban dihapus", error);
  }
}

export type QuestionReviewResetResult = {
  questionId: string;
  sourceVersion: string;
  reviewsReset: number;
  reviewersReset: number;
  overrideRemoved: boolean;
};

const questionReviewResetMessages: Record<string, string> = {
  ADMIN_ACCESS_REQUIRED:
    "Akses Admin aktif diperlukan untuk mereset review soal.",
  QUESTION_NOT_FOUND: "Soal tidak ditemukan atau sudah tidak tersedia.",
  DATA_VERSION_CHANGED:
    "Data sumber soal telah diperbarui. Muat ulang halaman sebelum mereset review.",
  INVALID_TARGET_ID: "ID soal tidak valid.",
};

/**
 * Admin-only. Deactivates EVERY reviewer's active, current-version Question
 * Review for exactly one question (is_active = false, inactive_reason =
 * 'deleted', inactive_at = now()) and recomputes question consensus, so a
 * published question override no longer backed by three active reviews is
 * removed and the effective mapping reverts to master. Never touches legacy
 * answer_reviews / answer_misconception_overrides and never changes the baseline
 * source_version; review rows keep their own source_version. Review history is
 * preserved by the existing audit trigger. `sourceVersion` is the question's
 * current source version -- a stale value fails closed (DATA_VERSION_CHANGED).
 * Invalidates the effective master-data cache so read views refresh.
 */
export async function resetQuestionReviews(
  questionId: string,
  sourceVersion: string,
): Promise<QuestionReviewResetResult> {
  const { data, error } = await supabase.rpc("reset_question_reviews_v3", {
    p_question_id: questionId,
    p_source_version: sourceVersion,
  });

  if (error) {
    const detail = [error.code, error.message, error.details, error.hint]
      .filter((value): value is string => typeof value === "string")
      .join(" ");
    const known = Object.keys(questionReviewResetMessages).find((token) =>
      detail.includes(token),
    );
    if (known) {
      throw new Error(questionReviewResetMessages[known]);
    }
    throw storageError("Reset review soal", error);
  }

  invalidateEffectiveMasterData();

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    questionId:
      typeof row.question_id === "string" ? row.question_id : questionId,
    sourceVersion:
      typeof row.source_version === "string"
        ? row.source_version
        : sourceVersion,
    reviewsReset:
      typeof row.reviews_reset === "number" ? row.reviews_reset : 0,
    reviewersReset:
      typeof row.reviewers_reset === "number" ? row.reviewers_reset : 0,
    overrideRemoved: row.override_removed === true,
  };
}
