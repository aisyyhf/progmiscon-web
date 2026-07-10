import type { ReviewTask } from "../types";

export const mockReviewTasks: ReviewTask[] = [
  {
    id: "rt-conflict-evenloop",
    questionId: "q-evenloop",
    answerCaseId: "ans-q-evenloop-stu-07",
    suggestedMisconceptionId: "mc-loop-boundary",
    explanation: "The answer excludes 10 and also misses the loop increment, so reviewers disagree on the dominant label.",
    reviewerDecisions: [
      { reviewerId: "rev-01", decision: "agree", selectedMisconceptionId: "mc-loop-boundary" },
      { reviewerId: "rev-02", decision: "disagree", selectedMisconceptionId: "mc-missing-increment" },
    ],
  },
  {
    id: "rt-new-swap",
    questionId: "q-swap",
    answerCaseId: "ans-q-swap-stu-02",
    suggestedMisconceptionId: "mc-swap-no-temp",
    explanation: "The original value of A is overwritten before it can be assigned back to B.",
    reviewerDecisions: [],
  },
  {
    id: "rt-one-boolrange",
    questionId: "q-boolrange",
    answerCaseId: "ans-q-boolrange-stu-02",
    suggestedMisconceptionId: "mc-and-or-confusion",
    explanation: "The selected OR expression accepts values outside the requested inclusive range.",
    reviewerDecisions: [
      { reviewerId: "rev-01", decision: "agree", selectedMisconceptionId: "mc-and-or-confusion" },
    ],
  },
  {
    id: "rt-stable-print15",
    questionId: "q-print15",
    answerCaseId: "ans-q-print15-stu-02",
    suggestedMisconceptionId: "mc-loop-boundary",
    explanation: "The loop condition stops before printing the inclusive upper bound.",
    reviewerDecisions: [
      { reviewerId: "rev-01", decision: "agree", selectedMisconceptionId: "mc-loop-boundary" },
      { reviewerId: "rev-02", decision: "agree", selectedMisconceptionId: "mc-loop-boundary" },
    ],
  },
];
