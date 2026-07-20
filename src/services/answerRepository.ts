import type { StudentAnswer } from "../types";
import { mockStudentAnswers } from "../data/mockStudentAnswers";
import { usesGoogleSheets } from "../config/masterDataConfig";
import { getSheetAnswers } from "./masterDataRepository";

export async function getAnswers(): Promise<StudentAnswer[]> {
  if (usesGoogleSheets()) {
    return getSheetAnswers();
  }

  return mockStudentAnswers;
}

export async function getAnswersByQuestion(questionId: string): Promise<StudentAnswer[]> {
  const answers = await getAnswers();
  return answers.filter((answer) => answer.questionId === questionId);
}

export async function getAnswer(
  questionId: string,
  studentId: string,
): Promise<StudentAnswer | undefined> {
  const answers = await getAnswers();

  return answers.find(
    (answer) =>
      answer.questionId === questionId &&
      (answer.studentId === studentId || answer.id === studentId),
  );
}
