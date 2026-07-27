import type {
  Question,
  QuestionOption,
  StudentAnswer,
} from "../types";

export type ReviewWorkspace =
  | "question-ps"
  | "answer-ps"
  | "question-mp"
  | "answer-mp";

export const DEFAULT_REVIEW_WORKSPACE: ReviewWorkspace = "question-ps";

export type ReviewWorkspaceItems = {
  "question-ps": Question[];
  "answer-ps": StudentAnswer[];
  "question-mp": Question[];
  "answer-mp": StudentAnswer[];
};

export function classifyReviewItems(
  questions: Question[],
  answers: StudentAnswer[],
): {
  items: ReviewWorkspaceItems;
  questionById: Map<string, Question>;
} {
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const items: ReviewWorkspaceItems = {
    "question-ps": [],
    "answer-ps": [],
    "question-mp": [],
    "answer-mp": [],
  };

  for (const question of questions) {
    items[question.type === "multiple_choice" ? "question-mp" : "question-ps"].push(
      question,
    );
  }

  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    if (!question) continue;
    items[question.type === "multiple_choice" ? "answer-mp" : "answer-ps"].push(
      answer,
    );
  }

  return { items, questionById };
}

export function getReviewProgress(
  items: readonly { id: string }[],
  reviewedIds: string[],
): { reviewed: number; total: number } {
  const reviewed = new Set(reviewedIds);
  return {
    reviewed: items.reduce(
      (total, item) => total + Number(reviewed.has(item.id)),
      0,
    ),
    total: items.length,
  };
}

export function selectWorkspaceItemId(
  items: readonly { id: string }[],
  reviewedIds: string[],
): string | undefined {
  const reviewed = new Set(reviewedIds);
  return items.find((item) => !reviewed.has(item.id))?.id ?? items[0]?.id;
}

export function resolveAnswerSelection(
  question: Question,
  answer: StudentAnswer,
): {
  option: QuestionOption | undefined;
  fallbackText: string;
  missingSelectedOption: boolean;
} {
  const option = question.options?.find(
    (item) => item.id === answer.selectedOptionId,
  );

  return {
    option,
    fallbackText: answer.answerText ?? "",
    missingSelectedOption:
      question.type === "multiple_choice" && option === undefined,
  };
}
