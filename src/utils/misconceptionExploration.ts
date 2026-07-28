import type { Question, StudentAnswer } from "../types";
import { getQuestionOptionMisconceptionIds } from "./questionMetadata.ts";

function answerPatternKey(answer: StudentAnswer): string {
  const normalizedText = answer.answerText
    ?.trim()
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n");

  return `${answer.questionId}:${answer.selectedOptionId ? `option:${answer.selectedOptionId}` : `text:${normalizedText ?? ""}`}`;
}

export function getAnswerVariations(answers: StudentAnswer[]): StudentAnswer[] {
  const seen = new Set<string>();

  return answers
    .filter((answer) => {
      const key = answerPatternKey(answer);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => Number(a.status === "correct") - Number(b.status === "correct"));
}

export function getMatchingAnswers(
  answers: StudentAnswer[],
  misconceptionId: string,
  questionId?: string,
  questions: Question[] = [],
): StudentAnswer[] {
  const questionById = new Map(questions.map((question) => [question.id, question]));
  return answers.filter(
    (answer) =>
      (!questionId || answer.questionId === questionId) &&
      answerHasMisconception(
        answer,
        misconceptionId,
        questionById.get(answer.questionId),
      ),
  );
}

export function answerHasMisconception(
  answer: StudentAnswer,
  misconceptionId: string,
  question?: Question,
): boolean {
  if (answer.studentMisconceptionIds.includes(misconceptionId)) return true;
  const option = question?.options?.find(
    (item) => item.id === answer.selectedOptionId,
  );
  return option
    ? getQuestionOptionMisconceptionIds(option).includes(misconceptionId)
    : false;
}

export function getRelatedQuestions(
  questions: Question[],
  answers: StudentAnswer[],
  misconceptionId: string,
  relatedQuestionIds: string[],
): Question[] {
  const questionsWithAnswers = new Set(
    getMatchingAnswers(answers, misconceptionId, undefined, questions).map(
      (answer) => answer.questionId,
    ),
  );
  const relatedIds = new Set(relatedQuestionIds);
  return questions.filter((question) => relatedIds.has(question.id) && questionsWithAnswers.has(question.id));
}
