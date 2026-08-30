import type {
  AdminReviewer,
  Language,
  MasterData,
  Misconception,
  Question,
} from "../types";
import type { AdminQuestionReviewGroup } from "./adminCurrentReviews";
import type { CsvValue } from "./reviewCsv";
import { formatWibDateTime } from "./reviewCsv.ts";
import { isActiveValue } from "./masterDataValidation.ts";
import {
  getMaterialQuestionType,
  getMaterialWeekLabel,
} from "./materialQuestionFilters.ts";
import { isVisibleSimilarMisconceptionStatus } from "./similarMisconceptions.ts";
import { t } from "./translation.ts";

export type AdminCsvData = {
  headers: string[];
  rows: CsvValue[][];
};

/**
 * Lecturer-facing "Hasil Review Dosen" export. Only current, active reviews that
 * already passed the Admin snapshot's source-version filtering reach this
 * builder; it performs an in-memory presentation transform and never mutates
 * Review or master data. Internal identifiers (review/answer/question UUIDs and
 * source_version) are deliberately omitted in favour of LMS/master metadata.
 */
export const lecturerReviewHeaders = [
  "minggu",
  "tipe_soal",
  "id_lms",
  "kode_soal",
  "kode_miskonsepsi",
  "nama_soal",
  "objek_review",
  "opsi_jawaban",
  "isi_jawaban",
  "reviewer",
  "hasil_review",
  "miskonsepsi_acuan",
  "miskonsepsi_dihapus",
  "alasan_penghapusan",
  "miskonsepsi_ditambahkan",
  "alasan_penambahan",
  "miskonsepsi_usulan_reviewer",
  "catatan",
  "waktu_review",
  "terakhir_diperbarui",
] as const;

export const REVIEWER_NAME_UNAVAILABLE = "(Nama tidak tersedia)";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sortMisconceptionIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort(
    (left, right) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
  );
}

function renderMisconceptionList(
  ids: readonly string[],
  misconceptionById: ReadonlyMap<string, Misconception>,
  language: Language,
): string {
  return sortMisconceptionIds(ids)
    .map((id) => {
      const misconception = misconceptionById.get(id);
      return misconception ? `${id} – ${t(misconception.title, language)}` : id;
    })
    .join("; ");
}

/**
 * Reviewer's proposed final set: reference set minus their removals plus their
 * additions. Mirrors the single-review case of
 * `buildUpdatedQuestionMisconceptionRelations`.
 */
export function reviewerFinalMisconceptionIds(
  referenceIds: readonly string[],
  removedIds: readonly string[],
  addedIds: readonly string[],
): string[] {
  const removed = new Set(removedIds.map((id) => id.trim()).filter(Boolean));
  return sortMisconceptionIds([
    ...referenceIds.filter((id) => !removed.has(id.trim())),
    ...addedIds,
  ]);
}

export function reviewOutcomeLabel(
  removedIds: readonly string[],
  addedIds: readonly string[],
): string {
  const hasRemoval = removedIds.length > 0;
  const hasAddition = addedIds.length > 0;
  if (!hasRemoval && !hasAddition) return "Sesuai – tanpa perubahan";
  if (hasRemoval && !hasAddition) {
    return "Perlu revisi – ada miskonsepsi yang dihapus";
  }
  if (!hasRemoval && hasAddition) {
    return "Perlu revisi – ada miskonsepsi yang ditambahkan";
  }
  return "Perlu revisi – ada penghapusan & penambahan";
}

export function reviewerDisplayName(reviewer: AdminReviewer): string {
  const name = reviewer.fullName?.trim() ?? "";
  if (!name || name === reviewer.reviewerId.trim() || UUID_PATTERN.test(name)) {
    return REVIEWER_NAME_UNAVAILABLE;
  }
  return name;
}

function questionLmsId(question: Question): string {
  // MP probes never carry an LMS question id; keep the column blank for them.
  if (question.type === "multiple_choice") return "";
  return question.lmsQuestionId?.trim() ?? "";
}

