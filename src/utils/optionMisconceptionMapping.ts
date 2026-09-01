import type { LocalizedText, Question, StudentAnswer } from "../types";
import { normalizeEffectiveIds } from "./effectiveMasterData.ts";

/**
 * One multiple-choice option paired with the EFFECTIVE misconception relation
 * for it. "Effective" means the `answer_misconceptions` baseline with any valid
 * published `answer_misconception_overrides` already applied -- exactly what
 * `getSheetAnswers()` returns for `mp_option` answers. It is deliberately NOT
 * `question.options[].misconceptionIds` (which can come from a stale
 * `options_json` snapshot in the questions sheet) and NOT `answer_reviews` or
 * review history.
 *
 * The option and its answer row are joined by the stable answer id
 * (`option.id === answer.id`). This is read-only context for the MP Question
 * Review page and the Admin export; it is not a separate review activity.
 */
export type OptionMisconceptionMapping = {
  optionId: string;
  label: string;
  text: LocalizedText;
  isCorrect: boolean;
  misconceptionIds: string[];
  reasonByMisconceptionId: Map<string, LocalizedText>;
};

export function buildOptionMisconceptionMappings(
  question: Pick<Question, "type" | "options">,
  answers: readonly StudentAnswer[],
): OptionMisconceptionMapping[] {
  if (question.type !== "multiple_choice" || !question.options) return [];

  const answerById = new Map(answers.map((answer) => [answer.id, answer]));

  return question.options.map((option) => {
    const answer = answerById.get(option.id);
    const isMpOption = answer?.answerRole === "mp_option";
    const effectiveIds = isMpOption ? answer.studentMisconceptionIds : [];
    const reasonByMisconceptionId = new Map(
      (isMpOption ? (answer.misconceptionReasons ?? []) : []).map((item) => [
        item.misconceptionId,
        item.reason,
      ]),
    );

    return {
      optionId: option.id,
      label: option.label,
      text: option.text,
      isCorrect: option.isCorrect,
      misconceptionIds: normalizeEffectiveIds(effectiveIds),
      reasonByMisconceptionId,
    };
  });
}
