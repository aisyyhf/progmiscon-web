import type { LocalizedText } from "./language";

export type QuestionType = "short_answer" | "multiple_choice";

export type QuestionOption = {
  id: string;
  label: string;
  text: LocalizedText;
  isCorrect: boolean;
  misconceptionIds: string[];
  misconceptionId?: string;
};

export type QuestionMisconceptionProvenance = {
  directQuestionMisconceptionIds: string[];
  answerDerivedMisconceptionIds: string[];
  questionMisconceptionIds: string[];
};

export type Question = {
  id: string;
  assessmentId: string;
  categoryId: string;
  number: string;
  title: LocalizedText;
  week: string | null;
  sourceSystem: string | null;
  sourceKey: string | null;
  sourceCode: string | null;
  level: string | null;
  type: QuestionType;
  questionInd?: string;
  questionEn?: string;
  questionCode?: string;
  prompt: LocalizedText;
  expectedConcepts: LocalizedText[];
  directQuestionMisconceptionIds: string[];
  answerDerivedMisconceptionIds: string[];
  questionMisconceptionIds: QuestionMisconceptionProvenance["questionMisconceptionIds"];
  options?: QuestionOption[];
};
