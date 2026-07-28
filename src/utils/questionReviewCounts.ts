import type { AnswerReviewCount, QuestionReviewCount } from "../types";

export type QuestionReviewCountRow = {
  question_id?: unknown;
  review_count?: unknown;
  latest_updated_at?: unknown;
};

export function normalizeReviewCount(value: unknown): number {
  const count =
    typeof value === "number" || typeof value === "string"
      ? Number(value)
      : Number.NaN;

  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}

export function mapAnswerReviewCountRows(rows: unknown): AnswerReviewCount[] {
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const row = value as {
      answer_id?: unknown;
      review_count?: unknown;
      latest_updated_at?: unknown;
    };
    const answerId =
      typeof row.answer_id === "string" ? row.answer_id.trim() : "";
    if (!answerId) return [];

    return [{
      answerId,
      reviewCount: normalizeReviewCount(row.review_count),
      latestUpdatedAt:
        typeof row.latest_updated_at === "string"
          ? row.latest_updated_at
          : null,
    }];
  });
}

export function mapQuestionReviewCountRows(
  rows: unknown,
): QuestionReviewCount[] {
  if (!Array.isArray(rows)) return [];

  const counts = new Map<string, QuestionReviewCount>();

  for (const value of rows) {
    if (!value || typeof value !== "object") continue;

    const row = value as QuestionReviewCountRow;
    const questionId =
      typeof row.question_id === "string" ? row.question_id.trim() : "";

    if (!questionId || counts.has(questionId)) continue;

    counts.set(questionId, {
      questionId,
      reviewCount: normalizeReviewCount(row.review_count),
      latestUpdatedAt:
        typeof row.latest_updated_at === "string"
          ? row.latest_updated_at
          : null,
    });
  }

  return [...counts.values()];
}
