import type { Assessment } from "../types";
import { getAssessments } from "../services/assessmentRepository";
import { useAsyncData } from "./useAsyncData";

export function useAssessments(): { assessments: Assessment[]; loading: boolean } {
  const { data, loading } = useAsyncData<Assessment[]>(getAssessments, [], []);
  return { assessments: data, loading };
}
