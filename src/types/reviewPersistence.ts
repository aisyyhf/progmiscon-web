export type QuestionReviewValues = {
  hasIncorrectMisconceptions: boolean;
  removedMisconceptionIds: string[];
  removalReason: string | null;
  hasAdditionalMisconceptions: boolean;
  additionalMisconceptionIds: string[];
  additionReason: string | null;
  note: string | null;
};

export type AnswerReviewValues = {
  hasMismatchedMisconceptions: boolean;
  removedMisconceptionIds: string[];
  removalReason: string | null;
  hasAdditionalMisconceptions: boolean;
  additionalMisconceptionIds: string[];
  additionReason: string | null;
  note: string | null;
};

export type ReviewProgress = {
  questionIds: string[];
  answerIds: string[];
};

export type QuestionReviewHistoryItem = {
  id: string;
  reviewerId: string;
  questionId: string;
  hasIncorrectMisconceptions: boolean;
  removedMisconceptionIds: string[];
  removalReason: string | null;
  hasAdditionalMisconceptions: boolean;
  additionalMisconceptionIds: string[];
  additionReason: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AnswerReviewHistoryItem = {
  id: string;
  reviewerId: string;
  answerId: string;
  questionId: string;
  hasMismatchedMisconceptions: boolean;
  removedMisconceptionIds: string[];
  removalReason: string | null;
  hasAdditionalMisconceptions: boolean;
  additionalMisconceptionIds: string[];
  additionReason: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ReviewerHistory = {
  questionReviews: QuestionReviewHistoryItem[];
  answerReviews: AnswerReviewHistoryItem[];
};
