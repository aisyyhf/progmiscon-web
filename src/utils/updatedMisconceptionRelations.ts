import type {
  AnswerMisconceptionRow,
  QuestionMisconceptionRow,
} from "../types/masterData";

type ReviewChange = {
  id: string;
  updatedAt: string;
  removedMisconceptionIds: string[];
  additionalMisconceptionIds: string[];
};

type QuestionReviewChange = ReviewChange & {
  questionId: string;
};

type AnswerReviewChange = ReviewChange & {
  answerId: string;
};

export type UpdatedRelationResult<Row> = {
  relations: Row[];
  masterRelationCount: number;
  appliedReviewItemCount: number;
  invalidAddedMisconceptionIds: string[];
};

function normalizedIds(ids: string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
}

function stableIdCompare(left: string, right: string): number {
  return left.localeCompare(right, undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function reviewIsNewer(candidate: ReviewChange, current: ReviewChange): boolean {
  const candidateTime = Date.parse(candidate.updatedAt);
  const currentTime = Date.parse(current.updatedAt);

  if (Number.isFinite(candidateTime) && Number.isFinite(currentTime)) {
    if (candidateTime !== currentTime) return candidateTime > currentTime;
  } else if (candidate.updatedAt !== current.updatedAt) {
    return candidate.updatedAt > current.updatedAt;
  }

  return stableIdCompare(candidate.id, current.id) > 0;
}

function latestReviewsByItem<Review extends ReviewChange>(
  reviews: Review[],
  itemId: (review: Review) => string,
): Map<string, Review> {
  const latest = new Map<string, Review>();

  for (const review of reviews) {
    const id = itemId(review).trim();
    if (!id) continue;

    const current = latest.get(id);
    if (!current || reviewIsNewer(review, current)) {
      latest.set(id, review);
    }
  }

  return latest;
}

function updateRelations<Row extends Record<string, string>, Review extends ReviewChange>(
  masterRelations: Row[],
  reviews: Review[],
  validMisconceptionIds: Set<string>,
  options: {
    getItemId: (row: Row) => string;
    getMisconceptionId: (row: Row) => string;
    getReviewItemId: (review: Review) => string;
    createRelation: (itemId: string, misconceptionId: string) => Row;
  },
): UpdatedRelationResult<Row> {
  const latestReviews = latestReviewsByItem(reviews, options.getReviewItemId);
  const invalidAddedMisconceptionIds = new Set<string>();
  const relations = new Map<string, Row>();

  for (const row of masterRelations) {
    const itemId = options.getItemId(row).trim();
    const misconceptionId = options.getMisconceptionId(row).trim();
    const key = `${itemId}\u0000${misconceptionId}`;

    if (!relations.has(key)) relations.set(key, { ...row });
  }

  for (const [itemId, review] of latestReviews) {
    const invalidAddedForReview = new Set<string>();

    for (const misconceptionId of normalizedIds(review.additionalMisconceptionIds)) {
      if (!validMisconceptionIds.has(misconceptionId)) {
        invalidAddedForReview.add(misconceptionId);
        invalidAddedMisconceptionIds.add(misconceptionId);
      }
    }

    if (invalidAddedForReview.size > 0) continue;

    for (const misconceptionId of normalizedIds(review.removedMisconceptionIds)) {
      relations.delete(`${itemId}\u0000${misconceptionId}`);
    }

    for (const misconceptionId of normalizedIds(review.additionalMisconceptionIds)) {
      const key = `${itemId}\u0000${misconceptionId}`;
      if (!relations.has(key)) {
        relations.set(key, options.createRelation(itemId, misconceptionId));
      }
    }
  }

  return {
    relations: [...relations.values()].sort((left, right) => {
      const itemOrder = stableIdCompare(
        options.getItemId(left).trim(),
        options.getItemId(right).trim(),
      );
      if (itemOrder !== 0) return itemOrder;

      return stableIdCompare(
        options.getMisconceptionId(left).trim(),
        options.getMisconceptionId(right).trim(),
      );
    }),
    masterRelationCount: masterRelations.length,
    appliedReviewItemCount: latestReviews.size,
    invalidAddedMisconceptionIds: [...invalidAddedMisconceptionIds].sort(
      stableIdCompare,
    ),
  };
}

export function buildUpdatedQuestionMisconceptionRelations(
  masterRelations: QuestionMisconceptionRow[],
  reviews: QuestionReviewChange[],
  validMisconceptionIds: Set<string>,
): UpdatedRelationResult<QuestionMisconceptionRow> {
  return updateRelations(masterRelations, reviews, validMisconceptionIds, {
    getItemId: (row) => row.question_id,
    getMisconceptionId: (row) => row.misconception_id,
    getReviewItemId: (review) => review.questionId,
    createRelation: (questionId, misconceptionId) => ({
      question_id: questionId,
      misconception_id: misconceptionId,
      source: "review_latest",
      active: "TRUE",
    }),
  });
}

export function buildUpdatedAnswerMisconceptionRelations(
  masterRelations: AnswerMisconceptionRow[],
  reviews: AnswerReviewChange[],
  validMisconceptionIds: Set<string>,
): UpdatedRelationResult<AnswerMisconceptionRow> {
  return updateRelations(masterRelations, reviews, validMisconceptionIds, {
    getItemId: (row) => row.answer_id,
    getMisconceptionId: (row) => row.misconception_id,
    getReviewItemId: (review) => review.answerId,
    createRelation: (answerId, misconceptionId) => ({
      answer_id: answerId,
      misconception_id: misconceptionId,
      reason_ind: "",
      reason_en: "",
      active: "TRUE",
    }),
  });
}
