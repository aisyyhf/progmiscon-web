export type QuestionContentOverride = {
  question_id: string;
  question_ind: string | null;
  question_en: string | null;
  question_code: string | null;
  updated_at: string;
};

export type AnswerContentOverride = {
  answer_id: string;
  answer_text: string;
  updated_at: string;
};

export type QuestionMisconceptionOverride = {
  question_id: string;
  misconception_ids: string[];
  published_at: string;
  updated_at: string;
};

export type AnswerMisconceptionOverride = {
  answer_id: string;
  question_id: string;
  misconception_ids: string[];
  published_at: string;
  updated_at: string;
};

export type PublishedMasterOverrides = {
  questionContentOverrides: QuestionContentOverride[];
  answerContentOverrides: AnswerContentOverride[];
  questionMisconceptionOverrides: QuestionMisconceptionOverride[];
  answerMisconceptionOverrides: AnswerMisconceptionOverride[];
};

export type AdminReviewConsensusItem = {
  targetType: "question" | "answer";
  targetId: string;
  questionId: string;
  reviewCount: number;
  removedVotes: Record<string, number>;
  additionalVotes: Record<string, number>;
  publishedMisconceptionIds: string[] | null;
  publishedAt: string | null;
  baselineMisconceptionIds: string[] | null;
  baselineSyncedAt: string | null;
};
