import type {
  AdminReviewConsensusItem,
  Question,
  QuestionOption,
  ReviewTask,
  StudentAnswer,
} from "../types";

export function isAnswerReviewEligible(
  question: Pick<Question, "type"> | undefined,
): boolean {
  return question?.type === "multiple_choice";
}

export function assertAnswerReviewEligible(
  question: Pick<Question, "type"> | undefined,
): void {
  if (!isAnswerReviewEligible(question)) {
    throw new Error(
      "Jawaban PS hanya tersedia sebagai evidence dan tidak dapat direview.",
    );
  }
}

export function getAnswerWorkspaceForQuestion(
  question: Pick<Question, "type">,
): "answer-ps" | "answer-mp" {
  return isAnswerReviewEligible(question) ? "answer-mp" : "answer-ps";
}

export function filterEligibleAnswerReviewTasks(
  tasks: readonly ReviewTask[],
  questionById: ReadonlyMap<string, Pick<Question, "type">>,
): ReviewTask[] {
  return tasks.filter((task) =>
    isAnswerReviewEligible(questionById.get(task.questionId)),
  );
}

export function filterEligibleAnswerReviewIds(
  answerIds: readonly string[],
  answers: readonly Pick<StudentAnswer, "id" | "questionId">[],
  questionById: ReadonlyMap<string, Pick<Question, "type">>,
): string[] {
  const answerById = new Map(answers.map((answer) => [answer.id, answer]));
  return answerIds.filter((answerId) => {
    const answer = answerById.get(answerId);
    return Boolean(
      answer && isAnswerReviewEligible(questionById.get(answer.questionId)),
    );
  });
}

export function filterEligibleAnswerReviewCounts(
  counts: ReadonlyMap<string, number>,
  answers: readonly Pick<StudentAnswer, "id" | "questionId">[],
  questionById: ReadonlyMap<string, Pick<Question, "type">>,
): Map<string, number> {
  const eligibleIds = new Set(
    filterEligibleAnswerReviewIds([...counts.keys()], answers, questionById),
  );
  return new Map([...counts].filter(([answerId]) => eligibleIds.has(answerId)));
}

export function getActionableAnswerReviewSequence(
  question: Pick<Question, "id" | "type"> | undefined,
  answers: readonly StudentAnswer[],
  reviewedAnswerIds: readonly string[],
  answerReviewCounts: ReadonlyMap<string, number>,
  reviewerThreshold: number,
): StudentAnswer[] {
  if (!question || !isAnswerReviewEligible(question)) return [];

  const reviewed = new Set(reviewedAnswerIds);
  const seen = new Set<string>();

  return answers.filter((answer) => {
    if (
      answer.questionId !== question.id ||
      !answer.sourceVersion ||
      seen.has(answer.id)
    ) {
      return false;
    }
    seen.add(answer.id);
    return (
      reviewed.has(answer.id) ||
      (answerReviewCounts.get(answer.id) ?? 0) < reviewerThreshold
    );
  });
}

export function getNextUnreviewedAnswerId(
  sequence: readonly Pick<StudentAnswer, "id">[],
  reviewedAnswerIds: readonly string[],
  currentAnswerId?: string,
): string | undefined {
  const reviewed = new Set(reviewedAnswerIds);
  const startIndex = Math.max(
    0,
    sequence.findIndex(({ id }) => id === currentAnswerId) + 1,
  );
  const ordered = [...sequence.slice(startIndex), ...sequence.slice(0, startIndex)];
  return ordered.find(({ id }) => !reviewed.has(id))?.id;
}

export function filterAdminReviewConsensusItems(
  items: readonly AdminReviewConsensusItem[],
  questionById: ReadonlyMap<string, Pick<Question, "type">>,
): AdminReviewConsensusItem[] {
  return items.filter(
    (item) =>
      item.targetType === "question" ||
      isAnswerReviewEligible(questionById.get(item.questionId)),
  );
}

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
    items[isAnswerReviewEligible(question) ? "question-mp" : "question-ps"].push(
      question,
    );
  }

  for (const answer of answers) {
    const question = questionById.get(answer.questionId);
    if (!question) continue;
    if (!isAnswerReviewEligible(question) && answer.isEvidence === false) continue;
    items[getAnswerWorkspaceForQuestion(question)].push(
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

export function stripSelectedOptionPrefix(
  value: string,
  optionLabel?: string,
): string {
  if (!optionLabel) return value;

  const escapedLabel = optionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return value.replace(
    new RegExp(`^\\s*${escapedLabel}\\s*[.):]\\s*`, "i"),
    "",
  );
}
