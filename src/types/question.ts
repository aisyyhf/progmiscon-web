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

export type QuestionContentBlock = {
  type: "text" | "code";
  content: string;
};

export type QuestionSampleCase = {
  caseNo?: number;
  input: string;
  output: string;
};

export type Question = {
  id: string;
  sourceVersion?: string;
  contentUpdatedAt?: string;
  assessmentId: string;
  categoryId: string;
  number: string;
  title: LocalizedText;
  shortDescription?: LocalizedText;
  week: string | null;
  sourceSystem: string | null;
  sourceKey: string | null;
  sourceCode: string | null;
  displayCode?: string;
  lmsQuestionId?: string | null;
  probeNo?: string | null;
  targetMisconceptionId?: string | null;
  level: string | null;
  type: QuestionType;
  questionInd?: string;
  questionEn?: string;
  questionCode?: string;
  prompt: LocalizedText;
  contentBlocks?: { id: QuestionContentBlock[]; en: QuestionContentBlock[] };
  inputDescription?: LocalizedText;
  outputDescription?: LocalizedText;
  ioContentType?: string | null;
  sampleCases?: QuestionSampleCase[];
  correctOptionLabel?: string | null;
  evidenceAvailable?: boolean;
  evidenceCount?: number;
  expectedConcepts: LocalizedText[];
  directQuestionMisconceptionIds: string[];
  answerDerivedMisconceptionIds: string[];
  questionMisconceptionIds: QuestionMisconceptionProvenance["questionMisconceptionIds"];
  options?: QuestionOption[];
};
