import type { LocalizedText } from "./language";

export type AnswerStatus = "correct" | "incorrect";

export type CheckKey = "output" | "logic" | "pseudocode" | "concept";

export type AnswerCheck = {
  key: CheckKey;
  passed: boolean;
};

export type StudentAnswer = {
  id: string;
  questionId: string;
  studentId: string;
  status: AnswerStatus;
  answerText?: string;
  selectedOptionId?: string;
  checks: AnswerCheck[];
  masteredConcepts: LocalizedText[];
  incorrectElements: LocalizedText[];
  studentMisconceptionIds: string[];
};
