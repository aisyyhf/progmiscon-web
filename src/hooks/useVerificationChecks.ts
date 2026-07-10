import type { VerificationCheck } from "../types";
import {
  getVerificationCheckForMisconception,
  getVerificationChecks,
  getVerificationChecksForMisconception,
} from "../services/verificationRepository";
import { useAsyncData } from "./useAsyncData";

export function useVerificationChecks(
  questionId: string | undefined,
  studentId: string | undefined,
): { checks: VerificationCheck[]; loading: boolean } {
  const { data, loading } = useAsyncData<VerificationCheck[]>(
    () => (questionId && studentId ? getVerificationChecks(questionId, studentId) : Promise.resolve([])),
    [questionId, studentId],
    [],
  );
  return { checks: data, loading };
}

export function useVerificationCheckForMisconception(
  questionId: string | undefined,
  studentId: string | undefined,
  misconceptionId: string | undefined,
): { check: VerificationCheck | undefined; loading: boolean } {
  const { data, loading } = useAsyncData<VerificationCheck | undefined>(
    () =>
      questionId && studentId && misconceptionId
        ? getVerificationCheckForMisconception(questionId, studentId, misconceptionId)
        : Promise.resolve(undefined),
    [questionId, studentId, misconceptionId],
    undefined,
  );
  return { check: data, loading };
}

export function useVerificationChecksForMisconception(
  misconceptionId: string | undefined,
): { checks: VerificationCheck[]; loading: boolean } {
  const { data, loading } = useAsyncData<VerificationCheck[]>(
    () => (misconceptionId ? getVerificationChecksForMisconception(misconceptionId) : Promise.resolve([])),
    [misconceptionId],
    [],
  );
  return { checks: data, loading };
}
