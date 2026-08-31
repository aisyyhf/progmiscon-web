import type {
  AdminAnswerReviewHistoryItem,
  AdminQuestionReviewHistoryItem,
  AdminReviewHistory,
  AdminReviewer,
  Question,
  ReviewLastActivity,
  ReviewLifecycleRow,
  ReviewLifecycleStatus,
  ReviewSourceVersions,
  StudentAnswer,
} from "../types";
import { getCanonicalMpAnswerSequence } from "./reviewWorkspace.ts";

export type CurrentAdminReviewHistory = AdminReviewHistory & {
  /**
   * Lecturer-deleted generations kept for Admin history only. Never counted as
   * active reviewers/votes and never fed to consensus.
   */
  deletedQuestionReviews: AdminQuestionReviewHistoryItem[];
  deletedAnswerReviews: AdminAnswerReviewHistoryItem[];
  excluded: {
    inactive: number;
    staleOrUnverifiable: number;
  };
};

export type AdminAnswerReviewEntry = {
  answer: StudentAnswer;
  review: AdminAnswerReviewHistoryItem;
};

export type AdminReviewerReviewGroup = {
  reviewer: AdminReviewer;
  questionReview?: AdminQuestionReviewHistoryItem;
  answerReviews: AdminAnswerReviewEntry[];
};

export type AdminQuestionReviewGroup = {
  question: Question;
  reviewers: AdminReviewerReviewGroup[];
  /** Lecturer-deleted generations, shown as history and excluded from counts. */
  deletedReviewers: AdminReviewerReviewGroup[];
};

export type ReviewLifecycleLabels = {
  status: ReviewLifecycleStatus;
  lastActivity: ReviewLastActivity;
};

const DELETED_INACTIVE_REASON = "deleted";
const SOURCE_UPDATED_INACTIVE_REASON = "source_updated";

/**
 * Maps review-id -> lifecycle projection. Used only to label generations; a
 * missing entry (no audit rows yet) falls back to the row's own state.
 */
export function indexReviewLifecycle(
  rows: readonly ReviewLifecycleRow[],
): Map<string, ReviewLifecycleRow> {
  return new Map(rows.map((row) => [row.reviewId, row]));
}

/**
 * "Status Review" / "Aktivitas Terakhir" for one review generation.
 *  - active + never edited -> active / created
 *  - active + edited       -> active / edited   (edited is an activity, not a status)
 *  - lecturer-deleted      -> deleted / deleted
 * A `reactivated` last event on an active row reads as `created` (a fresh
 * generation), never as `deleted`.
 */
export function resolveReviewLifecycleLabels(
  review: { id: string; isActive: boolean; inactiveReason: string | null },
  lifecycleByReviewId: ReadonlyMap<string, ReviewLifecycleRow>,
): ReviewLifecycleLabels {
  if (!review.isActive && review.inactiveReason === DELETED_INACTIVE_REASON) {
    return { status: "deleted", lastActivity: "deleted" };
  }

  const lifecycle = lifecycleByReviewId.get(review.id);
  return {
    status: "active",
    lastActivity: lifecycle?.edited ? "edited" : "created",
  };
}

function questionReviewFromSnapshot(
  lifecycle: ReviewLifecycleRow,
  reviewer: AdminReviewer,
): AdminQuestionReviewHistoryItem | null {
  const snapshot = lifecycle.lastDeletedBefore;
  if (!snapshot) return null;
  const questionId =
    typeof snapshot.question_id === "string" ? snapshot.question_id : "";
  if (!questionId) return null;

  return {
    id: lifecycle.reviewId,
    reviewerId: reviewer.reviewerId,
    questionId,
    sourceVersion:
      typeof snapshot.source_version === "string" ? snapshot.source_version : "",
    isActive: false,
    inactiveReason: DELETED_INACTIVE_REASON,
    inactiveAt: lifecycle.lastDeletedAt,
    hasIncorrectMisconceptions: snapshot.has_incorrect_misconceptions === true,
    removedMisconceptionIds: toStringArray(snapshot.removed_misconception_ids),
    removalReason:
      typeof snapshot.removal_reason === "string" ? snapshot.removal_reason : null,
    hasAdditionalMisconceptions: snapshot.has_additional_misconceptions === true,
    additionalMisconceptionIds: toStringArray(
      snapshot.additional_misconception_ids,
    ),
    additionReason:
      typeof snapshot.addition_reason === "string"
        ? snapshot.addition_reason
        : null,
    note: typeof snapshot.note === "string" ? snapshot.note : null,
    createdAt:
      typeof snapshot.created_at === "string"
        ? snapshot.created_at
        : (lifecycle.lastDeletedAt ?? ""),
    updatedAt: lifecycle.lastDeletedAt ?? "",
    fullName: reviewer.fullName,
    email: reviewer.email,
  };
}

