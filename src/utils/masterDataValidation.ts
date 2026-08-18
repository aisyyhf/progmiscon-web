import type { MasterData } from "../types/masterData";
import {
  getQuestionDisplayCode,
  normalizeAnswerRole,
  normalizeQuestionType,
  normalizeWeek,
} from "./questionMetadata.ts";
import {
  parseContentBlocks,
  parseQuestionOptions,
  parseStringArray,
  parseTestCases,
} from "./masterDataContent.ts";

const TRUE_VALUES = new Set(["true", "1", "yes", "y"]);

export function isActiveValue(value: string): boolean {
  return TRUE_VALUES.has((value ?? "").trim().toLowerCase());
}

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const result = new Set<string>();

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;
    if (seen.has(normalized)) result.add(normalized);
    seen.add(normalized);
  }

  return [...result];
}

export function validateMasterData(data: MasterData): string[] {
  const errors: string[] = [];
  const topicIds = new Set(data.topics.map((row) => row.topic_id.trim()));
  const misconceptionIds = new Set(data.misconceptions.map((row) => row.misconception_id.trim()));
  const questionIds = new Set(data.questions.map((row) => row.question_id.trim()));
  const answerById = new Map(
    data.answers.map((row) => [row.answer_id.trim(), row]),
  );
  const questionTypeById = new Map(
    data.questions.map((row) => [
      row.question_id.trim(),
      normalizeQuestionType(row.question_type),
    ]),
  );

  for (const id of duplicates(data.topics.map((row) => row.topic_id))) errors.push(`topic_id ganda: ${id}`);
  for (const id of duplicates(data.misconceptions.map((row) => row.misconception_id))) errors.push(`misconception_id ganda: ${id}`);
  for (const id of duplicates(data.questions.map((row) => row.question_id))) errors.push(`question_id ganda: ${id}`);
  for (const id of duplicates(data.answers.map((row) => row.answer_id))) errors.push(`answer_id ganda: ${id}`);

  for (const key of duplicates(
    data.questions.map((row) => {
      const system = row.source_system?.trim();
      const sourceKey = row.source_key?.trim();
      return system && sourceKey ? `${system}\u0000${sourceKey}` : "";
    }),
  )) {
    errors.push(`questions source_system/source_key ganda: ${key.replace("\u0000", "/")}`);
  }

  for (const key of duplicates(
    data.answers.map((row) => {
      const system = row.source_system?.trim();
      const sourceKey = row.source_key?.trim();
      return system && sourceKey ? `${system}\u0000${sourceKey}` : "";
    }),
  )) {
    errors.push(`answers source_system/source_key ganda: ${key.replace("\u0000", "/")}`);
  }

  for (const row of data.questions) {
    if (isActiveValue(row.active) && !row.question_type?.trim()) {
      errors.push(`questions ${row.question_id}: question_type wajib diisi untuk soal aktif`);
    } else if (row.question_type?.trim() && !normalizeQuestionType(row.question_type)) {
      errors.push(`questions ${row.question_id}: question_type tidak valid`);
    }
    if (row.week?.trim() && !normalizeWeek(row.week)) {
      errors.push(`questions ${row.question_id}: week tidak valid`);
    }
    if (!getQuestionDisplayCode(row)) {
      errors.push(`questions ${row.question_id}: kode tampilan tidak tersedia`);
    }
    for (const [field, value] of [
      ["content_blocks_ind", row.content_blocks_ind],
      ["content_blocks_en", row.content_blocks_en],
    ] as const) {
      const parsed = parseContentBlocks(value);
      if (parsed.error) errors.push(`questions ${row.question_id}: ${field} ${parsed.error}`);
    }
    const inputs = parseStringArray(row.sample_inputs);
    const outputs = parseStringArray(row.sample_outputs);
    if (inputs.error) errors.push(`questions ${row.question_id}: sample_inputs ${inputs.error}`);
    if (outputs.error) errors.push(`questions ${row.question_id}: sample_outputs ${outputs.error}`);
    if (!inputs.error && !outputs.error && inputs.values.length !== outputs.values.length) {
      errors.push(`questions ${row.question_id}: jumlah sample_inputs dan sample_outputs berbeda`);
    }
    const testCases = parseTestCases(row.test_cases_json);
    if (testCases.error) {
      errors.push(`questions ${row.question_id}: test_cases_json ${testCases.error}`);
    }
    const options = parseQuestionOptions(
      row.options_json,
      row.correct_option_label,
    );
    if (options.error) {
      errors.push(`questions ${row.question_id}: options_json ${options.error}`);
    }
    if (
      normalizeQuestionType(row.question_type) === "multiple_choice" &&
      options.options.length > 0 &&
      options.options.filter((option) => option.isCorrect).length !== 1
    ) {
      errors.push(`questions ${row.question_id}: options_json harus memiliki satu jawaban benar`);
    }
  }

  for (const row of data.misconceptions) {
    if (!topicIds.has(row.topic_id.trim())) errors.push(`misconceptions ${row.misconception_id}: topic_id ${row.topic_id} tidak ditemukan`);
  }

  for (const row of data.questionTopics) {
    if (!questionIds.has(row.question_id.trim())) errors.push(`question_topics: question_id ${row.question_id} tidak ditemukan`);
    if (!topicIds.has(row.topic_id.trim())) errors.push(`question_topics: topic_id ${row.topic_id} tidak ditemukan`);
    if (!["primary", "related"].includes(row.role.trim().toLowerCase())) errors.push(`question_topics ${row.question_id}/${row.topic_id}: role tidak valid`);
  }

  for (const row of data.questionMisconceptions) {
    if (!questionIds.has(row.question_id.trim())) errors.push(`question_misconceptions: question_id ${row.question_id} tidak ditemukan`);
    if (!misconceptionIds.has(row.misconception_id.trim())) errors.push(`question_misconceptions: misconception_id ${row.misconception_id} tidak ditemukan`);
    if (row.evidence_level?.trim() && !["E", "R"].includes(row.evidence_level.trim().toUpperCase())) {
      errors.push(`question_misconceptions ${row.question_id}/${row.misconception_id}: evidence_level tidak valid`);
    }
  }

  for (const row of data.answers) {
    if (!questionIds.has(row.question_id.trim())) errors.push(`answers ${row.answer_id}: question_id ${row.question_id} tidak ditemukan`);
    if (!["correct", "incorrect"].includes(row.status.trim().toLowerCase())) errors.push(`answers ${row.answer_id}: status tidak valid`);
    const role = normalizeAnswerRole(row.answer_role);
    if (!role) {
      errors.push(`answers ${row.answer_id}: answer_role tidak valid`);
      continue;
    }
    const questionType = questionTypeById.get(row.question_id.trim());
    if (role === "mp_option" && questionType !== "multiple_choice") {
      errors.push(`answers ${row.answer_id}: mp_option harus terkait soal MP`);
    }
    if (role === "ps_reference" && questionType !== "short_answer") {
      errors.push(`answers ${row.answer_id}: ps_reference harus terkait soal PS`);
    }
    if (role === "evidence") {
      const misconceptionId = row.evidence_misconception_id?.trim() ?? "";
      if (misconceptionId && !misconceptionIds.has(misconceptionId)) {
        errors.push(`answers ${row.answer_id}: evidence_misconception_id ${misconceptionId} tidak ditemukan`);
      }
      const sourceQuestionIds = parseStringArray(row.evidence_source_question_ids);
      if (sourceQuestionIds.error) {
        errors.push(`answers ${row.answer_id}: evidence_source_question_ids ${sourceQuestionIds.error}`);
      }
    }
  }

  for (const row of data.answerMisconceptions) {
    const answer = answerById.get(row.answer_id.trim());
    if (answer && normalizeAnswerRole(answer.answer_role) !== "mp_option") {
      errors.push(`answer_misconceptions: answer_id ${row.answer_id} bukan mp_option`);
    }
    if (!misconceptionIds.has(row.misconception_id.trim())) errors.push(`answer_misconceptions: misconception_id ${row.misconception_id} tidak ditemukan`);
  }

  for (const row of data.similarMisconceptions) {
    if (!misconceptionIds.has(row.misconception_id.trim())) errors.push(`similar_misconceptions: misconception_id ${row.misconception_id} tidak ditemukan`);
    if (!misconceptionIds.has(row.similar_id.trim())) errors.push(`similar_misconceptions: similar_id ${row.similar_id} tidak ditemukan`);
    if (!["pending", "approved", "rejected"].includes(row.status.trim().toLowerCase())) errors.push(`similar_misconceptions ${row.misconception_id}/${row.similar_id}: status tidak valid`);
  }

  return errors;
}
