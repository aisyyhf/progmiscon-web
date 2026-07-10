import type { LocalizedText } from "./language";

export type Concept = {
  id: string;
  categoryId?: string;
  name: LocalizedText;
  description: LocalizedText;
  relatedConceptIds: string[];
  relatedMisconceptionIds: string[];
  relatedQuestionIds: string[];
};
