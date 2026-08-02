import type { Question, StudentAnswer } from "../types";
import {
  isAnswerReviewEligible,
  selectWorkspaceItemId,
  type ReviewWorkspaceItems,
  type ReviewWorkspace,
} from "./reviewWorkspace.ts";

export const REVIEW_SESSION_STORAGE_KEY = "progmiscon.review.session.v1";

export type ActiveReviewItemIds = Partial<
  Record<ReviewWorkspace, string | undefined>
>;

export type ActiveParentQuestionIds = {
  ps?: string;
  mp?: string;
};

export type ReviewSessionState = {
  workspace: ReviewWorkspace;
  activeItemIds: ActiveReviewItemIds;
  activeParentQuestionIds: ActiveParentQuestionIds;
};

export type ReviewNavigationTarget = {
  workspace: ReviewWorkspace;
  itemId: string | undefined;
  parentQuestionId?: string;
};

export type ReviewWorkspaceAvailability = Record<ReviewWorkspace, boolean>;

const reviewWorkspaces: ReviewWorkspace[] = [
  "question-ps",
  "answer-ps",
  "question-mp",
  "answer-mp",
];

export function createDefaultReviewSessionState(): ReviewSessionState {
  return {
    workspace: "question-ps",
    activeItemIds: {},
    activeParentQuestionIds: {},
  };
}

export function getAnswersForQuestion(
  questionId: string,
  answers: readonly StudentAnswer[],
): StudentAnswer[] {
  const seen = new Set<string>();

  return answers.filter((answer) => {
    if (answer.questionId !== questionId || seen.has(answer.id)) return false;
    seen.add(answer.id);
    return true;
  });
}

export function selectEvidenceAnswerId(
  questionId: string,
  answers: readonly StudentAnswer[],
  preferredAnswerId?: string,
): string | undefined {
  const evidence = getAnswersForQuestion(questionId, answers);
  return evidence.some((answer) => answer.id === preferredAnswerId)
    ? preferredAnswerId
    : evidence[0]?.id;
}

export function selectAdjacentEvidenceAnswerId(
  questionId: string,
  answers: readonly StudentAnswer[],
  currentAnswerId: string | undefined,
  offset: -1 | 1,
): string | undefined {
  const evidence = getAnswersForQuestion(questionId, answers);
  const currentIndex = evidence.findIndex(
    (answer) => answer.id === currentAnswerId,
  );
  return evidence[currentIndex + offset]?.id;
}

export function selectLinkedAnswerId(
  questionId: string,
  answers: readonly StudentAnswer[],
  reviewedAnswerIds: readonly string[],
): string | undefined {
  const linkedAnswers = getAnswersForQuestion(questionId, answers);
  const reviewed = new Set(reviewedAnswerIds);

  return (
    linkedAnswers.find((answer) => !reviewed.has(answer.id))?.id ??
    linkedAnswers[0]?.id
  );
}

export function selectUnreviewedLinkedAnswerId(
  questionId: string,
  answers: readonly StudentAnswer[],
  reviewedAnswerIds: readonly string[],
): string | undefined {
  const reviewed = new Set(reviewedAnswerIds);
  return getAnswersForQuestion(questionId, answers).find(
    (answer) => !reviewed.has(answer.id),
  )?.id;
}

export function getPairedWorkspace(
  workspace: ReviewWorkspace,
): ReviewWorkspace {
  const pairs: Record<ReviewWorkspace, ReviewWorkspace> = {
    "question-ps": "answer-ps",
    "answer-ps": "question-ps",
    "question-mp": "answer-mp",
    "answer-mp": "question-mp",
  };

  return pairs[workspace];
}

export function getReviewWorkspaceAvailability(
  workspace: ReviewWorkspace,
  hasLinkedAnswers: boolean,
): ReviewWorkspaceAvailability {
  const psContext = workspace.endsWith("ps");

  return {
    "question-ps": true,
    "answer-ps": psContext,
    "question-mp": true,
    "answer-mp": !psContext && hasLinkedAnswers,
  };
}

export function selectAvailableReviewWorkspace(
  workspace: ReviewWorkspace,
  nextWorkspace: ReviewWorkspace,
  availability: ReviewWorkspaceAvailability,
): ReviewWorkspace {
  return availability[nextWorkspace] ? nextWorkspace : workspace;
}

export function selectStoredWorkspaceItemId(
  items: readonly { id: string }[],
  storedItemId: string | undefined,
  reviewedIds: readonly string[],
): string | undefined {
  return items.some((item) => item.id === storedItemId)
    ? storedItemId
    : selectWorkspaceItemId(items, [...reviewedIds]);
}

