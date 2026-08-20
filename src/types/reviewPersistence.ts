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

export type QuestionWordingRevisionOrigin =
  | "captured_pre_edit"
  | "admin_edit";

export type QuestionWordingRevision = {
  questionId: string;
  sourceVersion: string;
  questionInd: string | null;
  questionEn: string | null;
  revisionOrigin: QuestionWordingRevisionOrigin;
  capturedAt: string;
};

export type SaveQuestionWordingRevisionInput = {
  questionId: string;
  expectedSourceVersion: string;
  currentQuestionInd: string;
  currentQuestionEn: string;
  questionInd: string;
  questionEn: string;
};

export type SaveQuestionWordingRevisionResult = {
  questionId: string;
  previousSourceVersion: string;
  sourceVersion: string;
  questionInd: string;
  questionEn: string;
  updatedAt: string;
  capturedAt: string;
};

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
