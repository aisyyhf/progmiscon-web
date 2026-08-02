import type { Question } from "../types";
import { getMaterialWeekOptions } from "./materialQuestionFilters.ts";
import {
  REVIEW_WEEK_UNASSIGNED,
  getQuestionReviewStatus,
  type QuestionReviewStatus,
} from "./reviewQuestionFilters.ts";
import type { ReviewWorkspace } from "./reviewWorkspace.ts";

export type MpQuestionWeek = {
  key: string;
  questions: Question[];
};

export type MpQuestionNavigatorItem = {
  question: Question;
  displayNumber: number;
  matchesFilters: boolean;
  active: boolean;
  reviewedByMe: boolean;
  reviewCount: number;
  reviewStatus: QuestionReviewStatus;
};

export function getMpQuestionWeekKey(
  question: Pick<Question, "week">,
): string {
  return question.week?.trim() || REVIEW_WEEK_UNASSIGNED;
}

export function groupMpQuestionsByWeek(
  questions: readonly Question[],
): MpQuestionWeek[] {
  const mpQuestions = questions.filter(
    (question) => question.type === "multiple_choice",
  );
  const grouped = new Map<string, Question[]>();

  for (const question of mpQuestions) {
    const key = getMpQuestionWeekKey(question);
    grouped.set(key, [...(grouped.get(key) ?? []), question]);
  }

  const keys = getMaterialWeekOptions([...mpQuestions]);
  if (grouped.has(REVIEW_WEEK_UNASSIGNED)) keys.push(REVIEW_WEEK_UNASSIGNED);

  return keys.map((key) => ({ key, questions: grouped.get(key) ?? [] }));
}

export function resolveMpActiveWeek(
  weeks: readonly MpQuestionWeek[],
  storedWeek: string,
  preferredQuestionId?: string,
): string | undefined {
  const preferredWeek = preferredQuestionId
    ? weeks.find((week) =>
        week.questions.some((question) => question.id === preferredQuestionId),
      )
    : undefined;

  return (
    preferredWeek?.key ??
    weeks.find((week) => week.key === storedWeek)?.key ??
    weeks[0]?.key
  );
}

export function buildMpQuestionNavigatorItems(
  questions: readonly Question[],
  matchingQuestionIds: ReadonlySet<string>,
  reviewCounts: ReadonlyMap<string, number>,
  reviewedQuestionIds: readonly string[],
  activeQuestionId?: string,
): MpQuestionNavigatorItem[] {
  const reviewed = new Set(reviewedQuestionIds);

  return questions.map((question, index) => {
    const reviewCount = reviewCounts.get(question.id) ?? 0;
    return {
      question,
      displayNumber: index + 1,
      matchesFilters: matchingQuestionIds.has(question.id),
      active: question.id === activeQuestionId,
      reviewedByMe: reviewed.has(question.id),
      reviewCount,
      reviewStatus: getQuestionReviewStatus(reviewCount),
    };
  });
}

export function selectValidMpQuestionId(
  questions: readonly Pick<Question, "id">[],
  matchingQuestionIds: ReadonlySet<string>,
  preferredQuestionId?: string,
): string | undefined {
  if (
    preferredQuestionId &&
    matchingQuestionIds.has(preferredQuestionId) &&
    questions.some((question) => question.id === preferredQuestionId)
  ) {
    return preferredQuestionId;
  }

  return questions.find((question) => matchingQuestionIds.has(question.id))?.id;
}

export function selectAdjacentMpQuestionId(
  questions: readonly Pick<Question, "id">[],
  matchingQuestionIds: ReadonlySet<string>,
  activeQuestionId: string | undefined,
  offset: -1 | 1,
): string | undefined {
  const matching = questions.filter((question) =>
    matchingQuestionIds.has(question.id),
  );
  const activeIndex = matching.findIndex(
    (question) => question.id === activeQuestionId,
  );
  return activeIndex < 0 ? undefined : matching[activeIndex + offset]?.id;
}

export function selectNextUnfinishedMpQuestionId(
  questions: readonly Pick<Question, "id">[],
  matchingQuestionIds: ReadonlySet<string>,
  reviewedQuestionIds: readonly string[],
  currentQuestionId?: string,
): string | undefined {
  const reviewed = new Set(reviewedQuestionIds);
  return questions.find(
    (question) =>
      question.id !== currentQuestionId &&
      matchingQuestionIds.has(question.id) &&
      !reviewed.has(question.id),
  )?.id;
}

export function isMpWeekComplete(
  questions: readonly Pick<Question, "id">[],
  reviewedQuestionIds: readonly string[],
): boolean {
  const reviewed = new Set(reviewedQuestionIds);
  return (
    questions.length > 0 &&
    questions.every((question) => reviewed.has(question.id))
  );
}

export function isMpWeekGloballyComplete(
  questions: readonly Pick<Question, "id">[],
  reviewCounts: ReadonlyMap<string, number>,
  threshold: number,
): boolean {
  return (
    questions.length > 0 &&
    questions.every(
      (question) => (reviewCounts.get(question.id) ?? 0) >= threshold,
    )
  );
}

export function getNextMpWeekKey(
  weeks: readonly MpQuestionWeek[],
  activeWeek: string | undefined,
): string | undefined {
  const activeIndex = weeks.findIndex((week) => week.key === activeWeek);
  return activeIndex < 0 ? undefined : weeks[activeIndex + 1]?.key;
}

export function shouldWarnForMpQuestionNavigation(
  dirty: boolean,
  currentWorkspace: ReviewWorkspace,
  currentQuestionId: string | undefined,
  nextWorkspace: ReviewWorkspace,
  nextQuestionId: string | undefined,
): boolean {
  return (
    dirty &&
    currentWorkspace === "question-mp" &&
    (nextWorkspace !== currentWorkspace || nextQuestionId !== currentQuestionId)
  );
}