export function setActiveReviewItemId(
  activeItemIds: ActiveReviewItemIds,
  workspace: ReviewWorkspace,
  itemId: string | undefined,
): ActiveReviewItemIds {
  return { ...activeItemIds, [workspace]: itemId };
}

function isReviewWorkspace(value: unknown): value is ReviewWorkspace {
  return reviewWorkspaces.includes(value as ReviewWorkspace);
}

function readStringRecord(
  value: unknown,
  keys: readonly string[],
): Record<string, string> {
  if (!value || typeof value !== "object") return {};

  return Object.fromEntries(
    keys.flatMap((key) => {
      const item = (value as Record<string, unknown>)[key];
      return typeof item === "string" ? [[key, item]] : [];
    }),
  );
}

export function parseReviewSessionState(
  storedValue: string | null,
): ReviewSessionState {
  if (!storedValue) return createDefaultReviewSessionState();

  try {
    const stored = JSON.parse(storedValue) as Record<string, unknown>;
    const workspace = isReviewWorkspace(stored.workspace)
      ? stored.workspace
      : "question-ps";

    return {
      workspace,
      activeItemIds: readStringRecord(
        stored.activeItemIds,
        reviewWorkspaces,
      ),
      activeParentQuestionIds: readStringRecord(
        stored.activeParentQuestionIds,
        ["ps", "mp"],
      ),
    };
  } catch {
    return createDefaultReviewSessionState();
  }
}

export function serializeReviewSessionState(
  state: ReviewSessionState,
): string {
  return JSON.stringify({
    workspace: state.workspace,
    activeItemIds: readStringRecord(state.activeItemIds, reviewWorkspaces),
    activeParentQuestionIds: readStringRecord(
      state.activeParentQuestionIds,
      ["ps", "mp"],
    ),
  });
}

function selectFallbackAnswer(
  answers: readonly StudentAnswer[],
  storedAnswerId: string | undefined,
  reviewedAnswerIds: readonly string[],
): StudentAnswer | undefined {
  const answerId = selectStoredWorkspaceItemId(
    answers,
    storedAnswerId,
    reviewedAnswerIds,
  );
  return answers.find((answer) => answer.id === answerId);
}

export function normalizeReviewSessionState(
  state: ReviewSessionState,
  items: ReviewWorkspaceItems,
  questionById: ReadonlyMap<string, Question>,
  reviewedQuestionIds: readonly string[],
  reviewedAnswerIds: readonly string[],
): ReviewSessionState {
  const activeItemIds: ActiveReviewItemIds = {
    "question-ps": selectStoredWorkspaceItemId(
      items["question-ps"],
      state.activeItemIds["question-ps"],
      reviewedQuestionIds,
    ),
    "question-mp": selectStoredWorkspaceItemId(
      items["question-mp"],
      state.activeItemIds["question-mp"],
      reviewedQuestionIds,
    ),
  };
  const activeParentQuestionIds: ActiveParentQuestionIds = {};

  for (const kind of ["ps", "mp"] as const) {
    const questionWorkspace =
      kind === "ps" ? "question-ps" : "question-mp";
    const answerWorkspace = kind === "ps" ? "answer-ps" : "answer-mp";
    const workspaceQuestions = items[questionWorkspace];
    const workspaceAnswers = items[answerWorkspace];
    const workspaceReviewedAnswerIds = kind === "mp" ? reviewedAnswerIds : [];
    const storedParentId = state.activeParentQuestionIds[kind];
    const storedParentIsValid = workspaceQuestions.some(
      (question) => question.id === storedParentId,
    );
    const storedAnswer = workspaceAnswers.find(
      (answer) => answer.id === state.activeItemIds[answerWorkspace],
    );
    let parentQuestionId = storedParentIsValid
      ? storedParentId
      : storedAnswer?.questionId;
    let linkedAnswers = parentQuestionId
      ? getAnswersForQuestion(parentQuestionId, workspaceAnswers)
      : [];
    let activeAnswerId = selectStoredWorkspaceItemId(
      linkedAnswers,
      storedAnswer?.id,
      workspaceReviewedAnswerIds,
    );

    if (!parentQuestionId) {
      const fallbackAnswer = selectFallbackAnswer(
        workspaceAnswers,
        storedAnswer?.id,
        workspaceReviewedAnswerIds,
      );
      parentQuestionId = fallbackAnswer?.questionId;
      linkedAnswers = parentQuestionId
        ? getAnswersForQuestion(parentQuestionId, workspaceAnswers)
        : [];
      activeAnswerId = selectStoredWorkspaceItemId(
        linkedAnswers,
        fallbackAnswer?.id,
        workspaceReviewedAnswerIds,
      );
    }

    activeParentQuestionIds[kind] = parentQuestionId;
    activeItemIds[answerWorkspace] = activeAnswerId;
  }

  if (state.workspace.startsWith("question")) {
    const kind = state.workspace.endsWith("ps") ? "ps" : "mp";
    const answerWorkspace = kind === "ps" ? "answer-ps" : "answer-mp";
    const parentQuestionId = activeItemIds[state.workspace];
    activeParentQuestionIds[kind] = parentQuestionId;
    activeItemIds[answerWorkspace] = parentQuestionId
      ? selectStoredWorkspaceItemId(
          getAnswersForQuestion(parentQuestionId, items[answerWorkspace]),
          state.activeItemIds[answerWorkspace],
          kind === "mp" ? reviewedAnswerIds : [],
        )
      : undefined;
  } else {
    const kind = state.workspace.endsWith("ps") ? "ps" : "mp";
    const workspaceAnswers = items[state.workspace] as StudentAnswer[];
    const activeAnswer = workspaceAnswers.find(
      (answer) => answer.id === activeItemIds[state.workspace],
    );

    if (!activeAnswer) {
      const fallbackAnswer = selectFallbackAnswer(
        workspaceAnswers,
        state.activeItemIds[state.workspace],
        kind === "mp" ? reviewedAnswerIds : [],
      );
      activeItemIds[state.workspace] = fallbackAnswer?.id;
      activeParentQuestionIds[kind] = fallbackAnswer?.questionId;
    } else if (questionById.has(activeAnswer.questionId)) {
      activeParentQuestionIds[kind] = activeAnswer.questionId;
    }
  }

  return {
    workspace: state.workspace,
    activeItemIds,
    activeParentQuestionIds,
  };
}

