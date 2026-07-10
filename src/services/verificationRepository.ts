import type { VerificationCheck } from "../types";
import { mockVerificationChecks } from "../data/mockVerificationChecks";

export async function getVerificationChecks(
  questionId: string,
  studentId: string,
): Promise<VerificationCheck[]> {
  return mockVerificationChecks.filter(
    (check) => check.questionId === questionId && check.studentId === studentId,
  );
}

export async function getVerificationChecksForMisconception(
  misconceptionId: string,
): Promise<VerificationCheck[]> {
  return mockVerificationChecks.filter((check) => check.misconceptionId === misconceptionId);
}

export async function getVerificationCheckForMisconception(
  questionId: string,
  studentId: string,
  misconceptionId: string,
): Promise<VerificationCheck | undefined> {
  return mockVerificationChecks.find(
    (check) =>
      check.questionId === questionId &&
      check.studentId === studentId &&
      check.misconceptionId === misconceptionId,
  );
}
