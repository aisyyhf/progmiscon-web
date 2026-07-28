import type { Question } from "../types";
import { buildMockQuestions } from "../data/mockQuestions";
import { mockStudentAnswers } from "../data/mockStudentAnswers";
import { usesGoogleSheets } from "../config/masterDataConfig";
import { getMasterData, getSheetQuestions } from "./masterDataRepository";
import { filterQuestionsByTopicRelations } from "../utils/filters";

const mockQuestions = buildMockQuestions(mockStudentAnswers);

export async function getQuestions(): Promise<Question[]> {
  return usesGoogleSheets() ? getSheetQuestions() : mockQuestions;
}

export async function getQuestionById(id: string): Promise<Question | undefined> {
  const questions = await getQuestions();
  return questions.find((question) => question.id === id);
}

export async function getQuestionsByCategory(categoryId: string): Promise<Question[]> {
  const questions = await getQuestions();
  if (!usesGoogleSheets()) {
    return questions.filter((question) => question.categoryId === categoryId);
  }

  const { questionTopics } = await getMasterData();
  return filterQuestionsByTopicRelations(questions, questionTopics, categoryId);
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
