import type {
  Question,
  QuestionMisconceptionProvenance,
  StudentAnswer,
} from "../types";

const normalizeIds = (ids: readonly string[]): string[] =>
  [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort(
    (left, right) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
  );

export function buildMockQuestionMisconceptionProvenance(
  question: Pick<Question, "id" | "directQuestionMisconceptionIds" | "options">,
  answers: readonly Pick<
    StudentAnswer,
    "questionId" | "studentMisconceptionIds"
  >[],
): QuestionMisconceptionProvenance {
  const directQuestionMisconceptionIds = normalizeIds(
    question.directQuestionMisconceptionIds,
  );
  const answerDerivedMisconceptionIds = normalizeIds([
    ...(question.options?.flatMap((option) => option.misconceptionIds) ?? []),
    ...answers
      .filter((answer) => answer.questionId === question.id)
      .flatMap((answer) => answer.studentMisconceptionIds),
  ]);

  return {
    directQuestionMisconceptionIds,
    answerDerivedMisconceptionIds,
    questionMisconceptionIds: normalizeIds([
      ...directQuestionMisconceptionIds,
      ...answerDerivedMisconceptionIds,
    ]),
  };
}