function questionSourceCode(question: Question): string {
  if (question.type === "multiple_choice") {
    return question.displayCode?.trim() ?? "";
  }
  // PS: the lecturer/source question code. Fall back to the display code only
  // when source_code is unexpectedly missing so a row is never left blank.
  return question.sourceCode?.trim() || question.displayCode?.trim() || "";
}

export function buildCurrentReviewsCsv(
  groups: readonly AdminQuestionReviewGroup[],
  options: {
    misconceptions: readonly Misconception[];
    language: Language;
  },
): AdminCsvData {
  const { language } = options;
  const misconceptionById = new Map(
    options.misconceptions.map((item) => [item.id, item] as const),
  );
  const rows: CsvValue[][] = [];

  for (const group of groups) {
    const { question } = group;
    const minggu = question.week ? getMaterialWeekLabel(question.week) : "";
    const tipeSoal = getMaterialQuestionType(question.type).toUpperCase();
    const idLms = questionLmsId(question);
    const kodeSoal = questionSourceCode(question);
    const kodeMiskonsepsi = question.targetMisconceptionId?.trim() ?? "";
    const namaSoal = t(question.title, language);

    const reviewers = [...group.reviewers].sort((left, right) => {
      const nameOrder = reviewerDisplayName(left.reviewer).localeCompare(
        reviewerDisplayName(right.reviewer),
        undefined,
        { sensitivity: "base" },
      );
      if (nameOrder !== 0) return nameOrder;
      return left.reviewer.reviewerId.localeCompare(right.reviewer.reviewerId);
    });

    for (const reviewerGroup of reviewers) {
      const reviewer = reviewerDisplayName(reviewerGroup.reviewer);
      const questionReview = reviewerGroup.questionReview;

      if (questionReview) {
        const referenceIds = question.questionMisconceptionIds;
        rows.push([
          minggu,
          tipeSoal,
          idLms,
          kodeSoal,
          kodeMiskonsepsi,
          namaSoal,
          "Soal",
          "",
          "",
          reviewer,
          reviewOutcomeLabel(
            questionReview.removedMisconceptionIds,
            questionReview.additionalMisconceptionIds,
          ),
          renderMisconceptionList(referenceIds, misconceptionById, language),
          renderMisconceptionList(
            questionReview.removedMisconceptionIds,
            misconceptionById,
            language,
          ),
          questionReview.removalReason ?? "",
          renderMisconceptionList(
            questionReview.additionalMisconceptionIds,
            misconceptionById,
            language,
          ),
          questionReview.additionReason ?? "",
          renderMisconceptionList(
            reviewerFinalMisconceptionIds(
              referenceIds,
              questionReview.removedMisconceptionIds,
              questionReview.additionalMisconceptionIds,
            ),
            misconceptionById,
            language,
          ),
          questionReview.note ?? "",
          formatWibDateTime(questionReview.createdAt),
          formatWibDateTime(questionReview.updatedAt),
        ]);
      }

      for (const { answer, review } of reviewerGroup.answerReviews) {
        const referenceIds = answer.studentMisconceptionIds;
        rows.push([
          minggu,
          tipeSoal,
          idLms,
          kodeSoal,
          kodeMiskonsepsi,
          namaSoal,
          "Opsi jawaban",
          answer.optionLabel ?? "",
          answer.answerText ?? "",
          reviewer,
          reviewOutcomeLabel(
            review.removedMisconceptionIds,
            review.additionalMisconceptionIds,
          ),
          renderMisconceptionList(referenceIds, misconceptionById, language),
          renderMisconceptionList(
            review.removedMisconceptionIds,
            misconceptionById,
            language,
          ),
          review.removalReason ?? "",
          renderMisconceptionList(
            review.additionalMisconceptionIds,
            misconceptionById,
            language,
          ),
          review.additionReason ?? "",
          renderMisconceptionList(
            reviewerFinalMisconceptionIds(
              referenceIds,
              review.removedMisconceptionIds,
              review.additionalMisconceptionIds,
            ),
            misconceptionById,
            language,
          ),
          review.note ?? "",
          formatWibDateTime(review.createdAt),
          formatWibDateTime(review.updatedAt),
        ]);
      }
    }
  }

  return { headers: [...lecturerReviewHeaders], rows };
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
