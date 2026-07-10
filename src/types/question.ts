import type { LocalizedText } from "./language";

export type QuestionType = "short_answer" | "multiple_choice";

export type QuestionOption = {
  id: string;
  label: string;
  text: LocalizedText;
  isCorrect: boolean;
  misconceptionId?: string;
};

export type Question = {
  id: string;
  assessmentId: string;
  categoryId: string;
  number: string;
  type: QuestionType;
  prompt: LocalizedText;
  expectedConcepts: LocalizedText[];
  questionMisconceptionIds: string[];
  options?: QuestionOption[];
};
