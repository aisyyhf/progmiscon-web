import type { Question, StudentAnswer } from "../types";

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
