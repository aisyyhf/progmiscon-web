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
  rationale_ind?: string;
  rationale_source?: string;
};

export type QuestionRow = {
  question_id: string;
  question_type?: string;
  source_system?: string;
  source_key?: string;
  source_code?: string;
  level?: string;
  title_ind: string;
  title_en: string;
  question_ind: string;
  question_en: string;
  question_code: string;
  short_description_ind?: string;
  short_description_en?: string;
  content_blocks_ind?: string;
  content_blocks_en?: string;
  sample_inputs?: string;
  sample_outputs?: string;
  probe_no?: string;
  target_misconception_id?: string;
  input_description_ind?: string;
  input_description_en?: string;
  output_description_ind?: string;
  output_description_en?: string;
  io_content_type?: string;
  test_cases_json?: string;
  options_json?: string;
  correct_option_label?: string;
  evidence_available?: string;
  lms_question_id?: string;
  display_question_code?: string;
  reference_solution: string;
  expected_output: string;
  week: string;
  source_no: string;
  order_no: string;
  active: string;
  data_status: string;
  content_override_updated_at?: string;
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
  evidence_level?: string;
  rationale_ind?: string;
  source_question_id?: string;
};

export type AnswerRole = "mp_option" | "ps_reference" | "evidence";

export type AnswerRow = {
  answer_id: string;
  question_id: string;
  source_system?: string;
  source_key?: string;
  student_name?: string;
  student_user_id?: string;
  is_evidence?: string;
  evidence_source?: string;
  evidence_misconceptions?: string;
  evidence_reason_ind?: string;
  evidence_reason_en?: string;
  option_label?: string;
  answer_role?: string;
  student_answer?: string;
  evidence_misconception_id?: string;
  evidence_explanation_ind?: string;
  evidence_explanation_en?: string;
  evidence_tag?: string;
  evidence_source_question_ids?: string;
  source_sheet?: string;
  source_row?: string;
  evidence_id?: string;
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
