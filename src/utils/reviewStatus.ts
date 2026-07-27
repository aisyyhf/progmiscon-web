import type { ReviewProgress } from "../types/reviewPersistence";

export type ReviewStatusRow = {
  question_ids?: unknown[] | null;
  answer_ids?: unknown[] | null;
  question_review_count?: number | string | null;
  answer_review_count?: number | string | null;
  latest_updated_at?: string | null;
};

export const EMPTY_REVIEW_PROGRESS: ReviewProgress = {
  questionIds: [],
  answerIds: [],
  questionReviewCount: 0,
  answerReviewCount: 0,
  latestUpdatedAt: null,
};

function normalizeIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

function normalizeCount(value: unknown, fallback: number): number {
  const count =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : Number.NaN;

  return Number.isSafeInteger(count) && count >= 0 ? count : fallback;
}

export function mapReviewStatusRow(
  row: ReviewStatusRow | null | undefined,
): ReviewProgress {
  if (!row) return { ...EMPTY_REVIEW_PROGRESS };

  const questionIds = normalizeIds(row.question_ids);
  const answerIds = normalizeIds(row.answer_ids);

  return {
    questionIds,
    answerIds,
    questionReviewCount: normalizeCount(
      row.question_review_count,
      questionIds.length,
    ),
    answerReviewCount: normalizeCount(
      row.answer_review_count,
      answerIds.length,
    ),
    latestUpdatedAt: row.latest_updated_at ?? null,
  };
}
