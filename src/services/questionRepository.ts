import type { Question } from "../types";
import { mockQuestions } from "../data/mockQuestions";
import { usesGoogleSheets } from "../config/masterDataConfig";
import { getSheetQuestions } from "./masterDataRepository";

export async function getQuestions(): Promise<Question[]> {
  return usesGoogleSheets() ? getSheetQuestions() : mockQuestions;
}

export async function getQuestionById(id: string): Promise<Question | undefined> {
  const questions = await getQuestions();
  return questions.find((question) => question.id === id);
}

export async function getQuestionsByCategory(categoryId: string): Promise<Question[]> {
  const questions = await getQuestions();
  return questions.filter((question) => question.categoryId === categoryId);
}

export async function getQuestionsByAssessment(assessmentId: string): Promise<Question[]> {
  const questions = await getQuestions();
  return questions
    .filter((question) => question.assessmentId === assessmentId)
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
}

export async function getQuestionsByIds(ids: string[]): Promise<Question[]> {
  const idSet = new Set(ids);
  const questions = await getQuestions();
  return questions.filter((question) => idSet.has(question.id));
}
