import type { StudentAnswer } from "../types";
import { mockStudentAnswers } from "../data/mockStudentAnswers";

export async function getAnswers(): Promise<StudentAnswer[]> {
  return mockStudentAnswers;
}

export async function getAnswersByQuestion(questionId: string): Promise<StudentAnswer[]> {
  return mockStudentAnswers.filter((answer) => answer.questionId === questionId);
}

export async function getAnswer(questionId: string, studentId: string): Promise<StudentAnswer | undefined> {
  return mockStudentAnswers.find(
    (answer) => answer.questionId === questionId && answer.studentId === studentId,
  );
}
