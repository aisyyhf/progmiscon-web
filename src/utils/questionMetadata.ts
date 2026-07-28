import type { AnswerRow } from "../types/masterData";
import type { QuestionOption, QuestionType } from "../types";

const QUESTION_TYPES = new Map<string, QuestionType>([
  ["ps", "short_answer"],
  ["essay", "short_answer"],
  ["short answer", "short_answer"],
  ["short_answer", "short_answer"],
  ["mp", "multiple_choice"],
  ["multiple choice", "multiple_choice"],
  ["multiple_choice", "multiple_choice"],
]);

export function normalizeQuestionType(value: string | null | undefined): QuestionType | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized ? (QUESTION_TYPES.get(normalized) ?? null) : "short_answer";
}

export function normalizeWeek(value: string | number | null | undefined): string | null {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;

  const match = normalized.match(/^(?:w(?:eek)?\s*)?(\d{1,2})(?:\s*[-–]\s*(?:w(?:eek)?\s*)?(\d{1,2}))?$/i);
  if (!match) return null;

  const start = Number(match[1]);
  const end = match[2] ? Number(match[2]) : undefined;
  if (start < 1 || (end !== undefined && (end < 1 || start > end))) return null;

  const week = (number: number) => String(number).padStart(2, "0");
  return end === undefined ? `W${week(start)}` : `W${week(start)}-${week(end)}`;
}

export function questionOptionLabel(order: number): string {
  if (!Number.isInteger(order) || order < 1) return String(order);

  let label = "";
  for (let value = order; value > 0; value = Math.floor((value - 1) / 26)) {
    label = String.fromCharCode(65 + ((value - 1) % 26)) + label;
  }
  return label;
}

export function getQuestionOptionMisconceptionIds(
  option: Pick<QuestionOption, "misconceptionIds">,
): string[] {
  return [...new Set(
    option.misconceptionIds
      .map((id) => id.trim())
      .filter(Boolean),
  )].sort((left, right) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
}

export function buildQuestionOptions(
  answers: AnswerRow[],
  misconceptionIdsByAnswer: ReadonlyMap<string, string[]>,
): QuestionOption[] {
  return [...answers]
    .sort((a, b) => Number.parseInt(a.order_no, 10) - Number.parseInt(b.order_no, 10))
    .map((answer, index) => {
      const order = Number.parseInt(answer.order_no, 10);
      const misconceptionIds = [...new Set(
        (misconceptionIdsByAnswer.get(answer.answer_id.trim()) ?? [])
          .map((id) => id.trim())
          .filter(Boolean),
      )].sort((left, right) =>
        left.localeCompare(right, undefined, { numeric: true }),
      );
      const answerText = answer.answer_text.trim();

      return {
        id: answer.answer_id.trim(),
        label: questionOptionLabel(Number.isInteger(order) && order > 0 ? order : index + 1),
        text: { id: answerText, en: answerText },
        isCorrect: answer.status.trim().toLowerCase() === "correct",
        misconceptionId:
          misconceptionIds.length === 1 ? misconceptionIds[0] : undefined,
        misconceptionIds,
      };
    });
}

export function selectedOptionIdForAnswer(
  questionType: QuestionType,
  answerId: string,
): string | undefined {
  return questionType === "multiple_choice" ? answerId : undefined;
}
