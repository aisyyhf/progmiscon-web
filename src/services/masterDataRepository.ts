import type { Assessment, Category, LocalizedText, Misconception, Question, ReviewTask, StudentAnswer } from "../types";
import type {
  AnswerMisconceptionRow,
  AnswerRow,
  MasterData,
  MisconceptionRow,
  QuestionMisconceptionRow,
  QuestionRow,
  QuestionTopicRow,
  SimilarMisconceptionRow,
  TopicRow,
} from "../types/masterData";
import { masterDataConfig } from "../config/masterDataConfig";
import { loadCsv } from "./csvClient";
import { isActiveValue, validateMasterData } from "../utils/masterDataValidation";
import {
  buildQuestionOptions,
  getQuestionDisplayCode,
  normalizeAnswerRole,
  normalizeQuestionType,
  normalizeWeek,
  selectedOptionIdForAnswer,
} from "../utils/questionMetadata";
import {
  applyPublishedMasterOverrides,
  buildEffectiveQuestionMisconceptionMap,
  buildMisconceptionQuestionBackReferences,
} from "../utils/effectiveMasterData";
import { createInvalidatablePromiseCache } from "../utils/invalidatablePromiseCache";
import { getPublishedMasterOverrides } from "./publishedOverrideRepository";
import {
  buildQuestionContentBlocks,
  buildQuestionSampleCases,
  isDummyData,
  parseQuestionOptions,
  parseStringArray,
  suppressDuplicateIoDescriptions,
} from "../utils/masterDataContent";
import { buildRelatedMisconceptionMap } from "../utils/similarMisconceptions";

export const EFFECTIVE_MASTER_DATA_INVALIDATED =
  "progmiscon:effective-master-data-invalidated";

const text = (value: string | undefined): string => (value ?? "").trim();

