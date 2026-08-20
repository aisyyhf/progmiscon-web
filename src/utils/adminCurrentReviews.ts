import type {
  AdminAnswerReviewHistoryItem,
  AdminQuestionReviewHistoryItem,
  AdminReviewHistory,
  AdminReviewer,
  Question,
  ReviewSourceVersions,
  StudentAnswer,
} from "../types";
import { getCanonicalMpAnswerSequence } from "./reviewWorkspace.ts";

export type CurrentAdminReviewHistory = AdminReviewHistory & {
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
};

export function filterCurrentAdminReviewHistory(
  history: AdminReviewHistory,
  sourceVersions: ReviewSourceVersions,
): CurrentAdminReviewHistory {
  let inactive = 0;
  let staleOrUnverifiable = 0;

  const questionReviews = history.questionReviews.filter((review) => {
    if (!review.isActive) {
      inactive += 1;
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
      inactive += 1;
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

  const currentReviewerIds = new Set([
    ...questionReviews.map((review) => review.reviewerId),
    ...answerReviews.map((review) => review.reviewerId),
  ]);

  return {
    questionReviews,
    answerReviews,
    reviewers: history.reviewers.filter((reviewer) =>
      currentReviewerIds.has(reviewer.reviewerId),
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
  const questionReviews = current.questionReviews.filter((review) =>
    questionById.has(review.questionId),
  );
  const answerReviews = current.answerReviews.filter((review) => {
    const question = questionById.get(review.questionId);
    const answer = answerById.get(review.answerId);
    return (
      question?.type === "multiple_choice" &&
      answer?.questionId === review.questionId &&
      answer.answerRole === "mp_option"
    );
  });
  const currentReviewerIds = new Set([
    ...questionReviews.map((review) => review.reviewerId),
    ...answerReviews.map((review) => review.reviewerId),
  ]);

  return {
    ...current,
    questionReviews,
    answerReviews,
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

export function groupCurrentAdminReviews(
  current: CurrentAdminReviewHistory,
  questions: readonly Question[],
  answers: readonly StudentAnswer[],
): AdminQuestionReviewGroup[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  const answerById = new Map(answers.map((answer) => [answer.id, answer]));
  const reviewerById = new Map(
    current.reviewers.map((reviewer) => [reviewer.reviewerId, reviewer]),
  );
  const questionReviewByKey = new Map<string, AdminQuestionReviewHistoryItem>();
  const answerReviewByKey = new Map<string, AdminAnswerReviewHistoryItem>();

  for (const review of current.questionReviews) {
    if (!questionById.has(review.questionId)) continue;
    const key = `${review.questionId}\u0000${review.reviewerId}`;
    const existing = questionReviewByKey.get(key);
    questionReviewByKey.set(key, existing ? newestByUpdatedAt(existing, review) : review);
    if (!reviewerById.has(review.reviewerId)) {
      reviewerById.set(review.reviewerId, reviewerFromReview(review));
    }
  }

  for (const review of current.answerReviews) {
    const question = questionById.get(review.questionId);
    const answer = answerById.get(review.answerId);
    if (
      question?.type !== "multiple_choice" ||
      answer?.questionId !== review.questionId ||
      answer.answerRole !== "mp_option"
    ) {
      continue;
    }
    const key = `${review.answerId}\u0000${review.reviewerId}`;
    const existing = answerReviewByKey.get(key);
    answerReviewByKey.set(key, existing ? newestByUpdatedAt(existing, review) : review);
    if (!reviewerById.has(review.reviewerId)) {
      reviewerById.set(review.reviewerId, reviewerFromReview(review));
    }
  }

  return questions.flatMap((question) => {
    const reviewerIds = new Set<string>();
    for (const review of questionReviewByKey.values()) {
      if (review.questionId === question.id) reviewerIds.add(review.reviewerId);
    }
    for (const review of answerReviewByKey.values()) {
      if (review.questionId === question.id) reviewerIds.add(review.reviewerId);
    }

    const canonicalAnswers = getCanonicalMpAnswerSequence(question.id, answers);
    const reviewerGroups = [...reviewerIds].flatMap((reviewerId) => {
      const reviewer = reviewerById.get(reviewerId);
      if (!reviewer) return [];
      const questionReview = questionReviewByKey.get(
        `${question.id}\u0000${reviewerId}`,
      );
      const answerReviews = canonicalAnswers.flatMap((answer) => {
        const review = answerReviewByKey.get(`${answer.id}\u0000${reviewerId}`);
        return review ? [{ answer, review }] : [];
      });
      return [{ reviewer, questionReview, answerReviews }];
    });

    reviewerGroups.sort((left, right) =>
      (left.reviewer.fullName || left.reviewer.email).localeCompare(
        right.reviewer.fullName || right.reviewer.email,
      ),
    );
    return reviewerGroups.length > 0 ? [{ question, reviewers: reviewerGroups }] : [];
  });
}

export function countCurrentAdminReviewRows(groups: readonly AdminQuestionReviewGroup[]) {
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
    questions: groups.length,
    reviewers: reviewers.size,
    questionReviews,
    answerReviews,
    totalReviews: questionReviews + answerReviews,
  };
}
