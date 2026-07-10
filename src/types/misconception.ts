import type { LocalizedText } from "./language";

export type Misconception = {
  id: string;
  categoryId: string;
  title: LocalizedText;
  wrong: LocalizedText;
  correct: LocalizedText;
  fix: LocalizedText;
  cause: LocalizedText;
  pattern: LocalizedText[];
  value: LocalizedText;
  relatedMisconceptionIds: string[];
  relatedQuestionIds: string[];
};
