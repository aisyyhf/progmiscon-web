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

let masterDataPromise: Promise<MasterData> | undefined;

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

async function loadMasterData(): Promise<MasterData> {
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

export function getMasterData(): Promise<MasterData> {
  masterDataPromise ??= loadMasterData();
  return masterDataPromise;
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

function promptWithCode(questionText: string, questionCode: string): string {
  const prompt = text(questionText);
  const code = text(questionCode);
  if (!code) return prompt;
  if (!prompt) return code;
  return `${prompt}\n\n${code}`;
}

export async function getSheetQuestions(): Promise<Question[]> {
  const data = await getMasterData();
  const categories = await getSheetCategories();
  const categoryMap = new Map(categories.map((category) => [category.id, category]));
  const questionTopicMap = new Map<string, typeof data.questionTopics>();
  const questionMisconceptionMap = new Map<string, string[]>();

  for (const relation of data.questionTopics) {
    const questionId = text(relation.question_id);
    const current = questionTopicMap.get(questionId) ?? [];
    current.push(relation);
    questionTopicMap.set(questionId, current);
  }

  for (const relation of data.questionMisconceptions) {
    if (!isActiveValue(relation.active)) continue;
    const questionId = text(relation.question_id);
    const current = questionMisconceptionMap.get(questionId) ?? [];
    current.push(text(relation.misconception_id));
    questionMisconceptionMap.set(questionId, current);
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

      return {
        id: questionId,
        assessmentId: "asm-master",
        categoryId,
        number: text(row.source_no) || questionId,
        type: "short_answer",
        prompt: localized(
          promptWithCode(row.question_ind, row.question_code),
          promptWithCode(row.question_en, row.question_code),
        ),
        expectedConcepts: expectedConcepts.length > 0 ? expectedConcepts : [categoryMap.get(categoryId)!.name],
        questionMisconceptionIds: [...new Set(questionMisconceptionMap.get(questionId) ?? [])],
      };
    })
    .filter((question): question is Question => Boolean(question));
}

export async function getSheetMisconceptions(): Promise<Misconception[]> {
  const data = await getMasterData();
  const activeQuestionIds = new Set(data.questions.filter((row) => isActiveValue(row.active)).map((row) => text(row.question_id)));
  const relatedQuestionMap = new Map<string, Set<string>>();
  const relatedMisconceptionMap = new Map<string, Set<string>>();

  for (const relation of data.questionMisconceptions) {
    if (!isActiveValue(relation.active)) continue;
    const questionId = text(relation.question_id);
    const misconceptionId = text(relation.misconception_id);
    if (!activeQuestionIds.has(questionId)) continue;
    const current = relatedQuestionMap.get(misconceptionId) ?? new Set<string>();
    current.add(questionId);
    relatedQuestionMap.set(misconceptionId, current);
  }

  for (const relation of data.similarMisconceptions) {
    if (text(relation.status).toLowerCase() !== "approved") continue;
    const left = text(relation.misconception_id);
    const right = text(relation.similar_id);
    const leftSet = relatedMisconceptionMap.get(left) ?? new Set<string>();
    leftSet.add(right);
    relatedMisconceptionMap.set(left, leftSet);
    const rightSet = relatedMisconceptionMap.get(right) ?? new Set<string>();
    rightSet.add(left);
    relatedMisconceptionMap.set(right, rightSet);
  }

  return data.misconceptions
    .filter((row) => isActiveValue(row.active))
    .sort((a, b) => numberValue(a.order_no, Number.MAX_SAFE_INTEGER) - numberValue(b.order_no, Number.MAX_SAFE_INTEGER))
    .map((row) => {
      const misconceptionId = text(row.misconception_id);
      const description = localized(row.description_ind, row.description_en);
      const correction = localized(row.correction_ind, row.correction_en);
      const commonCause = localized(row.common_cause_ind, row.common_cause_en);

      return {
        id: misconceptionId,
        categoryId: text(row.topic_id),
        title: localized(row.title_ind, row.title_en),
        wrong: text(row.wrong_example) ? codeExample(row.wrong_example) : description,
        correct: text(row.correct_example) ? codeExample(row.correct_example) : (text(row.correction_ind) || text(row.correction_en) ? correction : unavailable()),
        fix: text(row.correction_ind) || text(row.correction_en) ? correction : unavailable(),
        cause: text(row.common_cause_ind) || text(row.common_cause_en) ? commonCause : unavailable(),
        pattern: [],
        value: description,
        relatedMisconceptionIds: [...(relatedMisconceptionMap.get(misconceptionId) ?? [])],
        relatedQuestionIds: [...(relatedQuestionMap.get(misconceptionId) ?? [])],
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

  const activeQuestionIds = new Set(
    data.questions
      .filter((row) => isActiveValue(row.active))
      .map((row) => text(row.question_id)),
  );

  const relationsByAnswer = new Map<
    string,
    { misconceptionIds: string[]; reasons: LocalizedText[] }
  >();

  for (const relation of data.answerMisconceptions) {
    if (!isActiveValue(relation.active)) continue;

    const answerId = text(relation.answer_id);
    const current = relationsByAnswer.get(answerId) ?? {
      misconceptionIds: [],
      reasons: [],
    };

    current.misconceptionIds.push(text(relation.misconception_id));

    const reason = localized(relation.reason_ind, relation.reason_en);
    if (reason.id || reason.en) current.reasons.push(reason);

    relationsByAnswer.set(answerId, current);
  }

  return data.answers
    .filter(
      (row) =>
        isActiveValue(row.active) &&
        activeQuestionIds.has(text(row.question_id)),
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
      const relation = relationsByAnswer.get(answerId);
      const status = text(row.status).toLowerCase() as StudentAnswer["status"];

      const fallbackExplanation = localized(
        row.explanation_ind,
        row.explanation_en,
      );

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
        questionId: text(row.question_id),
        studentId: `anonymous-${answerId}`,
        status,
        answerText: text(row.answer_text),
        checks: [],
        masteredConcepts: [],
        incorrectElements,
        studentMisconceptionIds: [
          ...new Set(relation?.misconceptionIds ?? []),
        ],
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
      .filter((row) => isActiveValue(row.active))
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
