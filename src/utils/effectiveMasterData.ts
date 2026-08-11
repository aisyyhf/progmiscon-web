import type {
  AnswerMisconceptionRow,
  MasterData,
  QuestionMisconceptionRow,
} from "../types/masterData";
import type { PublishedMasterOverrides } from "../types/effectiveOverrides";
import type { QuestionMisconceptionProvenance } from "../types/question";
import { isActiveValue } from "./masterDataValidation.ts";

export function normalizeEffectiveIds(ids: readonly string[]): string[] {
  return [...new Set(ids.map((id) => id.trim()).filter(Boolean))].sort(
    (left, right) =>
      left.localeCompare(right, undefined, {
        numeric: true,
        sensitivity: "base",
      }),
  );
}

export function buildConsensusSnapshot(
  baselineIds: readonly string[],
  removedVotes: Readonly<Record<string, number>>,
  additionalVotes: Readonly<Record<string, number>>,
): string[] {
  const removed = new Set(
    Object.entries(removedVotes)
      .filter(([, votes]) => votes >= 2)
      .map(([id]) => id.trim())
      .filter(Boolean),
  );
  const additions = Object.entries(additionalVotes)
    .filter(([, votes]) => votes >= 2)
    .map(([id]) => id);

  return normalizeEffectiveIds([
    ...normalizeEffectiveIds(baselineIds).filter((id) => !removed.has(id)),
    ...additions,
  ]);
}

export function buildEffectiveQuestionMisconceptionMap(
  data: Pick<
    MasterData,
    "questions" | "answers" | "questionMisconceptions" | "answerMisconceptions"
  >,
): Map<string, QuestionMisconceptionProvenance> {
  const directByQuestion = new Map<string, string[]>();
  const derivedByQuestion = new Map<string, string[]>();
  const questionIdByAnswerId = new Map(
    data.answers
      .filter((row) => isActiveValue(row.active))
      .map((row) => [row.answer_id.trim(), row.question_id.trim()]),
  );

  for (const relation of data.questionMisconceptions) {
    if (!isActiveValue(relation.active)) continue;
    const questionId = relation.question_id.trim();
    const current = directByQuestion.get(questionId) ?? [];
    current.push(relation.misconception_id);
    directByQuestion.set(questionId, current);
  }

  for (const relation of data.answerMisconceptions) {
    if (!isActiveValue(relation.active)) continue;
    const questionId = questionIdByAnswerId.get(relation.answer_id.trim());
    if (!questionId) continue;
    const current = derivedByQuestion.get(questionId) ?? [];
    current.push(relation.misconception_id);
    derivedByQuestion.set(questionId, current);
  }

  const questionIds = new Set([
    ...data.questions.map((row) => row.question_id.trim()).filter(Boolean),
    ...directByQuestion.keys(),
    ...derivedByQuestion.keys(),
  ]);

  return new Map(
    [...questionIds].map((questionId) => {
      const directQuestionMisconceptionIds = normalizeEffectiveIds(
        directByQuestion.get(questionId) ?? [],
      );
      const answerDerivedMisconceptionIds = normalizeEffectiveIds(
        derivedByQuestion.get(questionId) ?? [],
      );
      return [
        questionId,
        {
          directQuestionMisconceptionIds,
          answerDerivedMisconceptionIds,
          questionMisconceptionIds: normalizeEffectiveIds([
            ...directQuestionMisconceptionIds,
            ...answerDerivedMisconceptionIds,
          ]),
        },
      ];
    }),
  );
}

export function buildMisconceptionQuestionBackReferences(
  data: Pick<
    MasterData,
    | "questions"
    | "answers"
    | "questionMisconceptions"
    | "answerMisconceptions"
  >,
): Map<string, string[]> {
  const activeQuestionIds = new Set(
    data.questions
      .filter((row) => isActiveValue(row.active))
      .map((row) => row.question_id.trim()),
  );
  const questionIdByAnswerId = new Map(
    data.answers
      .filter((row) => isActiveValue(row.active))
      .map((row) => [row.answer_id.trim(), row.question_id.trim()]),
  );
  const references = new Map<string, Set<string>>();
  const add = (misconceptionId: string, questionId: string) => {
    if (!misconceptionId || !activeQuestionIds.has(questionId)) return;
    const current = references.get(misconceptionId) ?? new Set<string>();
    current.add(questionId);
    references.set(misconceptionId, current);
  };

  for (const relation of data.questionMisconceptions) {
    if (isActiveValue(relation.active)) {
      add(relation.misconception_id.trim(), relation.question_id.trim());
    }
  }
  for (const relation of data.answerMisconceptions) {
    if (isActiveValue(relation.active)) {
      add(
        relation.misconception_id.trim(),
        questionIdByAnswerId.get(relation.answer_id.trim()) ?? "",
      );
    }
  }

  return new Map(
    [...references].map(([id, questionIds]) => [
      id,
      normalizeEffectiveIds([...questionIds]),
    ]),
  );
}