function numberValue(value: string | undefined, fallback = 0): number {
  const parsed = Number.parseInt(text(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function localized(indonesian: string, english: string): LocalizedText {
  const id = text(indonesian);
  const en = text(english);
  return { id: id || en, en: en || id };
}

function codeExample(value: string): LocalizedText {
  const normalized = text(value);
  return { id: normalized, en: normalized };
}

const unavailable = (): LocalizedText => ({ id: "Belum tersedia", en: "Not yet available" });

async function loadBaselineMasterData(): Promise<MasterData> {
  const [topics, misconceptions, questions, questionTopics, questionMisconceptions, answers, answerMisconceptions, similarMisconceptions] = await Promise.all([
    loadCsv<TopicRow>(masterDataConfig.topicsUrl, "topics"),
    loadCsv<MisconceptionRow>(masterDataConfig.misconceptionsUrl, "misconceptions"),
    loadCsv<QuestionRow>(masterDataConfig.questionsUrl, "questions"),
    loadCsv<QuestionTopicRow>(masterDataConfig.questionTopicsUrl, "question_topics"),
    loadCsv<QuestionMisconceptionRow>(masterDataConfig.questionMisconceptionsUrl, "question_misconceptions"),
    loadCsv<AnswerRow>(masterDataConfig.answersUrl, "answers"),
    loadCsv<AnswerMisconceptionRow>(masterDataConfig.answerMisconceptionsUrl, "answer_misconceptions"),
    loadCsv<SimilarMisconceptionRow>(masterDataConfig.similarMisconceptionsUrl, "similar_misconceptions"),
  ]);

  const data: MasterData = { topics, misconceptions, questions, questionTopics, questionMisconceptions, answers, answerMisconceptions, similarMisconceptions };
  const errors = validateMasterData(data);
  if (errors.length > 0) throw new Error(`Master data Google Sheets tidak valid:\n- ${errors.slice(0, 20).join("\n- ")}`);

  console.info("[Progmiscon] Master data Google Sheets berhasil dimuat", {
    topics: topics.length,
    misconceptions: misconceptions.length,
    questions: questions.length,
    questionTopics: questionTopics.length,
    questionMisconceptions: questionMisconceptions.length,
    answers: answers.length,
    answerMisconceptions: answerMisconceptions.length,
    similarMisconceptions: similarMisconceptions.length,
  });

  return data;
}

const baselineMasterDataCache = createInvalidatablePromiseCache(
  loadBaselineMasterData,
);

export function getBaselineMasterData(): Promise<MasterData> {
  return baselineMasterDataCache.get();
}

const effectiveMasterDataCache = createInvalidatablePromiseCache(() =>
  Promise.all([
    getBaselineMasterData(),
    getPublishedMasterOverrides(),
  ]).then(([baseline, overrides]) =>
    applyPublishedMasterOverrides(baseline, overrides),
  ),
);

export function getMasterData(): Promise<MasterData> {
  return effectiveMasterDataCache.get();
}

export function invalidateEffectiveMasterData(): void {
  effectiveMasterDataCache.invalidate();
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(EFFECTIVE_MASTER_DATA_INVALIDATED));
  }
}

export function reloadBaselineMasterData(): Promise<MasterData> {
  baselineMasterDataCache.invalidate();
  invalidateEffectiveMasterData();
  return baselineMasterDataCache.get();
}

export async function getSheetCategories(): Promise<Category[]> {
  const data = await getMasterData();
  return data.topics
    .filter((row) => isActiveValue(row.active))
    .map((row) => ({
      id: text(row.topic_id),
      name: localized(row.name_ind, row.name_en),
      description: localized(row.description_ind, row.description_en),
      order: numberValue(row.order_no),
    }))
    .sort((a, b) => a.order - b.order);
}

export async function getSheetQuestions(): Promise<Question[]> {
  const data = await getMasterData();
  const categories = await getSheetCategories();
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const questionTopicMap = new Map<string, typeof data.questionTopics>();
  const questionMisconceptionMap =
    buildEffectiveQuestionMisconceptionMap(data);
  const answersByQuestion = new Map<string, AnswerRow[]>();
  const evidenceCountByQuestion = new Map<string, number>();
  const answerMisconceptionMap = new Map<string, string[]>();

  for (const relation of data.questionTopics) {
    const questionId = text(relation.question_id);
    const current = questionTopicMap.get(questionId) ?? [];
    current.push(relation);
    questionTopicMap.set(questionId, current);
  }

  for (const answer of data.answers) {
    if (!isActiveValue(answer.active)) continue;
    const questionId = text(answer.question_id);
    const role = normalizeAnswerRole(answer.answer_role);
    if (role === "evidence") {
      evidenceCountByQuestion.set(
        questionId,
        (evidenceCountByQuestion.get(questionId) ?? 0) + 1,
      );
    }
    if (role !== "mp_option") continue;
    const current = answersByQuestion.get(questionId) ?? [];
    current.push(answer);
    answersByQuestion.set(questionId, current);
  }

  for (const relation of data.answerMisconceptions) {
    if (!isActiveValue(relation.active)) continue;
    const answerId = text(relation.answer_id);
    const current = answerMisconceptionMap.get(answerId) ?? [];
    current.push(text(relation.misconception_id));
    answerMisconceptionMap.set(answerId, current);
  }

  return data.questions
    .filter((row) => isActiveValue(row.active))
    .sort((a, b) => {
      const orderDifference =
        numberValue(a.order_no, Number.MAX_SAFE_INTEGER) - numberValue(b.order_no, Number.MAX_SAFE_INTEGER);
      if (orderDifference !== 0) return orderDifference;

      const questionIdA = text(a.question_id);
      const questionIdB = text(b.question_id);
      return questionIdA < questionIdB ? -1 : questionIdA > questionIdB ? 1 : 0;
    })
    .map((row): Question | undefined => {
      const questionId = text(row.question_id);
      const topicRelations = questionTopicMap.get(questionId) ?? [];
      const primaryRelation = topicRelations.find((relation) => text(relation.role).toLowerCase() === "primary") ?? topicRelations[0];
      const categoryId = text(primaryRelation?.topic_id);
      if (!categoryId || !categoryMap.has(categoryId)) {
        console.warn(`[Progmiscon] Soal ${questionId} dilewati karena tidak memiliki topic yang valid.`);
        return undefined;
      }

      const expectedConcepts = topicRelations
        .map((relation) => categoryMap.get(text(relation.topic_id))?.name)
        .filter((value): value is LocalizedText => Boolean(value));
      const type = normalizeQuestionType(row.question_type);
      if (!type) throw new Error(`Question type tidak valid untuk ${questionId}`);
      const misconceptionProvenance = questionMisconceptionMap.get(
        questionId,
      ) ?? {
        directQuestionMisconceptionIds: [],
        answerDerivedMisconceptionIds: [],
        questionMisconceptionIds: [],
      };
      const titleFallback = text(row.source_no) || questionId;
      const title =
        text(row.title_ind) || text(row.title_en)
          ? localized(row.title_ind, row.title_en)
          : codeExample(titleFallback);
      const sampleCases = buildQuestionSampleCases(
        row.test_cases_json,
        row.sample_inputs,
        row.sample_outputs,
      );
      const inputDescription = localized(
        row.input_description_ind ?? "",
        row.input_description_en ?? "",
      );
      const outputDescription = localized(
        row.output_description_ind ?? "",
        row.output_description_en ?? "",
      );
      const parsedOptions = parseQuestionOptions(
        row.options_json,
        row.correct_option_label,
      );
      const evidenceCount = evidenceCountByQuestion.get(questionId) ?? 0;
      const contentBlocks = (language: "id" | "en") =>
        suppressDuplicateIoDescriptions(
          buildQuestionContentBlocks(
            language === "id" ? row.content_blocks_ind : row.content_blocks_en,
            language === "id" ? row.question_ind : row.question_en,
            "",
            sampleCases,
          ),
          language === "id" ? inputDescription.id : inputDescription.en,
          language === "id" ? outputDescription.id : outputDescription.en,
        );

      return {
        id: questionId,
        assessmentId: "asm-master",
        categoryId,
        number: text(row.source_no) || questionId,
        title,
        shortDescription: localized(
          row.short_description_ind ?? "",
          row.short_description_en ?? "",
        ),
        week: normalizeWeek(row.week),
        sourceSystem: text(row.source_system) || null,
        sourceKey: text(row.source_key) || null,
        sourceCode: text(row.source_code) || null,
        displayCode: getQuestionDisplayCode(row),
        lmsQuestionId: text(row.lms_question_id) || null,
        probeNo: text(row.probe_no) || null,
        targetMisconceptionId: text(row.target_misconception_id) || null,
        level: text(row.level) || null,
        type,
        questionInd: text(row.question_ind),
        questionEn: text(row.question_en),
        questionCode: text(row.question_code),
        prompt: localized(row.question_ind, row.question_en),
        contentBlocks: {
          id: contentBlocks("id"),
          en: contentBlocks("en"),
        },
        inputDescription:
          inputDescription.id || inputDescription.en ? inputDescription : undefined,
        outputDescription:
          outputDescription.id || outputDescription.en ? outputDescription : undefined,
        ioContentType: text(row.io_content_type) || null,
        sampleCases,
        correctOptionLabel: text(row.correct_option_label) || null,
        evidenceAvailable: evidenceCount > 0,
        evidenceCount,
        expectedConcepts: expectedConcepts.length > 0 ? expectedConcepts : [categoryMap.get(categoryId)!.name],
        ...misconceptionProvenance,
        options:
          type === "multiple_choice"
            ? parsedOptions.options.length > 0
              ? parsedOptions.options
              : buildQuestionOptions(answersByQuestion.get(questionId) ?? [], answerMisconceptionMap)
            : undefined,
      };
    })
    .filter((question): question is Question => Boolean(question));
}

export async function getSheetMisconceptions(): Promise<Misconception[]> {
  const data = await getMasterData();
  const relatedQuestionMap =
    buildMisconceptionQuestionBackReferences(data);
  const relatedMisconceptionMap = buildRelatedMisconceptionMap(
    data.similarMisconceptions,
  );

  return data.misconceptions
    .filter((row) => isActiveValue(row.active))
    .sort((a, b) => numberValue(a.order_no, Number.MAX_SAFE_INTEGER) - numberValue(b.order_no, Number.MAX_SAFE_INTEGER))
    .map((row) => {
      const misconceptionId = text(row.misconception_id);
      const usable = (value: string | undefined) => isDummyData(value) ? "" : text(value);
      const description = localized(usable(row.description_ind), usable(row.description_en));
      const correction = localized(usable(row.correction_ind), usable(row.correction_en));
      const commonCause = localized(usable(row.common_cause_ind), usable(row.common_cause_en));
      const rationale = localized(usable(row.rationale_ind), "");
      const wrongExample = usable(row.wrong_example);
      const correctExample = usable(row.correct_example);
      const visibleDescription = description.id || description.en ? description : unavailable();

      return {
        id: misconceptionId,
        categoryId: text(row.topic_id),
        title: localized(row.title_ind, row.title_en),
        description: visibleDescription,
        wrong: wrongExample ? codeExample(wrongExample) : visibleDescription,
        correct: correctExample ? codeExample(correctExample) : (correction.id || correction.en ? correction : unavailable()),
        hasWrongExample: Boolean(wrongExample),
        hasCorrectExample: Boolean(correctExample),
        fix: correction.id || correction.en ? correction : unavailable(),
        cause: commonCause.id || commonCause.en ? commonCause : unavailable(),
        rationale: rationale.id || rationale.en ? rationale : undefined,
        rationaleSource: text(row.rationale_source) || null,
        pattern: [],
        value: visibleDescription,
        relatedMisconceptionIds: [...(relatedMisconceptionMap.get(misconceptionId) ?? [])],
        relatedQuestionIds: relatedQuestionMap.get(misconceptionId) ?? [],
      };
    });
}

export async function getSheetAssessments(): Promise<Assessment[]> {
  return [{
    id: "asm-master",
    title: { id: "Kumpulan Soal Progmiscon", en: "Progmiscon Question Collection" },
    kind: "practice",
    course: { id: "Algoritma dan Pemrograman", en: "Algorithms and Programming" },
    semester: 1,
  }];
}

function uniqueLocalizedTexts(values: LocalizedText[]): LocalizedText[] {
  const seen = new Set<string>();

  return values.filter((value) => {
    const key = `${value.id}\u0000${value.en}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function getSheetAnswers(): Promise<StudentAnswer[]> {
  const data = await getMasterData();

  const questionTypeMap = new Map(
    data.questions
      .filter((row) => isActiveValue(row.active))
      .map((row) => {
        const type = normalizeQuestionType(row.question_type);
        if (!type) throw new Error(`Question type tidak valid untuk ${text(row.question_id)}`);
        return [text(row.question_id), type] as const;
      }),
  );

  const relationsByAnswer = new Map<
    string,
    { misconceptionIds: string[]; reasons: LocalizedText[]; mappedReasons: Array<{ misconceptionId: string; reason: LocalizedText }> }
  >();
  const answerRoleById = new Map(
    data.answers.map((row) => [
      text(row.answer_id),
      normalizeAnswerRole(row.answer_role),
    ]),
  );

  for (const relation of data.answerMisconceptions) {
    if (
      !isActiveValue(relation.active) ||
      answerRoleById.get(text(relation.answer_id)) !== "mp_option"
    ) continue;

    const answerId = text(relation.answer_id);
    const current = relationsByAnswer.get(answerId) ?? {
      misconceptionIds: [],
      reasons: [],
      mappedReasons: [],
    };

    current.misconceptionIds.push(text(relation.misconception_id));

    const reason = localized(relation.reason_ind, relation.reason_en);
    if (reason.id || reason.en) {
      current.reasons.push(reason);
      current.mappedReasons.push({ misconceptionId: text(relation.misconception_id), reason });
    }

    relationsByAnswer.set(answerId, current);
  }

  return data.answers
    .filter(
      (row) =>
        isActiveValue(row.active) &&
        normalizeAnswerRole(row.answer_role) !== null &&
        questionTypeMap.has(text(row.question_id)),
    )
    .sort((a, b) => {
      const questionOrder =
        text(a.question_id).localeCompare(text(b.question_id), undefined, {
          numeric: true,
        });

      if (questionOrder !== 0) return questionOrder;

      return (
        numberValue(a.order_no, Number.MAX_SAFE_INTEGER) -
        numberValue(b.order_no, Number.MAX_SAFE_INTEGER)
      );
    })
    .map((row) => {
      const answerId = text(row.answer_id);
      const questionId = text(row.question_id);
      const answerRole = normalizeAnswerRole(row.answer_role)!;
      const relation = relationsByAnswer.get(answerId);
      const status = text(row.status).toLowerCase() as StudentAnswer["status"];

      const fallbackExplanation = answerRole === "evidence"
        ? localized(
            row.evidence_explanation_ind ?? row.explanation_ind,
            row.evidence_explanation_en ?? row.explanation_en,
          )
        : localized(row.explanation_ind, row.explanation_en);
      const evidenceMisconceptionId =
        answerRole === "evidence"
          ? text(row.evidence_misconception_id)
          : "";

      const incorrectElements =
        status === "incorrect"
          ? uniqueLocalizedTexts(
              relation?.reasons.length
                ? relation.reasons
                : fallbackExplanation.id || fallbackExplanation.en
                  ? [fallbackExplanation]
                  : [],
            )
          : [];

      return {
        id: answerId,
        questionId,
        answerRole,
        optionLabel: text(row.option_label) || null,
        studentId: `anonymous-${answerId}`,
        studentName: text(row.student_name) || null,
        studentUserId: text(row.student_user_id) || null,
        explanation:
          fallbackExplanation.id || fallbackExplanation.en
            ? fallbackExplanation
            : relation?.reasons.length
              ? combineLocalizedTexts(relation.reasons)
              : undefined,
        sourceSystem: text(row.source_system) || null,
        sourceKey: text(row.source_key) || null,
        order: text(row.order_no) ? numberValue(row.order_no) : null,
        status,
        answerText:
          answerRole === "evidence"
            ? text(row.student_answer) || text(row.answer_text)
            : text(row.answer_text),
        selectedOptionId:
          answerRole === "mp_option"
            ? selectedOptionIdForAnswer(
                questionTypeMap.get(questionId)!,
                answerId,
              )
            : undefined,
        checks: [],
        masteredConcepts: [],
        incorrectElements,
        studentMisconceptionIds:
          answerRole === "evidence" && evidenceMisconceptionId
            ? [evidenceMisconceptionId]
            : [...new Set(relation?.misconceptionIds ?? [])],
        misconceptionReasons:
          answerRole === "mp_option" ? relation?.mappedReasons ?? [] : [],
        isEvidence: answerRole === "evidence",
        evidenceSource: text(row.evidence_source) || null,
        evidenceMisconceptionIds: evidenceMisconceptionId
          ? [evidenceMisconceptionId]
          : [],
        evidenceReasons:
          evidenceMisconceptionId &&
          (fallbackExplanation.id || fallbackExplanation.en)
            ? [{
                misconceptionId: evidenceMisconceptionId,
                reason: fallbackExplanation,
              }]
            : [],
        studentAnswer:
          answerRole === "evidence"
            ? text(row.student_answer) || text(row.answer_text) || null
            : null,
        evidenceId: text(row.evidence_id) || null,
        evidenceMisconceptionId: evidenceMisconceptionId || null,
        evidenceExplanation:
          answerRole === "evidence" &&
          (fallbackExplanation.id || fallbackExplanation.en)
            ? fallbackExplanation
            : undefined,
        evidenceTag: text(row.evidence_tag) || null,
        evidenceSourceQuestionIds: parseStringArray(
          row.evidence_source_question_ids,
        ).values,
        sourceSheet: text(row.source_sheet) || null,
        sourceRow: text(row.source_row) || null,
      };
    });
}

function combineLocalizedTexts(values: LocalizedText[]): LocalizedText {
  const unique = uniqueLocalizedTexts(values);

  return {
    id: unique.map((value) => value.id).filter(Boolean).join("\n"),
    en: unique.map((value) => value.en).filter(Boolean).join("\n"),
  };
}

export async function getSheetReviewTasks(): Promise<ReviewTask[]> {
  const data = await getMasterData();

  const activeQuestionIds = new Set(
    data.questions
      .filter((row) => isActiveValue(row.active))
      .map((row) => text(row.question_id)),
  );

  const answerMap = new Map(
    data.answers
      .filter(
        (row) =>
          isActiveValue(row.active) &&
          normalizeAnswerRole(row.answer_role) === "mp_option",
      )
      .map((row) => [text(row.answer_id), row]),
  );

  const relationsByAnswer = new Map<
    string,
    { misconceptionIds: string[]; reasons: LocalizedText[] }
  >();

  for (const relation of data.answerMisconceptions) {
    if (!isActiveValue(relation.active)) continue;

    const answerId = text(relation.answer_id);
    const answer = answerMap.get(answerId);

    if (
      !answer ||
      text(answer.status).toLowerCase() !== "incorrect" ||
      !activeQuestionIds.has(text(answer.question_id))
    ) {
      continue;
    }

    const current = relationsByAnswer.get(answerId) ?? {
      misconceptionIds: [],
      reasons: [],
    };

    current.misconceptionIds.push(text(relation.misconception_id));
    current.reasons.push(localized(relation.reason_ind, relation.reason_en));
    relationsByAnswer.set(answerId, current);
  }

  return [...relationsByAnswer.entries()]
    .map(([answerId, relation]) => {
      const answer = answerMap.get(answerId)!;
      const misconceptionIds = [...new Set(relation.misconceptionIds)];
      const fallbackExplanation = localized(
        answer.explanation_ind,
        answer.explanation_en,
      );
      const explanation = combineLocalizedTexts(
        relation.reasons.length ? relation.reasons : [fallbackExplanation],
      );

      return {
        id: `review-answer-${answerId}`,
        questionId: text(answer.question_id),
        answerCaseId: answerId,
        suggestedMisconceptionId: misconceptionIds[0],
        explanation,
        reviewerDecisions: [],
      };
    })
    .sort((a, b) => {
      const questionOrder = a.questionId.localeCompare(b.questionId, undefined, {
        numeric: true,
      });

      if (questionOrder !== 0) return questionOrder;

      return a.answerCaseId.localeCompare(b.answerCaseId, undefined, {
        numeric: true,
      });
    });
}
