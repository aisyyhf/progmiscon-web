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
  questionReviewCount: number;
  answerReviewCount: number;
  latestUpdatedAt: string | null;
};

export type QuestionReviewCount = {
  questionId: string;
  reviewCount: number;
  latestUpdatedAt: string | null;
};

export type AnswerReviewCount = {
  answerId: string;
  reviewCount: number;
  latestUpdatedAt: string | null;
};

export type QuestionWordingAuthorityState = {
  questionId: string;
  questionInd: string;
  questionEn: string;
  editable: boolean;
  readOnlyReason: string | null;
  authoritySha256: string;
  overrideVersion: string | null;
  updatedAt: string | null;
};

export type SaveQuestionWordingOverrideInput = {
  questionId: string;
  expectedAuthoritySha256: string;
  expectedOverrideVersion: string | null;
  questionInd: string;
  questionEn: string;
};

export type SaveQuestionWordingOverrideResult = QuestionWordingAuthorityState;

export type ReviewSourceVersions = {
  questions: Map<string, string>;
  answers: Map<string, { questionId: string; sourceVersion: string }>;
};

export type QuestionReviewHistoryItem = {
  id: string;
  reviewerId: string;
  questionId: string;
  sourceVersion: string;
  isActive: boolean;
  inactiveReason: string | null;
  inactiveAt: string | null;
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
  sourceVersion: string;
  isActive: boolean;
  inactiveReason: string | null;
  inactiveAt: string | null;
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

export type AdminReviewer = {
  reviewerId: string;
  fullName: string;
  email: string;
};

export type AdminQuestionReviewHistoryItem = QuestionReviewHistoryItem &
  AdminReviewer;

export type AdminAnswerReviewHistoryItem = AnswerReviewHistoryItem &
  AdminReviewer;

export type AdminReviewHistory = {
  questionReviews: AdminQuestionReviewHistoryItem[];
  answerReviews: AdminAnswerReviewHistoryItem[];
  reviewers: AdminReviewer[];
};
