import type { Question } from "../types";
import { mockQuestions } from "../data/mockQuestions";

export async function getQuestions(): Promise<Question[]> {
  return mockQuestions;
}

export async function getQuestionById(id: string): Promise<Question | undefined> {
  return mockQuestions.find((question) => question.id === id);
}

export async function getQuestionsByCategory(categoryId: string): Promise<Question[]> {
  return mockQuestions.filter((question) => question.categoryId === categoryId);
}

export async function getQuestionsByAssessment(assessmentId: string): Promise<Question[]> {
  return mockQuestions
    .filter((question) => question.assessmentId === assessmentId)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  const idSet = new Set(ids);
  return mockQuestions.filter((question) => idSet.has(question.id));
}
