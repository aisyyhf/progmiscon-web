export type TopicRow = {
  topic_id: string;
  name_ind: string;
  name_en: string;
  description_ind: string;
  description_en: string;
  order_no: string;
  active: string;
};

export type MisconceptionRow = {
  misconception_id: string;
  topic_id: string;
  title_ind: string;
  title_en: string;
  description_ind: string;
  description_en: string;
  wrong_example: string;
  correct_example: string;
  correction_ind: string;
  correction_en: string;
  common_cause_ind: string;
  common_cause_en: string;
  order_no: string;
  active: string;
};

export type QuestionRow = {
  question_id: string;
  title_ind: string;
  title_en: string;
  question_ind: string;
  question_en: string;
  question_code: string;
  reference_solution: string;
  expected_output: string;
  week: string;
  source_no: string;
  order_no: string;
  active: string;
  data_status: string;
};

export type QuestionTopicRow = {
  question_id: string;
  topic_id: string;
  role: string;
};

export type QuestionMisconceptionRow = {
  question_id: string;
  misconception_id: string;
  source: string;
  active: string;
};

export type AnswerRow = {
  answer_id: string;
  question_id: string;
  answer_text: string;
  status: string;
  explanation_ind: string;
  explanation_en: string;
  order_no: string;
  active: string;
};

export type AnswerMisconceptionRow = {
  answer_id: string;
  misconception_id: string;
  reason_ind: string;
  reason_en: string;
  active: string;
};

export type SimilarMisconceptionRow = {
  misconception_id: string;
  similar_id: string;
  note_ind: string;
  note_en: string;
  status: string;
};

export type MasterData = {
  topics: TopicRow[];
  misconceptions: MisconceptionRow[];
  questions: QuestionRow[];
  questionTopics: QuestionTopicRow[];
  questionMisconceptions: QuestionMisconceptionRow[];
  answers: AnswerRow[];
  answerMisconceptions: AnswerMisconceptionRow[];
  similarMisconceptions: SimilarMisconceptionRow[];
};