function replaceQuestionRelations(
  baseline: QuestionMisconceptionRow[],
  overrides: PublishedMasterOverrides["questionMisconceptionOverrides"],
  validMisconceptionIds: ReadonlySet<string>,
): QuestionMisconceptionRow[] {
  const overrideMap = new Map(
    overrides.map((item) => [
      item.question_id.trim(),
      normalizeEffectiveIds(item.misconception_ids).filter((id) =>
        validMisconceptionIds.has(id),
      ),
    ]),
  );
  const existing = new Map(
    baseline.map((row) => [
      `${row.question_id.trim()}\u0000${row.misconception_id.trim()}`,
      row,
    ]),
  );
  const relations = baseline.filter(
    (row) => !overrideMap.has(row.question_id.trim()),
  );

  for (const [questionId, misconceptionIds] of overrideMap) {
    for (const misconceptionId of misconceptionIds) {
      relations.push({
        ...existing.get(`${questionId}\u0000${misconceptionId}`),
        question_id: questionId,
        misconception_id: misconceptionId,
        source: "published_override",
        active: "TRUE",
      });
    }
  }

  return relations.sort((left, right) =>
    `${left.question_id}\u0000${left.misconception_id}`.localeCompare(
      `${right.question_id}\u0000${right.misconception_id}`,
      undefined,
      { numeric: true, sensitivity: "base" },
    ),
  );
}

function replaceAnswerRelations(
  baseline: AnswerMisconceptionRow[],
  overrides: PublishedMasterOverrides["answerMisconceptionOverrides"],
  validMisconceptionIds: ReadonlySet<string>,
): AnswerMisconceptionRow[] {
  const overrideMap = new Map(
    overrides.map((item) => [
      item.answer_id.trim(),
      normalizeEffectiveIds(item.misconception_ids).filter((id) =>
        validMisconceptionIds.has(id),
      ),
    ]),
  );
  const existing = new Map(
    baseline.map((row) => [
      `${row.answer_id.trim()}\u0000${row.misconception_id.trim()}`,
      row,
    ]),
  );
  const relations = baseline.filter(
    (row) => !overrideMap.has(row.answer_id.trim()),
  );

  for (const [answerId, misconceptionIds] of overrideMap) {
    for (const misconceptionId of misconceptionIds) {
      relations.push({
        reason_ind: "",
        reason_en: "",
        ...existing.get(`${answerId}\u0000${misconceptionId}`),
        answer_id: answerId,
        misconception_id: misconceptionId,
        active: "TRUE",
      });
    }
  }

  return relations.sort((left, right) =>
    `${left.answer_id}\u0000${left.misconception_id}`.localeCompare(
      `${right.answer_id}\u0000${right.misconception_id}`,
      undefined,
      { numeric: true, sensitivity: "base" },
    ),
  );
}

export function applyPublishedMasterOverrides(
  baseline: MasterData,
  overrides: PublishedMasterOverrides,
): MasterData {
  const questionContent = new Map(
    overrides.questionContentOverrides.map((item) => [
      item.question_id.trim(),
      item,
    ]),
  );
  const answerContent = new Map(
    overrides.answerContentOverrides.map((item) => [
      item.answer_id.trim(),
      item,
    ]),
  );
  const validMisconceptionIds = new Set(
    baseline.misconceptions
      .map((row) => row.misconception_id.trim())
      .filter(Boolean),
  );

  return {
    ...baseline,
    questions: baseline.questions.map((row) => {
      const override = questionContent.get(row.question_id.trim());
      if (!override) return row;

      return {
        ...row,
        question_ind: override.question_ind ?? row.question_ind,
        question_en: override.question_en ?? row.question_en,
        question_code: override.question_code ?? row.question_code,
        content_blocks_ind: "",
        content_blocks_en: "",
      };
    }),
    answers: baseline.answers.map((row) => {
      const override = answerContent.get(row.answer_id.trim());
      return override ? { ...row, answer_text: override.answer_text } : row;
    }),
    questionMisconceptions: replaceQuestionRelations(
      baseline.questionMisconceptions,
      overrides.questionMisconceptionOverrides,
      validMisconceptionIds,
    ),
    answerMisconceptions: replaceAnswerRelations(
      baseline.answerMisconceptions,
      overrides.answerMisconceptionOverrides,
      validMisconceptionIds,
    ),
  };
}
