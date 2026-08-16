import type {
  AnswerReviewHistoryItem,
  Question,
  QuestionReviewHistoryItem,
  ReviewSourceVersions,
  StudentAnswer,
} from "../types";
import { getMaterialWeekOptions } from "./materialQuestionFilters.ts";
import { isAnswerReviewEligible } from "./reviewWorkspace.ts";

export type ReviewTaskKind = "question" | "answer";
export type ReviewPersonalStatus = "unreviewed" | "reviewed";
export type ReviewQuestionType = "all" | "ps" | "mp";

export type ReviewWeekSummary = {
  week: string;
  total: number;
  completed: number;
  isComplete: boolean;
};

export type ReviewNavigationState = {
  week: string;
  task: ReviewTaskKind;
  status: ReviewPersonalStatus;
  type: ReviewQuestionType;
  item?: string;
};

export const REVIEW_NAVIGATION_SESSION_KEY =
  "progmiscon.review.navigation.v2";

const taskKinds = new Set<ReviewTaskKind>(["question", "answer"]);
const personalStatuses = new Set<ReviewPersonalStatus>([
  "unreviewed",
  "reviewed",
]);
const questionTypes = new Set<ReviewQuestionType>(["all", "ps", "mp"]);

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

export function getDefaultReviewWeek(questions: readonly Question[]): string {
  const weeks = getMaterialWeekOptions([...questions]);
  return weeks.includes("W02") ? "W02" : (weeks[0] ?? "");
}

export function getActiveCurrentQuestionReviewIds(
  history: readonly QuestionReviewHistoryItem[],
  sourceVersions: ReviewSourceVersions["questions"],
): string[] {
  return uniqueById(
    history
      .filter(
        (review) =>
          review.isActive &&
          review.sourceVersion === sourceVersions.get(review.questionId),
      )
      .map((review) => ({ id: review.questionId })),
  ).map(({ id }) => id);
}

export function getActiveCurrentAnswerReviewIds(
  history: readonly AnswerReviewHistoryItem[],
  sourceVersions: ReviewSourceVersions["answers"],
): string[] {
  return uniqueById(
    history
      .filter((review) => {
        const source = sourceVersions.get(review.answerId);
        return (
          review.isActive &&
          review.sourceVersion === source?.sourceVersion &&
          review.questionId === source.questionId
        );
      })
      .map((review) => ({ id: review.answerId })),
  ).map(({ id }) => id);
}

export function getReviewWeekSummaries(
  questions: readonly Question[],
  reviewedQuestionIds: readonly string[],
  questionCounts: ReadonlyMap<string, number>,
  reviewerThreshold: number,
): ReviewWeekSummary[] {
  const reviewed = new Set(reviewedQuestionIds);

  return getMaterialWeekOptions([...questions]).map((week) => {
    const weekQuestions = uniqueById(questions).filter(
      (question) => question.week === week,
    );
    const completed = weekQuestions.filter(
      (question) =>
        reviewed.has(question.id) ||
        (questionCounts.get(question.id) ?? 0) >= reviewerThreshold,
    ).length;

    return {
      week,
      total: weekQuestions.length,
      completed,
      isComplete: weekQuestions.length > 0 && completed === weekQuestions.length,
    };
  });
}

export function filterWeekReviewQuestions(
  questions: readonly Question[],
  {
    week,
    query,
    type,
    status,
    reviewedQuestionIds,
  }: {
    week: string;
    query: string;
    type: ReviewQuestionType;
    status: "all" | ReviewPersonalStatus;
    reviewedQuestionIds: readonly string[];
  },
): Question[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const reviewed = new Set(reviewedQuestionIds);

  return uniqueById(questions).filter((question) => {
    const personallyReviewed = reviewed.has(question.id);
    const matchesQuery =
      !normalizedQuery ||
      [
        question.id,
        question.number,
        question.sourceCode ?? "",
        question.sourceKey ?? "",
        question.questionCode ?? "",
        question.title.id,
        question.title.en,
        ...question.expectedConcepts.flatMap((concept) => [concept.id, concept.en]),
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));

    return (
      question.week === week &&
      matchesQuery &&
      (type === "all" ||
        (type === "mp") === (question.type === "multiple_choice")) &&
      (status === "all" ||
        personallyReviewed === (status === "reviewed"))
    );
  });
}

export function buildReviewQueue({
  questions,
  answers,
  week,
  task,
  status,
  type,
  reviewedQuestionIds,
  reviewedAnswerIds,
}: {
  questions: readonly Question[];
  answers: readonly StudentAnswer[];
  week: string;
  task: ReviewTaskKind;
  status: ReviewPersonalStatus;
  type: ReviewQuestionType;
  reviewedQuestionIds: readonly string[];
  reviewedAnswerIds: readonly string[];
}): Array<Question | StudentAnswer> {
  const questionById = new Map(
    uniqueById(questions).map((question) => [question.id, question]),
  );
  const reviewedIds = new Set(
    task === "question" ? reviewedQuestionIds : reviewedAnswerIds,
  );
  const matchesStatus = ({ id }: { id: string }) =>
    reviewedIds.has(id) === (status === "reviewed");

  if (task === "question") {
    return uniqueById(questions).filter(
      (question) =>
        question.week === week &&
        (type === "all" ||
          (type === "mp") === isAnswerReviewEligible(question)) &&
        matchesStatus(question),
    );
  }

  return uniqueById(answers).filter((answer) => {
    const parent = questionById.get(answer.questionId);
    return (
      parent?.week === week &&
      isAnswerReviewEligible(parent) &&
      matchesStatus(answer)
    );
  });
}

