import type { LocalizedText } from "./language";

export type ReviewerDecision = {
  reviewerId: string;
  decision: "agree" | "disagree";
  selectedMisconceptionId: string;
  note?: string;
};

export type ReviewTask = {
  id: string;
  questionId: string;
  answerCaseId: string;
  suggestedMisconceptionId: string;
  explanation: LocalizedText;
  reviewerDecisions: ReviewerDecision[];
};
