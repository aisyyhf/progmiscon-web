import type { StudentAnswer } from "../types";
import { getAnswers, getAnswersByQuestion } from "../services/answerRepository";
import { useAsyncData } from "./useAsyncData";

export function useAllStudentAnswers(): {
  answers: StudentAnswer[];
  loading: boolean;
} {
  const { data, loading } = useAsyncData<StudentAnswer[]>(getAnswers, [], []);
  return { answers: data, loading };
}

export function useStudentAnswers(questionId: string | undefined): {
  answers: StudentAnswer[];
  loading: boolean;
} {
  const { data, loading } = useAsyncData<StudentAnswer[]>(
    () => (questionId ? getAnswersByQuestion(questionId) : Promise.resolve([])),
    [questionId],
    [],
  );
  return { answers: data, loading };
}