export function normalizeReviewNavigationState(
  input: Partial<Record<keyof ReviewNavigationState, unknown>>,
  {
    questions,
    answers,
    reviewedQuestionIds,
    reviewedAnswerIds,
  }: {
    questions: readonly Question[];
    answers: readonly StudentAnswer[];
    reviewedQuestionIds: readonly string[];
    reviewedAnswerIds: readonly string[];
  },
): ReviewNavigationState {
  const weeks = getMaterialWeekOptions([...questions]);
  const requestedWeek = typeof input.week === "string" ? input.week : "";
  const week = weeks.includes(requestedWeek)
    ? requestedWeek
    : getDefaultReviewWeek(questions);
  const task = taskKinds.has(input.task as ReviewTaskKind)
    ? (input.task as ReviewTaskKind)
    : "question";
  const status = personalStatuses.has(input.status as ReviewPersonalStatus)
    ? (input.status as ReviewPersonalStatus)
    : "unreviewed";
  const requestedType = questionTypes.has(input.type as ReviewQuestionType)
    ? (input.type as ReviewQuestionType)
    : "all";
  const type = task === "answer" ? "all" : requestedType;
  const queue = buildReviewQueue({
    questions,
    answers,
    week,
    task,
    status,
    type,
    reviewedQuestionIds,
    reviewedAnswerIds,
  });
  const requestedItem = typeof input.item === "string" ? input.item : "";
  const item = queue.some(({ id }) => id === requestedItem)
    ? requestedItem
    : queue[0]?.id;

  return { week, task, status, type, item };
}

export function getNextQueueItemId(
  items: readonly { id: string }[],
  currentItemId: string,
): string | undefined {
  const index = items.findIndex(({ id }) => id === currentItemId);
  if (index < 0) return items[0]?.id;
  return items[index + 1]?.id ?? items.find(({ id }) => id !== currentItemId)?.id;
}

export function getNavigationAfterReviewSave(
  state: ReviewNavigationState,
  items: readonly { id: string }[],
  currentItemId: string,
  alreadyReviewed: boolean,
): ReviewNavigationState {
  return {
    ...state,
    item: alreadyReviewed
      ? currentItemId
      : getNextQueueItemId(items, currentItemId),
  };
}

export function getNavigationAfterWithdraw(
  state: ReviewNavigationState,
  itemId: string,
): ReviewNavigationState {
  return { ...state, status: "unreviewed", item: itemId };
}

export function parseReviewNavigationSession(
  storedValue: string | null,
): Partial<ReviewNavigationState> {
  if (!storedValue) return {};

  try {
    const parsed = JSON.parse(storedValue) as Record<string, unknown>;
    return parsed.version === 2 ? parsed : {};
  } catch {
    return {};
  }
}

export function serializeReviewNavigationSession(
  state: ReviewNavigationState,
): string {
  return JSON.stringify({ version: 2, ...state });
}

export function parseReviewNavigationSearch(search: string): {
  hasParameters: boolean;
  state: Partial<ReviewNavigationState>;
} {
  const params = new URLSearchParams(search);
  const keys = ["week", "task", "status", "type", "item"] as const;
  const hasParameters = keys.some((key) => params.has(key));
  return {
    hasParameters,
    state: Object.fromEntries(
      keys.flatMap((key) => {
        const value = params.get(key);
        return value === null ? [] : [[key, value]];
      }),
    ),
  };
}

export function serializeReviewNavigationSearch(
  state: ReviewNavigationState,
): string {
  const params = new URLSearchParams({
    week: state.week,
    task: state.task,
    status: state.status,
    type: state.type,
  });
  if (state.item) params.set("item", state.item);
  return `?${params.toString()}`;
}

export function resolveAnswerDeepLink(
  answerId: string,
  questions: readonly Question[],
  answers: readonly StudentAnswer[],
  reviewedAnswerIds: readonly string[],
): ReviewNavigationState | undefined {
  const answer = answers.find(({ id }) => id === answerId);
  const question = questions.find(({ id }) => id === answer?.questionId);
  if (!answer || !question?.week || !isAnswerReviewEligible(question)) {
    return undefined;
  }

  return {
    week: question.week,
    task: "answer",
    status: reviewedAnswerIds.includes(answer.id) ? "reviewed" : "unreviewed",
    type: "all",
    item: answer.id,
  };
}
