import type { Question } from "../types";

export const REVIEW_FILTER_ALL = "all";
export const REVIEW_WEEK_UNASSIGNED = "unassigned";
export const REVIEW_MISCONCEPTION_NONE = "none";
export const QUESTION_REVIEWED_THRESHOLD = 3;

export type QuestionReviewStatus =
  | "unreviewed"
  | "under_review"
  | "reviewed";

export type ReviewQuestionFilters = {
  query: string;
  status: typeof REVIEW_FILTER_ALL | QuestionReviewStatus;
  week: string;
  categoryId: string;
  misconceptionId: string;
};

export const DEFAULT_REVIEW_QUESTION_FILTERS: ReviewQuestionFilters = {
  query: "",
  status: REVIEW_FILTER_ALL,
  week: REVIEW_FILTER_ALL,
  categoryId: REVIEW_FILTER_ALL,
  misconceptionId: REVIEW_FILTER_ALL,
};

export function getQuestionReviewStatus(
  reviewCount: number,
): QuestionReviewStatus {
  if (reviewCount >= QUESTION_REVIEWED_THRESHOLD) return "reviewed";
  return reviewCount > 0 ? "under_review" : "unreviewed";
}

export function filterReviewQuestions(
  questions: readonly Question[],
  reviewCounts: ReadonlyMap<string, number>,
  filters: ReviewQuestionFilters,
): Question[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return questions.filter((question) => {
    const reviewCount = reviewCounts.get(question.id) ?? 0;
    const matchesQuery =
      !query ||
      [question.id, question.number].some((value) =>
        value.toLocaleLowerCase().includes(query),
      );
    const matchesStatus =
      filters.status === REVIEW_FILTER_ALL ||
      getQuestionReviewStatus(reviewCount) === filters.status;
    const matchesWeek =
      filters.week === REVIEW_FILTER_ALL ||
      (filters.week === REVIEW_WEEK_UNASSIGNED
        ? !question.week?.trim()
        : question.week === filters.week);
    const matchesCategory =
      filters.categoryId === REVIEW_FILTER_ALL ||
      question.categoryId === filters.categoryId;
    const matchesMisconception =
      filters.misconceptionId === REVIEW_FILTER_ALL ||
      (filters.misconceptionId === REVIEW_MISCONCEPTION_NONE
        ? question.questionMisconceptionIds.length === 0
        : question.questionMisconceptionIds.includes(filters.misconceptionId));

    return (
      matchesQuery &&
      matchesStatus &&
      matchesWeek &&
      matchesCategory &&
      matchesMisconception
    );
  });
}
