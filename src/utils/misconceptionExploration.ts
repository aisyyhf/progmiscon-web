import type { Question, StudentAnswer } from "../types";

export function getMatchingAnswers(
  answers: StudentAnswer[],
  misconceptionId: string,
  questionId?: string,
): StudentAnswer[] {
  return answers.filter(
    (answer) =>
      (!questionId || answer.questionId === questionId) &&
      answer.studentMisconceptionIds.includes(misconceptionId),
  );
}

export function getRelatedQuestions(
  questions: Question[],
  answers: StudentAnswer[],
  misconceptionId: string,
  relatedQuestionIds: string[],
): Question[] {
  const questionsWithAnswers = new Set(
    getMatchingAnswers(answers, misconceptionId).map((answer) => answer.questionId),
  );
  const relatedIds = new Set(relatedQuestionIds);
  return questions.filter((question) => relatedIds.has(question.id) && questionsWithAnswers.has(question.id));
}
