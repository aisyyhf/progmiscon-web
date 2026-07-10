import type { Question } from "../types";
import {
  getQuestions,
  getQuestionById,
  getQuestionsByAssessment,
  getQuestionsByCategory,
  getQuestionsByIds,
} from "../services/questionRepository";
import { useAsyncData } from "./useAsyncData";

export function useQuestions(): { questions: Question[]; loading: boolean } {
  const { data, loading } = useAsyncData<Question[]>(getQuestions, [], []);
  return { questions: data, loading };
}

export function useQuestionsByCategory(categoryId: string | undefined): {
  questions: Question[];
  loading: boolean;
} {
  const { data, loading } = useAsyncData<Question[]>(
    () => (categoryId ? getQuestionsByCategory(categoryId) : Promise.resolve([])),
    [categoryId],
    [],
  );
  return { questions: data, loading };
}

export function useQuestionsByAssessment(assessmentId: string | undefined): {
  questions: Question[];
  loading: boolean;
} {
  const { data, loading } = useAsyncData<Question[]>(
    () => (assessmentId ? getQuestionsByAssessment(assessmentId) : Promise.resolve([])),
    [assessmentId],
    [],
  );
  return { questions: data, loading };
}

export function useQuestion(questionId: string | undefined): {
  question: Question | undefined;
  loading: boolean;
} {
  const { data, loading } = useAsyncData<Question | undefined>(
    () => (questionId ? getQuestionById(questionId) : Promise.resolve(undefined)),
    [questionId],
    undefined,
  );
  return { question: data, loading };
}

export function useQuestionsByIds(ids: string[]): { questions: Question[]; loading: boolean } {
  const key = ids.join(",");
  const { data, loading } = useAsyncData<Question[]>(() => getQuestionsByIds(ids), [key], []);
  return { questions: data, loading };
}
