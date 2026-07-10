import type { LocalizedText } from "./language";

export type VerificationResult = "confirmed" | "not_confirmed" | "needs_review";

export type VerificationCheck = {
  id: string;
  questionId: string;
  studentId: string;
  misconceptionId: string;
  prompt: LocalizedText;
  pseudocode?: string;
  expectedAnswer: LocalizedText;
  studentAnswer: LocalizedText;
  result: VerificationResult;
  explanation: LocalizedText;
};
