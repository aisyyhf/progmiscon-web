import type { MasterData } from "../types";
import type { AdminQuestionReviewGroup } from "./adminCurrentReviews";
import type { CsvValue } from "./reviewCsv";
import { isActiveValue } from "./masterDataValidation.ts";
import { isVisibleSimilarMisconceptionStatus } from "./similarMisconceptions.ts";

export type AdminCsvData = {
  headers: string[];
  rows: CsvValue[][];
};

const reviewHeaders = [
  "review_type",
  "review_id",
  "reviewer_id",
  "reviewer_name",
  "reviewer_email",
  "question_id",
  "answer_id",
  "answer_option",
  "source_version",
  "is_active",
  "has_incorrect_question_misconceptions",
  "has_mismatched_answer_misconceptions",
  "has_additional_misconceptions",
  "removed_misconception_ids",
  "removal_reason",
  "additional_misconception_ids",
  "addition_reason",
  "note",
  "created_at",
  "updated_at",
];

export function buildCurrentReviewsCsv(
  groups: readonly AdminQuestionReviewGroup[],
): AdminCsvData {
  const rows: CsvValue[][] = [];

  for (const group of groups) {
    for (const reviewerGroup of group.reviewers) {
      const reviewer = reviewerGroup.reviewer;
      const questionReview = reviewerGroup.questionReview;

      if (questionReview) {
        rows.push([
          "question",
          questionReview.id,
          reviewer.reviewerId,
          reviewer.fullName,
          reviewer.email,
          group.question.id,
          "",
          "",
          questionReview.sourceVersion,
          questionReview.isActive,
          questionReview.hasIncorrectMisconceptions,
          "",
          questionReview.hasAdditionalMisconceptions,
          questionReview.removedMisconceptionIds.join("|"),
          questionReview.removalReason,
          questionReview.additionalMisconceptionIds.join("|"),
          questionReview.additionReason,
          questionReview.note,
          questionReview.createdAt,
          questionReview.updatedAt,
        ]);
      }

      for (const { answer, review } of reviewerGroup.answerReviews) {
        rows.push([
          "answer",
          review.id,
          reviewer.reviewerId,
          reviewer.fullName,
          reviewer.email,
          group.question.id,
          answer.id,
          answer.optionLabel,
          review.sourceVersion,
          review.isActive,
          "",
          review.hasMismatchedMisconceptions,
          review.hasAdditionalMisconceptions,
          review.removedMisconceptionIds.join("|"),
          review.removalReason,
          review.additionalMisconceptionIds.join("|"),
          review.additionReason,
          review.note,
          review.createdAt,
          review.updatedAt,
        ]);
      }
    }
  }

  return { headers: reviewHeaders, rows };
}

export function buildCurrentQuestionsCsv(data: MasterData): AdminCsvData {
  return {
    headers: [
      "question_id",
      "question_type",
      "source_system",
      "source_key",
      "source_code",
      "level",
      "title_ind",
      "title_en",
      "question_ind",
      "question_en",
      "question_code",
      "short_description_ind",
      "short_description_en",
      "content_blocks_ind",
      "content_blocks_en",
      "input_description_ind",
      "input_description_en",
      "output_description_ind",
      "output_description_en",
      "test_cases_json",
      "options_json",
      "correct_option_label",
      "reference_solution",
      "expected_output",
      "week",
      "source_no",
      "order_no",
      "active",
      "data_status",
    ],
    rows: data.questions.filter((row) => isActiveValue(row.active)).map((row) => [
      row.question_id,
      row.question_type,
      row.source_system,
      row.source_key,
      row.source_code,
      row.level,
      row.title_ind,
      row.title_en,
      row.question_ind,
      row.question_en,
      row.question_code,
      row.short_description_ind,
      row.short_description_en,
      row.content_blocks_ind,
      row.content_blocks_en,
      row.input_description_ind,
      row.input_description_en,
      row.output_description_ind,
      row.output_description_en,
      row.test_cases_json,
      row.options_json,
      row.correct_option_label,
      row.reference_solution,
      row.expected_output,
      row.week,
      row.source_no,
      row.order_no,
      row.active,
      row.data_status,
    ]),
  };
}

