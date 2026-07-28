import {
  DEFAULT_REVIEW_QUESTION_FILTERS,
  REVIEW_FILTER_ALL,
  type ReviewQuestionFilters,
} from "./reviewQuestionFilters.ts";

export const REVIEW_QUESTION_FILTER_SESSION_KEY =
  "progmiscon.review.question-filters.v1";

export type ReviewQuestionFilterSessionState = {
  ps: ReviewQuestionFilters;
  mp: ReviewQuestionFilters;
};

const validStatuses = new Set<ReviewQuestionFilters["status"]>([
  REVIEW_FILTER_ALL,
  "unreviewed",
  "under_review",
  "reviewed",
]);

export function createDefaultReviewQuestionFilterSession(): ReviewQuestionFilterSessionState {
  return {
    ps: { ...DEFAULT_REVIEW_QUESTION_FILTERS },
    mp: { ...DEFAULT_REVIEW_QUESTION_FILTERS },
  };
}

function normalizeFilters(value: unknown): ReviewQuestionFilters {
  const input =
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : {};

  return {
    query:
      typeof input.query === "string"
        ? input.query
        : DEFAULT_REVIEW_QUESTION_FILTERS.query,
    status:
      typeof input.status === "string" &&
      validStatuses.has(input.status as ReviewQuestionFilters["status"])
        ? (input.status as ReviewQuestionFilters["status"])
        : DEFAULT_REVIEW_QUESTION_FILTERS.status,
    week:
      typeof input.week === "string"
        ? input.week
        : DEFAULT_REVIEW_QUESTION_FILTERS.week,
    categoryId:
      typeof input.categoryId === "string"
        ? input.categoryId
        : DEFAULT_REVIEW_QUESTION_FILTERS.categoryId,
    misconceptionId:
      typeof input.misconceptionId === "string"
        ? input.misconceptionId
        : DEFAULT_REVIEW_QUESTION_FILTERS.misconceptionId,
  };
}

export function parseReviewQuestionFilterSession(
  storedValue: string | null,
): ReviewQuestionFilterSessionState {
  if (!storedValue) return createDefaultReviewQuestionFilterSession();

  try {
    const parsed = JSON.parse(storedValue) as unknown;
    const input =
      typeof parsed === "object" && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {};

    return {
      ps: normalizeFilters(input.ps),
      mp: normalizeFilters(input.mp),
    };
  } catch {
    return createDefaultReviewQuestionFilterSession();
  }
}

export function serializeReviewQuestionFilterSession(
  state: ReviewQuestionFilterSessionState,
): string {
  return JSON.stringify({
    ps: normalizeFilters(state.ps),
    mp: normalizeFilters(state.mp),
  });
}