function answerReviewFromSnapshot(
  lifecycle: ReviewLifecycleRow,
  reviewer: AdminReviewer,
): AdminAnswerReviewHistoryItem | null {
  const snapshot = lifecycle.lastDeletedBefore;
  if (!snapshot) return null;
  const answerId =
    typeof snapshot.answer_id === "string" ? snapshot.answer_id : "";
  const questionId =
    typeof snapshot.question_id === "string" ? snapshot.question_id : "";
  if (!answerId || !questionId) return null;

  return {
    id: lifecycle.reviewId,
    reviewerId: reviewer.reviewerId,
    answerId,
    questionId,
    sourceVersion:
      typeof snapshot.source_version === "string" ? snapshot.source_version : "",
    isActive: false,
    inactiveReason: DELETED_INACTIVE_REASON,
    inactiveAt: lifecycle.lastDeletedAt,
    hasMismatchedMisconceptions: snapshot.has_mismatched_misconceptions === true,
    removedMisconceptionIds: toStringArray(snapshot.removed_misconception_ids),
    removalReason:
      typeof snapshot.removal_reason === "string" ? snapshot.removal_reason : null,
    hasAdditionalMisconceptions: snapshot.has_additional_misconceptions === true,
    additionalMisconceptionIds: toStringArray(
      snapshot.additional_misconception_ids,
    ),
    additionReason:
      typeof snapshot.addition_reason === "string"
        ? snapshot.addition_reason
        : null,
    note: typeof snapshot.note === "string" ? snapshot.note : null,
    createdAt:
      typeof snapshot.created_at === "string"
        ? snapshot.created_at
        : (lifecycle.lastDeletedAt ?? ""),
    updatedAt: lifecycle.lastDeletedAt ?? "",
    fullName: reviewer.fullName,
    email: reviewer.email,
  };
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

/**
 * Splits raw Admin review history into current-active (matching the current
 * source version), lecturer-deleted (kept for Admin history), and excluded
 * (inactive-for-any-other-reason or stale/unverifiable). Deleted generations
 * that were later reactivated -- whose live row is now active -- are
 * reconstructed from `lifecycleRows` before-images so Admin can still see the
 * old generation.
 */
export function filterCurrentAdminReviewHistory(
  history: AdminReviewHistory,
  sourceVersions: ReviewSourceVersions,
  lifecycleRows: readonly ReviewLifecycleRow[] = [],
): CurrentAdminReviewHistory {
  let inactive = 0;
  let staleOrUnverifiable = 0;

  const deletedQuestionReviews: AdminQuestionReviewHistoryItem[] = [];
  const deletedAnswerReviews: AdminAnswerReviewHistoryItem[] = [];

  const questionReviews = history.questionReviews.filter((review) => {
    if (!review.isActive) {
      if (review.inactiveReason === DELETED_INACTIVE_REASON) {
        deletedQuestionReviews.push(review);
      } else {
        inactive += 1;
      }
      return false;
    }
    if (sourceVersions.questions.get(review.questionId) !== review.sourceVersion) {
      staleOrUnverifiable += 1;
      return false;
    }
    return true;
  });

  const answerReviews = history.answerReviews.filter((review) => {
    if (!review.isActive) {
      if (review.inactiveReason === DELETED_INACTIVE_REASON) {
        deletedAnswerReviews.push(review);
      } else {
        inactive += 1;
      }
      return false;
    }
    const source = sourceVersions.answers.get(review.answerId);
    if (
      source?.questionId !== review.questionId ||
      source.sourceVersion !== review.sourceVersion
    ) {
      staleOrUnverifiable += 1;
      return false;
    }
    return true;
  });

  const reviewerById = new Map(
    history.reviewers.map((reviewer) => [reviewer.reviewerId, reviewer]),
  );
  const liveDeletedReviewIds = new Set([
    ...deletedQuestionReviews.map((review) => review.id),
    ...deletedAnswerReviews.map((review) => review.id),
  ]);

  for (const lifecycle of lifecycleRows) {
    if (!lifecycle.lastDeletedBefore || !lifecycle.lastDeletedAt) continue;
    // The current row already carries this deleted generation (not reactivated).
    if (liveDeletedReviewIds.has(lifecycle.reviewId)) continue;
    const snapshot = lifecycle.lastDeletedBefore;
    const reviewerId =
      typeof snapshot.reviewer_id === "string" ? snapshot.reviewer_id : "";
    const reviewer = reviewerById.get(reviewerId) ?? {
      reviewerId,
      fullName: reviewerId,
      email: "",
    };
    if (lifecycle.reviewType === "question") {
      const reconstructed = questionReviewFromSnapshot(lifecycle, reviewer);
      if (reconstructed) deletedQuestionReviews.push(reconstructed);
    } else {
      const reconstructed = answerReviewFromSnapshot(lifecycle, reviewer);
      if (reconstructed) deletedAnswerReviews.push(reconstructed);
    }
  }

  const activeReviewerIds = new Set([
    ...questionReviews.map((review) => review.reviewerId),
    ...answerReviews.map((review) => review.reviewerId),
  ]);
  const historyReviewerIds = new Set([
    ...activeReviewerIds,
    ...deletedQuestionReviews.map((review) => review.reviewerId),
    ...deletedAnswerReviews.map((review) => review.reviewerId),
  ]);

  return {
    questionReviews,
    answerReviews,
    deletedQuestionReviews,
    deletedAnswerReviews,
    reviewers: history.reviewers.filter((reviewer) =>
      historyReviewerIds.has(reviewer.reviewerId),
    ),
    excluded: { inactive, staleOrUnverifiable },
  };
}

export function filterCurrentAdminReviewsToVisibleTargets(
  current: CurrentAdminReviewHistory,
  questions: readonly Question[],
  answers: readonly StudentAnswer[],
): CurrentAdminReviewHistory {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const answerById = new Map(answers.map((answer) => [answer.id, answer]));
  const keepQuestionReview = (review: AdminQuestionReviewHistoryItem) =>
    questionById.has(review.questionId);
  const keepAnswerReview = (review: AdminAnswerReviewHistoryItem) => {
    const question = questionById.get(review.questionId);
    const answer = answerById.get(review.answerId);
    return (
      question?.type === "multiple_choice" &&
      answer?.questionId === review.questionId &&
      answer.answerRole === "mp_option"
    );
  };

  const questionReviews = current.questionReviews.filter(keepQuestionReview);
  const answerReviews = current.answerReviews.filter(keepAnswerReview);
  const deletedQuestionReviews =
    current.deletedQuestionReviews.filter(keepQuestionReview);
  const deletedAnswerReviews =
    current.deletedAnswerReviews.filter(keepAnswerReview);
  const currentReviewerIds = new Set([
    ...questionReviews.map((review) => review.reviewerId),
    ...answerReviews.map((review) => review.reviewerId),
    ...deletedQuestionReviews.map((review) => review.reviewerId),
    ...deletedAnswerReviews.map((review) => review.reviewerId),
  ]);

  return {
    ...current,
    questionReviews,
    answerReviews,
    deletedQuestionReviews,
    deletedAnswerReviews,
    reviewers: current.reviewers.filter((reviewer) =>
      currentReviewerIds.has(reviewer.reviewerId),
    ),
    excluded: {
      ...current.excluded,
      staleOrUnverifiable:
        current.excluded.staleOrUnverifiable +
        current.questionReviews.length -
        questionReviews.length +
        current.answerReviews.length -
        answerReviews.length,
    },
  };
}

function newestByUpdatedAt<T extends { updatedAt: string }>(left: T, right: T): T {
  return right.updatedAt.localeCompare(left.updatedAt) > 0 ? right : left;
}

function reviewerFromReview(
  review: AdminQuestionReviewHistoryItem | AdminAnswerReviewHistoryItem,
): AdminReviewer {
  return {
    reviewerId: review.reviewerId,
    fullName: review.fullName,
    email: review.email,
  };
}

function buildReviewerGroups(
  questionId: string,
  questionReviews: readonly AdminQuestionReviewHistoryItem[],
  answerReviews: readonly AdminAnswerReviewHistoryItem[],
  answers: readonly StudentAnswer[],
  reviewerById: ReadonlyMap<string, AdminReviewer>,
): AdminReviewerReviewGroup[] {
  const answerById = new Map(answers.map((answer) => [answer.id, answer]));
  const questionReviewByReviewer = new Map<string, AdminQuestionReviewHistoryItem>();
  const answerReviewByKey = new Map<string, AdminAnswerReviewHistoryItem>();
  const localReviewerById = new Map(reviewerById);

  for (const review of questionReviews) {
    if (review.questionId !== questionId) continue;
    const existing = questionReviewByReviewer.get(review.reviewerId);
    questionReviewByReviewer.set(
      review.reviewerId,
      existing ? newestByUpdatedAt(existing, review) : review,
    );
    if (!localReviewerById.has(review.reviewerId)) {
      localReviewerById.set(review.reviewerId, reviewerFromReview(review));
    }
  }

  for (const review of answerReviews) {
    if (review.questionId !== questionId) continue;
    const answer = answerById.get(review.answerId);
    if (answer?.questionId !== questionId || answer.answerRole !== "mp_option") {
      continue;
    }
    const key = `${review.answerId} | ${review.reviewerId}`;
    const existing = answerReviewByKey.get(key);
    answerReviewByKey.set(
      key,
      existing ? newestByUpdatedAt(existing, review) : review,
    );
    if (!localReviewerById.has(review.reviewerId)) {
      localReviewerById.set(review.reviewerId, reviewerFromReview(review));
    }
  }

  const canonicalAnswers = getCanonicalMpAnswerSequence(questionId, answers);
  const reviewerIds = new Set<string>([
    ...questionReviewByReviewer.keys(),
    ...[...answerReviewByKey.values()].map((review) => review.reviewerId),
  ]);

  const groups = [...reviewerIds].flatMap((reviewerId) => {
    const reviewer = localReviewerById.get(reviewerId);
    if (!reviewer) return [];
    const questionReview = questionReviewByReviewer.get(reviewerId);
    const entries = canonicalAnswers.flatMap((answer) => {
      const review = answerReviewByKey.get(`${answer.id} | ${reviewerId}`);
      return review ? [{ answer, review }] : [];
    });
    return [{ reviewer, questionReview, answerReviews: entries }];
  });

  groups.sort((left, right) =>
    (left.reviewer.fullName || left.reviewer.email).localeCompare(
      right.reviewer.fullName || right.reviewer.email,
    ),
  );
  return groups;
}

export function groupCurrentAdminReviews(
  current: CurrentAdminReviewHistory,
  questions: readonly Question[],
  answers: readonly StudentAnswer[],
): AdminQuestionReviewGroup[] {
  const reviewerById = new Map(
    current.reviewers.map((reviewer) => [reviewer.reviewerId, reviewer]),
  );

  return questions.flatMap((question) => {
    const reviewers = buildReviewerGroups(
      question.id,
      current.questionReviews,
      current.answerReviews,
      answers,
      reviewerById,
    );
    const deletedReviewers = buildReviewerGroups(
      question.id,
      current.deletedQuestionReviews,
      current.deletedAnswerReviews,
      answers,
      reviewerById,
    );
    return reviewers.length > 0 || deletedReviewers.length > 0
      ? [{ question, reviewers, deletedReviewers }]
      : [];
  });
}

export function countCurrentAdminReviewRows(
  groups: readonly AdminQuestionReviewGroup[],
) {
  let questionReviews = 0;
  let answerReviews = 0;
  const reviewers = new Set<string>();

  for (const group of groups) {
    for (const reviewerGroup of group.reviewers) {
      reviewers.add(reviewerGroup.reviewer.reviewerId);
      if (reviewerGroup.questionReview) questionReviews += 1;
      answerReviews += reviewerGroup.answerReviews.length;
    }
  }

  return {
    questions: groups.filter((group) => group.reviewers.length > 0).length,
    reviewers: reviewers.size,
    questionReviews,
    answerReviews,
    totalReviews: questionReviews + answerReviews,
  };
}

export { SOURCE_UPDATED_INACTIVE_REASON };
