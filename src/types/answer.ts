import type { LocalizedText } from "./language";
import type { AnswerRole } from "./masterData";

export type AnswerStatus = "correct" | "incorrect";

export type CheckKey = "output" | "logic" | "pseudocode" | "concept";

export type AnswerCheck = {
  key: CheckKey;
  passed: boolean;
};

export type StudentAnswer = {
  id: string;
  sourceVersion?: string;
  questionId: string;
  answerRole?: AnswerRole;
  optionLabel?: string | null;
  studentId: string;
  studentName?: string | null;
  studentUserId?: string | null;
  explanation?: LocalizedText;
  sourceSystem?: string | null;
  sourceKey?: string | null;
  order?: number | null;
  status: AnswerStatus;
  answerText?: string;
  selectedOptionId?: string;
  checks: AnswerCheck[];
  masteredConcepts: LocalizedText[];
  incorrectElements: LocalizedText[];
  studentMisconceptionIds: string[];
  misconceptionReasons?: Array<{
    misconceptionId: string;
    reason: LocalizedText;
  }>;
  isEvidence?: boolean;
  evidenceSource?: string | null;
  evidenceMisconceptionIds?: string[];
  evidenceReasons?: Array<{
    misconceptionId: string;
    reason: LocalizedText;
  }>;
  studentAnswer?: string | null;
  evidenceId?: string | null;
  evidenceMisconceptionId?: string | null;
  evidenceExplanation?: LocalizedText;
  evidenceTag?: string | null;
  evidenceSourceQuestionIds?: string[];
  sourceSheet?: string | null;
  sourceRow?: string | null;
};