function selectNextQuestionId(
  questions: readonly Question[],
  reviewedQuestionIds: readonly string[],
  currentQuestionId: string,
): string | undefined {
  const reviewed = new Set(reviewedQuestionIds);
  return (
    questions.find(
      (question) =>
        question.id !== currentQuestionId && !reviewed.has(question.id),
    )?.id ??
    questions.find((question) => question.id !== currentQuestionId)?.id ??
    questions.find((question) => question.id === currentQuestionId)?.id
  );
}

export function selectAfterQuestionReview(
  question: Question,
  questions: readonly Question[],
  answers: readonly StudentAnswer[],
  reviewedQuestionIds: readonly string[],
  reviewedAnswerIds: readonly string[],
): ReviewNavigationTarget {
  const nextReviewedQuestionIds = reviewedQuestionIds.includes(question.id)
    ? reviewedQuestionIds
    : [...reviewedQuestionIds, question.id];

  if (!isAnswerReviewEligible(question)) {
    return {
      workspace: "question-ps",
      itemId: selectNextQuestionId(
        questions,
        nextReviewedQuestionIds,
        question.id,
      ),
    };
  }

  const answerId = selectUnreviewedLinkedAnswerId(
    question.id,
    answers,
    reviewedAnswerIds,
  );

  return answerId
    ? {
        workspace:
          question.type === "multiple_choice" ? "answer-mp" : "answer-ps",
        itemId: answerId,
        parentQuestionId: question.id,
      }
    : {
        workspace:
          question.type === "multiple_choice" ? "question-mp" : "question-ps",
        itemId: selectNextQuestionId(
          questions,
          nextReviewedQuestionIds,
          question.id,
        ),
      };
}

export function selectAfterAnswerReview(
  question: Question,
  answerId: string,
  questions: readonly Question[],
  answers: readonly StudentAnswer[],
  reviewedQuestionIds: readonly string[],
  reviewedAnswerIds: readonly string[],
): ReviewNavigationTarget {
  if (!isAnswerReviewEligible(question)) {
    return {
      workspace: "question-ps",
      itemId: selectNextQuestionId(
        questions,
        reviewedQuestionIds,
        question.id,
      ),
    };
  }

  const nextReviewedAnswerIds = reviewedAnswerIds.includes(answerId)
    ? reviewedAnswerIds
    : [...reviewedAnswerIds, answerId];
  const nextAnswerId = selectUnreviewedLinkedAnswerId(
    question.id,
    answers,
    nextReviewedAnswerIds,
  );

  return nextAnswerId
    ? {
        workspace:
          question.type === "multiple_choice" ? "answer-mp" : "answer-ps",
        itemId: nextAnswerId,
        parentQuestionId: question.id,
      }
    : {
        workspace:
          question.type === "multiple_choice" ? "question-mp" : "question-ps",
        itemId: selectNextQuestionId(
          questions,
          reviewedQuestionIds,
          question.id,
        ),
      };
}
