import type { LocalizedText } from "./language";

export type Misconception = {
  id: string;
  categoryId: string;
  title: LocalizedText;
  description?: LocalizedText;
  wrong: LocalizedText;
  correct: LocalizedText;
  hasWrongExample?: boolean;
  hasCorrectExample?: boolean;
  fix: LocalizedText;
  cause: LocalizedText;
  pattern: LocalizedText[];
  value: LocalizedText;
  relatedMisconceptionIds: string[];
  relatedQuestionIds: string[];
};