export function buildCurrentAnswersCsv(data: MasterData): AdminCsvData {
  const activeQuestionIds = new Set(
    data.questions
      .filter((row) => isActiveValue(row.active))
      .map((row) => row.question_id.trim()),
  );

  return {
    headers: [
      "answer_id",
      "question_id",
      "answer_role",
      "option_label",
      "answer_text",
      "status",
      "explanation_ind",
      "explanation_en",
      "student_answer",
      "is_evidence",
      "evidence_source",
      "evidence_misconceptions",
      "evidence_reason_ind",
      "evidence_reason_en",
      "evidence_misconception_id",
      "evidence_explanation_ind",
      "evidence_explanation_en",
      "evidence_tag",
      "evidence_source_question_ids",
      "evidence_id",
      "order_no",
      "active",
    ],
    rows: data.answers
      .filter(
        (row) =>
          isActiveValue(row.active) &&
          activeQuestionIds.has(row.question_id.trim()) &&
          ["mp_option", "ps_reference", "evidence"].includes(
            row.answer_role?.trim().toLowerCase() ?? "",
          ),
      )
      .map((row) => [
        row.answer_id,
        row.question_id,
        row.answer_role,
        row.option_label,
        row.answer_text,
        row.status,
        row.explanation_ind,
        row.explanation_en,
        row.student_answer,
        row.is_evidence,
        row.evidence_source,
        row.evidence_misconceptions,
        row.evidence_reason_ind,
        row.evidence_reason_en,
        row.evidence_misconception_id,
        row.evidence_explanation_ind,
        row.evidence_explanation_en,
        row.evidence_tag,
        row.evidence_source_question_ids,
        row.evidence_id,
        row.order_no,
        row.active,
      ]),
  };
}

export function buildCurrentQuestionMisconceptionsCsv(data: MasterData): AdminCsvData {
  const activeQuestionIds = new Set(
    data.questions
      .filter((row) => isActiveValue(row.active))
      .map((row) => row.question_id.trim()),
  );
  const activeMisconceptionIds = new Set(
    data.misconceptions
      .filter((row) => isActiveValue(row.active))
      .map((row) => row.misconception_id.trim()),
  );
  return {
    headers: [
      "question_id",
      "misconception_id",
      "source",
      "evidence_level",
      "rationale_ind",
      "source_question_id",
      "active",
    ],
    rows: data.questionMisconceptions
      .filter(
        (row) =>
          isActiveValue(row.active) &&
          activeQuestionIds.has(row.question_id.trim()) &&
          activeMisconceptionIds.has(row.misconception_id.trim()),
      )
      .map((row) => [
        row.question_id,
        row.misconception_id,
        row.source,
        row.evidence_level,
        row.rationale_ind,
        row.source_question_id,
        row.active,
      ]),
  };
}

export function buildCurrentAnswerMisconceptionsCsv(data: MasterData): AdminCsvData {
  const activeQuestionIds = new Set(
    data.questions
      .filter((row) => isActiveValue(row.active))
      .map((row) => row.question_id.trim()),
  );
  const activeAnswerIds = new Set(
    data.answers
      .filter(
        (row) =>
          isActiveValue(row.active) &&
          activeQuestionIds.has(row.question_id.trim()) &&
          row.answer_role?.trim().toLowerCase() === "mp_option",
      )
      .map((row) => row.answer_id.trim()),
  );
  const activeMisconceptionIds = new Set(
    data.misconceptions
      .filter((row) => isActiveValue(row.active))
      .map((row) => row.misconception_id.trim()),
  );
  return {
    headers: [
      "answer_id",
      "misconception_id",
      "reason_ind",
      "reason_en",
      "active",
    ],
    rows: data.answerMisconceptions
      .filter(
        (row) =>
          isActiveValue(row.active) &&
          activeAnswerIds.has(row.answer_id.trim()) &&
          activeMisconceptionIds.has(row.misconception_id.trim()),
      )
      .map((row) => [
        row.answer_id,
        row.misconception_id,
        row.reason_ind,
        row.reason_en,
        row.active,
      ]),
  };
}

export function buildCurrentSimilarMisconceptionsCsv(data: MasterData): AdminCsvData {
  const activeMisconceptionIds = new Set(
    data.misconceptions
      .filter((row) => isActiveValue(row.active))
      .map((row) => row.misconception_id.trim()),
  );
  return {
    headers: [
      "misconception_id",
      "similar_id",
      "note_ind",
      "note_en",
      "status",
    ],
    rows: data.similarMisconceptions
      .filter(
        (row) =>
          isVisibleSimilarMisconceptionStatus(row.status) &&
          activeMisconceptionIds.has(row.misconception_id.trim()) &&
          activeMisconceptionIds.has(row.similar_id.trim()),
      )
      .map((row) => [
        row.misconception_id,
        row.similar_id,
        row.note_ind,
        row.note_en,
        row.status,
      ]),
  };
}
