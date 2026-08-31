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

/**
 * "Aktivitas Terakhir" for a review lifecycle generation. An edited review is
 * still active; `edited` is an activity, not a status.
 */
export type ReviewLastActivity = "created" | "edited" | "deleted";

/** "Status Review" for a review lifecycle generation. */
export type ReviewLifecycleStatus = "active" | "deleted";

/**
 * Per review-row projection of review_audit_log used only by Admin surfaces to
 * label lifecycle generations. Never feeds counts or consensus.
 */
export type ReviewLifecycleRow = {
  reviewType: "question" | "answer";
  reviewId: string;
  lastEventType: string;
  lastEventAt: string | null;
  edited: boolean;
  lastDeletedAt: string | null;
  lastDeletedBefore: Record<string, unknown> | null;
};
