export type CanonicalQuestionType = "PS" | "MP";
export type CanonicalAnswerRole = "mp_option" | "ps_reference" | "evidence";
export type SyncMode = "preview" | "sync";

export type MasterCsvRow = Record<string, string | undefined>;

export type TrustedMasterRows = {
  questions: MasterCsvRow[];
  answers: MasterCsvRow[];
  questionMisconceptions: MasterCsvRow[];
  answerMisconceptions: MasterCsvRow[];
  misconceptions: MasterCsvRow[];
};

export type QuestionBaselinePayload = {
  question_id: string;
  source_fingerprint: string;
  misconception_ids: string[];
};

export type AnswerBaselinePayload = {
  answer_id: string;
  question_id: string;
  source_fingerprint: string;
  misconception_ids: string[];
};

export type CanonicalContentBlock = {
  type: "text" | "code";
  content: string;
};

export type CanonicalSampleCase = {
  input: string;
  output: string;
};

export type TrustedQuestionContext = {
  questionId: string;
  questionType: CanonicalQuestionType;
  questionInd: string;
  questionEn: string;
  contentBlocksInd: CanonicalContentBlock[];
  contentBlocksEn: CanonicalContentBlock[];
  pseudocode: string;
  inputDescriptionInd: string;
  inputDescriptionEn: string;
  outputDescriptionInd: string;
  outputDescriptionEn: string;
  sampleCases: CanonicalSampleCase[];
  hasStructuredContent: boolean;
  contentFingerprint: string;
};

export type TrustedMasterSnapshot = {
  questionBaselines: QuestionBaselinePayload[];
  answerBaselines: AnswerBaselinePayload[];
  misconceptionIds: string[];
  questionContexts: TrustedQuestionContext[];
  relationSnapshotFingerprint: string;
  contentSnapshotFingerprint: string;
};

export type TrustedMasterIssue = {
  code: string;
  detail: string;
};

export type TrustedMasterBuildResult =
  | { ok: true; snapshot: TrustedMasterSnapshot }
  | { ok: false; issues: TrustedMasterIssue[] };

export type TrustedMasterPreview = {
  questionCount: number;
  answerBaselineCount: number;
  misconceptionCount: number;
  psQuestionCount: number;
  mpQuestionCount: number;
  structuredQuestionCount: number;
  relationSnapshotFingerprint: string;
  contentSnapshotFingerprint: string;
  validationErrors: [];
};

const QUESTION_TYPES = new Map<string, CanonicalQuestionType>([
  ["ps", "PS"],
  ["essay", "PS"],
  ["short answer", "PS"],
  ["short_answer", "PS"],
  ["mp", "MP"],
  ["multiple choice", "MP"],
  ["multiple_choice", "MP"],
]);

const ANSWER_ROLES = new Set<CanonicalAnswerRole>([
  "mp_option",
  "ps_reference",
  "evidence",
]);

const TRUE_VALUES = new Set(["true", "1", "yes", "y"]);
const FALSE_VALUES = new Set(["", "false", "0", "no", "n"]);
const DUMMY_DATA_PATTERN = /\bDATA\s+DUMMY\b/i;
export const MAX_RETAINED_VALIDATION_ISSUES = 100;
const MAX_VALIDATION_ISSUE_DETAIL_CHARACTERS = 512;

function normalizeText(value: string | undefined): string {
  return (value ?? "").replace(/\r\n?/g, "\n").trim();
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function uniqueSorted(values: Iterable<string>): string[] {
  return [...new Set([...values].map(normalizeText).filter(Boolean))].sort(
    compareText,
  );
}

function parseActive(value: string | undefined): boolean | null {
  const normalized = normalizeText(value).toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

export function canonicalQuestionType(
  value: string | null | undefined,
): CanonicalQuestionType | null {
  const normalized = (value ?? "").trim().toLowerCase();
  return normalized ? (QUESTION_TYPES.get(normalized) ?? null) : null;
}

export function canonicalAnswerRole(
  value: string | null | undefined,
): CanonicalAnswerRole | null {
  const normalized = (value ?? "").trim().toLowerCase() as CanonicalAnswerRole;
  return ANSWER_ROLES.has(normalized) ? normalized : null;
}

export function parseCanonicalContentBlocks(raw: string | undefined): {
  blocks: CanonicalContentBlock[];
  error?: string;
} {
  const value = normalizeText(raw);
  if (!value) return { blocks: [] };

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { blocks: [], error: "must be a JSON array" };
    }

    const blocks: CanonicalContentBlock[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        return { blocks: [], error: "each block must be an object" };
      }
      const candidate = item as Record<string, unknown>;
      if (
        (candidate.type !== "text" && candidate.type !== "code") ||
        typeof candidate.content !== "string"
      ) {
        return { blocks: [], error: "block type/content is invalid" };
      }
      const content = normalizeText(candidate.content);
      if (content) blocks.push({ type: candidate.type, content });
    }
    return { blocks };
  } catch {
    return { blocks: [], error: "contains invalid JSON" };
  }
}

function parseCanonicalScalarArray(raw: string | undefined): {
  values: string[];
  error?: string;
} {
  const value = normalizeText(raw);
  if (!value) return { values: [] };

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => item !== null && typeof item === "object")
    ) {
      return { values: [], error: "must be a JSON array of scalar values" };
    }
    return {
      values: parsed.map((item) =>
        normalizeText(item === null ? "" : String(item))
      ),
    };
  } catch {
    return { values: [], error: "contains invalid JSON" };
  }
}

function parseCanonicalTestCases(raw: string | undefined): {
  cases: CanonicalSampleCase[];
  error?: string;
} {
  const value = normalizeText(raw);
  if (!value) return { cases: [] };

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) {
      return { cases: [], error: "must be a JSON array" };
    }

    const cases: CanonicalSampleCase[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        return { cases: [], error: "each test case must be an object" };
      }
      const candidate = item as Record<string, unknown>;
      if (
        typeof candidate.input !== "string" ||
        typeof candidate.output !== "string"
      ) {
        return {
          cases: [],
          error: "test-case input/output must be strings",
        };
      }
      const input = normalizeText(candidate.input);
      const output = normalizeText(candidate.output);
      if (!input && !output) {
        return {
          cases: [],
          error: "test-case input/output must not both be blank",
        };
      }
      cases.push({
        input,
        output,
      });
    }
    return { cases };
  } catch {
    return { cases: [], error: "contains invalid JSON" };
  }
}

function fallbackSampleCases(
  inputs: string[],
  outputs: string[],
): CanonicalSampleCase[] {
  if (inputs.length !== outputs.length) return [];
  return inputs.flatMap((input, index) => {
    const output = outputs[index] ?? "";
    return input && output && !DUMMY_DATA_PATTERN.test(input) &&
        !DUMMY_DATA_PATTERN.test(output)
      ? [{ input, output }]
      : [];
  });
}

export function hasReviewStructuredContent(input: {
  contentBlocksInd: CanonicalContentBlock[];
  contentBlocksEn: CanonicalContentBlock[];
  pseudocode: string;
  inputDescriptionInd: string;
  inputDescriptionEn: string;
  outputDescriptionInd: string;
  outputDescriptionEn: string;
  sampleCases: CanonicalSampleCase[];
}): boolean {
  return input.contentBlocksInd.length > 0 ||
    input.contentBlocksEn.length > 0 ||
    Boolean(normalizeText(input.pseudocode)) ||
    Boolean(normalizeText(input.inputDescriptionInd)) ||
    Boolean(normalizeText(input.inputDescriptionEn)) ||
    Boolean(normalizeText(input.outputDescriptionInd)) ||
    Boolean(normalizeText(input.outputDescriptionEn)) ||
    input.sampleCases.length > 0;
}

export function stableSerialize(value: unknown): string {
  if (
    value === null || typeof value === "string" || typeof value === "boolean"
  ) {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Non-finite numbers are not canonical");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareText)
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  throw new TypeError("Unsupported canonical value");
}

export async function deterministicFingerprint(
  value: unknown,
): Promise<string> {
  const bytes = new TextEncoder().encode(stableSerialize(value));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return `sha256:${
    [...new Uint8Array(digest)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("")
  }`;
}

export function contentFingerprint(input: {
  questionType: CanonicalQuestionType;
  questionInd: string;
  questionEn: string;
  contentBlocksInd: CanonicalContentBlock[];
  contentBlocksEn: CanonicalContentBlock[];
  pseudocode: string;
  inputDescriptionInd: string;
  inputDescriptionEn: string;
  outputDescriptionInd: string;
  outputDescriptionEn: string;
  sampleCases: CanonicalSampleCase[];
}): Promise<string> {
  return deterministicFingerprint({
    scheme: "review-question-content-v2",
    question_type: input.questionType,
    question_ind: normalizeText(input.questionInd),
    question_en: normalizeText(input.questionEn),
    content_blocks_ind: input.contentBlocksInd,
    content_blocks_en: input.contentBlocksEn,
    pseudocode: normalizeText(input.pseudocode),
    input_description_ind: normalizeText(input.inputDescriptionInd),
    input_description_en: normalizeText(input.inputDescriptionEn),
    output_description_ind: normalizeText(input.outputDescriptionInd),
    output_description_en: normalizeText(input.outputDescriptionEn),
    sample_cases: input.sampleCases,
  });
}

export function relationshipFingerprint(
  targetType: "question" | "answer",
  relations: readonly Record<string, string>[],
): Promise<string> {
  const canonicalRelations = [...relations].sort((left, right) =>
    compareText(stableSerialize(left), stableSerialize(right))
  );
  return deterministicFingerprint({
    scheme: "review-relationship-v1",
    target_type: targetType,
    relations: canonicalRelations,
  });
}

export function parseSyncIntent(body: unknown):
  | { ok: true; mode: SyncMode }
  | { ok: false; error: string } {
  if (body === undefined || body === null) return { ok: true, mode: "preview" };
  if (typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Request body must be a JSON object" };
  }

  const record = body as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => key !== "mode") || keys.length > 1) {
    return { ok: false, error: "Only the mode field is accepted" };
  }
  const mode = record.mode ?? "preview";
  if (mode !== "preview" && mode !== "sync") {
    return { ok: false, error: 'mode must be "preview" or "sync"' };
  }
  return { ok: true, mode };
}

function addIssue(
  issues: TrustedMasterIssue[],
  code: string,
  detail: string,
): void {
  if (issues.length < MAX_RETAINED_VALIDATION_ISSUES) {
    issues.push({
      code,
      detail: detail.length <= MAX_VALIDATION_ISSUE_DETAIL_CHARACTERS
        ? detail
        : `${detail.slice(0, MAX_VALIDATION_ISSUE_DETAIL_CHARACTERS - 3)}...`,
    });
  }
}

function validateRows(
  rows: MasterCsvRow[],
  source: string,
  idField: string,
  issues: TrustedMasterIssue[],
): Map<string, MasterCsvRow> {
  const byId = new Map<string, MasterCsvRow>();
  for (const [index, row] of rows.entries()) {
    const id = normalizeText(row[idField]);
    if (!id) {
      addIssue(
        issues,
        "BLANK_ID",
        `${source} row ${index + 2}: ${idField} is blank`,
      );
      continue;
    }
    if (byId.has(id)) {
      addIssue(issues, "DUPLICATE_ID", `${source}: duplicate ${idField} ${id}`);
      continue;
    }
    byId.set(id, row);

    if (parseActive(row.active) === null) {
      addIssue(issues, "INVALID_ACTIVE", `${source} ${id}: active is invalid`);
    }
  }
  return byId;
}

function validateRelationRows(
  rows: MasterCsvRow[],
  source: string,
  leftField: string,
  rightField: string,
  issues: TrustedMasterIssue[],
): Map<string, MasterCsvRow[]> {
  const seen = new Set<string>();
  const activeByLeft = new Map<string, MasterCsvRow[]>();
  for (const [index, row] of rows.entries()) {
    const left = normalizeText(row[leftField]);
    const right = normalizeText(row[rightField]);
    if (!left || !right) {
      addIssue(
        issues,
        "BLANK_RELATION_ID",
        `${source} row ${index + 2}: relationship IDs must not be blank`,
      );
    } else {
      const key = `${left}\u0000${right}`;
      if (seen.has(key)) {
        addIssue(
          issues,
          "DUPLICATE_RELATION",
          `${source}: duplicate ${left}/${right}`,
        );
      }
      seen.add(key);
    }
    const active = parseActive(row.active);
    if (active === null) {
      addIssue(
        issues,
        "INVALID_ACTIVE",
        `${source} ${left}/${right}: active is invalid`,
      );
    } else if (active && left && right) {
      const grouped = activeByLeft.get(left) ?? [];
      grouped.push(row);
      activeByLeft.set(left, grouped);
    }
  }
  return activeByLeft;
}

export async function buildTrustedMasterSnapshot(
  rows: TrustedMasterRows,
): Promise<TrustedMasterBuildResult> {
  const issues: TrustedMasterIssue[] = [];
  const questionById = validateRows(
    rows.questions,
    "questions",
    "question_id",
    issues,
  );
  const answerById = validateRows(rows.answers, "answers", "answer_id", issues);
  const misconceptionById = validateRows(
    rows.misconceptions,
    "misconceptions",
    "misconception_id",
    issues,
  );
  const questionRelationsByQuestion = validateRelationRows(
    rows.questionMisconceptions,
    "question_misconceptions",
    "question_id",
    "misconception_id",
    issues,
  );
  const answerRelationsByAnswer = validateRelationRows(
    rows.answerMisconceptions,
    "answer_misconceptions",
    "answer_id",
    "misconception_id",
    issues,
  );

  const questionState = new Map<string, {
    active: boolean;
    type: CanonicalQuestionType | null;
    questionInd: string;
    questionEn: string;
    blocksInd: CanonicalContentBlock[];
    blocksEn: CanonicalContentBlock[];
    pseudocode: string;
    inputDescriptionInd: string;
    inputDescriptionEn: string;
    outputDescriptionInd: string;
    outputDescriptionEn: string;
    sampleCases: CanonicalSampleCase[];
  }>();

  for (const [questionId, row] of questionById) {
    const active = parseActive(row.active) === true;
    const rawType = normalizeText(row.question_type);
    const type = canonicalQuestionType(rawType);
    if (active && !rawType) {
      addIssue(
        issues,
        "MISSING_QUESTION_TYPE",
        `questions ${questionId}: question_type is required`,
      );
    } else if (rawType && !type) {
      addIssue(
        issues,
        "INVALID_QUESTION_TYPE",
        `questions ${questionId}: question_type is invalid`,
      );
    }

    const blocksInd = parseCanonicalContentBlocks(row.content_blocks_ind);
    const blocksEn = parseCanonicalContentBlocks(row.content_blocks_en);
    if (blocksInd.error) {
      addIssue(
        issues,
        "INVALID_CONTENT_BLOCKS",
        `questions ${questionId}: content_blocks_ind ${blocksInd.error}`,
      );
    }
    if (blocksEn.error) {
      addIssue(
        issues,
        "INVALID_CONTENT_BLOCKS",
        `questions ${questionId}: content_blocks_en ${blocksEn.error}`,
      );
    }

    const questionInd = normalizeText(row.question_ind);
    const questionEn = normalizeText(row.question_en);
    const pseudocode = normalizeText(row.question_code);
    const inputDescriptionInd = normalizeText(row.input_description_ind);
    const inputDescriptionEn = normalizeText(row.input_description_en);
    const outputDescriptionInd = normalizeText(row.output_description_ind);
    const outputDescriptionEn = normalizeText(row.output_description_en);
    const testCases = parseCanonicalTestCases(row.test_cases_json);
    const sampleInputs = parseCanonicalScalarArray(row.sample_inputs);
    const sampleOutputs = parseCanonicalScalarArray(row.sample_outputs);
    if (testCases.error) {
      addIssue(
        issues,
        "INVALID_TEST_CASES",
        `questions ${questionId}: test_cases_json ${testCases.error}`,
      );
    }
    if (sampleInputs.error) {
      addIssue(
        issues,
        "INVALID_SAMPLE_CASES",
        `questions ${questionId}: sample_inputs ${sampleInputs.error}`,
      );
    }
    if (sampleOutputs.error) {
      addIssue(
        issues,
        "INVALID_SAMPLE_CASES",
        `questions ${questionId}: sample_outputs ${sampleOutputs.error}`,
      );
    }
    if (sampleInputs.values.length !== sampleOutputs.values.length) {
      addIssue(
        issues,
        "INVALID_SAMPLE_CASES",
        `questions ${questionId}: sample input/output counts differ`,
      );
    }
    const sampleCases = testCases.cases.length > 0
      ? testCases.cases
      : fallbackSampleCases(sampleInputs.values, sampleOutputs.values);
    if (
      active &&
      !questionInd &&
      !questionEn &&
      blocksInd.blocks.length === 0 &&
      blocksEn.blocks.length === 0 &&
      !pseudocode &&
      !inputDescriptionInd &&
      !inputDescriptionEn &&
      !outputDescriptionInd &&
      !outputDescriptionEn &&
      sampleCases.length === 0
    ) {
      addIssue(
        issues,
        "EMPTY_QUESTION_CONTENT",
        `questions ${questionId}: review content is empty`,
      );
    }

    questionState.set(questionId, {
      active,
      type,
      questionInd,
      questionEn,
      blocksInd: blocksInd.blocks,
      blocksEn: blocksEn.blocks,
      pseudocode,
      inputDescriptionInd,
      inputDescriptionEn,
      outputDescriptionInd,
      outputDescriptionEn,
      sampleCases,
    });
  }

  const answerState = new Map<string, {
    active: boolean;
    questionId: string;
    role: CanonicalAnswerRole | null;
  }>();
  for (const [answerId, row] of answerById) {
    const active = parseActive(row.active) === true;
    const questionId = normalizeText(row.question_id);
    const parent = questionState.get(questionId);
    const role = canonicalAnswerRole(row.answer_role);
    if (!questionId || !parent) {
      addIssue(
        issues,
        "BROKEN_ANSWER_PARENT",
        `answers ${answerId}: parent question does not exist`,
      );
    } else if (active && !parent.active) {
      addIssue(
        issues,
        "INACTIVE_ANSWER_PARENT",
        `answers ${answerId}: active answer has inactive parent`,
      );
    }
    if (!role) {
      addIssue(
        issues,
        "INVALID_ANSWER_ROLE",
        `answers ${answerId}: answer_role is invalid`,
      );
    } else if (role === "mp_option" && parent?.type !== "MP") {
      addIssue(
        issues,
        "INVALID_MP_OPTION_PARENT",
        `answers ${answerId}: mp_option parent is not MP`,
      );
    } else if (role === "ps_reference" && parent?.type !== "PS") {
      addIssue(
        issues,
        "INVALID_PS_REFERENCE_PARENT",
        `answers ${answerId}: ps_reference parent is not PS`,
      );
    }
    answerState.set(answerId, { active, questionId, role });
  }

  for (const row of rows.questionMisconceptions) {
    const questionId = normalizeText(row.question_id);
    const misconceptionId = normalizeText(row.misconception_id);
    const question = questionState.get(questionId);
    const misconception = misconceptionById.get(misconceptionId);
    const evidenceLevel = normalizeText(row.evidence_level).toUpperCase();
    if (!question) {
      addIssue(
        issues,
        "BROKEN_QUESTION_RELATION",
        `question_misconceptions ${questionId}/${misconceptionId}: question does not exist`,
      );
    }
    if (!misconception) {
      addIssue(
        issues,
        "BROKEN_MISCONCEPTION_RELATION",
        `question_misconceptions ${questionId}/${misconceptionId}: misconception does not exist`,
      );
    }
    if (evidenceLevel && evidenceLevel !== "E" && evidenceLevel !== "R") {
      addIssue(
        issues,
        "INVALID_EVIDENCE_LEVEL",
        `question_misconceptions ${questionId}/${misconceptionId}: evidence_level is invalid`,
      );
    }
    if (parseActive(row.active) === true) {
      if (question && !question.active) {
        addIssue(
          issues,
          "INACTIVE_RELATION_PARENT",
          `question_misconceptions ${questionId}/${misconceptionId}: active relation has inactive question`,
        );
      }
      if (misconception && parseActive(misconception.active) !== true) {
        addIssue(
          issues,
          "INACTIVE_RELATION_TARGET",
          `question_misconceptions ${questionId}/${misconceptionId}: active relation has inactive misconception`,
        );
      }
    }
  }

  for (const row of rows.answerMisconceptions) {
    const answerId = normalizeText(row.answer_id);
    const misconceptionId = normalizeText(row.misconception_id);
    const answer = answerState.get(answerId);
    const misconception = misconceptionById.get(misconceptionId);
    if (!answer) {
      addIssue(
        issues,
        "BROKEN_ANSWER_RELATION",
        `answer_misconceptions ${answerId}/${misconceptionId}: answer does not exist`,
      );
    } else if (answer.role !== "mp_option") {
      addIssue(
        issues,
        "NON_REVIEWABLE_ANSWER_RELATION",
        `answer_misconceptions ${answerId}/${misconceptionId}: answer is not mp_option`,
      );
    }
    if (!misconception) {
      addIssue(
        issues,
        "BROKEN_MISCONCEPTION_RELATION",
        `answer_misconceptions ${answerId}/${misconceptionId}: misconception does not exist`,
      );
    }
    if (parseActive(row.active) === true) {
      if (answer && !answer.active) {
        addIssue(
          issues,
          "INACTIVE_RELATION_PARENT",
          `answer_misconceptions ${answerId}/${misconceptionId}: active relation has inactive answer`,
        );
      }
      if (misconception && parseActive(misconception.active) !== true) {
        addIssue(
          issues,
          "INACTIVE_RELATION_TARGET",
          `answer_misconceptions ${answerId}/${misconceptionId}: active relation has inactive misconception`,
        );
      }
    }
  }

  if (issues.length > 0) return { ok: false, issues };

  const activeQuestions = [...questionState.entries()]
    .filter(([, question]) => question.active)
    .sort(([left], [right]) => compareText(left, right));
  const questionContexts = await Promise.all(
    activeQuestions.map(
      async ([questionId, question]): Promise<TrustedQuestionContext> => {
        const questionType = question.type!;
        return {
          questionId,
          questionType,
          questionInd: question.questionInd,
          questionEn: question.questionEn,
          contentBlocksInd: question.blocksInd,
          contentBlocksEn: question.blocksEn,
          pseudocode: question.pseudocode,
          inputDescriptionInd: question.inputDescriptionInd,
          inputDescriptionEn: question.inputDescriptionEn,
          outputDescriptionInd: question.outputDescriptionInd,
          outputDescriptionEn: question.outputDescriptionEn,
          sampleCases: question.sampleCases,
          hasStructuredContent: hasReviewStructuredContent({
            contentBlocksInd: question.blocksInd,
            contentBlocksEn: question.blocksEn,
            pseudocode: question.pseudocode,
            inputDescriptionInd: question.inputDescriptionInd,
            inputDescriptionEn: question.inputDescriptionEn,
            outputDescriptionInd: question.outputDescriptionInd,
            outputDescriptionEn: question.outputDescriptionEn,
            sampleCases: question.sampleCases,
          }),
          contentFingerprint: await contentFingerprint({
            questionType,
            questionInd: question.questionInd,
            questionEn: question.questionEn,
            contentBlocksInd: question.blocksInd,
            contentBlocksEn: question.blocksEn,
            pseudocode: question.pseudocode,
            inputDescriptionInd: question.inputDescriptionInd,
            inputDescriptionEn: question.inputDescriptionEn,
            outputDescriptionInd: question.outputDescriptionInd,
            outputDescriptionEn: question.outputDescriptionEn,
            sampleCases: question.sampleCases,
          }),
        };
      },
    ),
  );

  const questionBaselines = await Promise.all(
    activeQuestions.map(
      async ([questionId]): Promise<QuestionBaselinePayload> => {
        const relations = (questionRelationsByQuestion.get(questionId) ?? [])
          .map((row) => ({
            misconception_id: normalizeText(row.misconception_id),
            source: normalizeText(row.source),
            evidence_level: normalizeText(row.evidence_level).toUpperCase(),
            rationale_ind: normalizeText(row.rationale_ind),
            source_question_id: normalizeText(row.source_question_id),
          }));
        return {
          question_id: questionId,
          source_fingerprint: await relationshipFingerprint(
            "question",
            relations,
          ),
          misconception_ids: uniqueSorted(
            relations.map((relation) => relation.misconception_id),
          ),
        };
      },
    ),
  );

  const activeReviewableAnswers = [...answerState.entries()]
    .filter(([, answer]) => answer.active && answer.role === "mp_option")
    .sort(([left], [right]) => compareText(left, right));
  const answerBaselines = await Promise.all(
    activeReviewableAnswers.map(
      async ([answerId, answer]): Promise<AnswerBaselinePayload> => {
        const relations = (answerRelationsByAnswer.get(answerId) ?? [])
          .map((row) => ({
            misconception_id: normalizeText(row.misconception_id),
            reason_ind: normalizeText(row.reason_ind),
            reason_en: normalizeText(row.reason_en),
          }));
        return {
          answer_id: answerId,
          question_id: answer.questionId,
          source_fingerprint: await relationshipFingerprint(
            "answer",
            relations,
          ),
          misconception_ids: uniqueSorted(
            relations.map((relation) => relation.misconception_id),
          ),
        };
      },
    ),
  );

  const misconceptionIds = uniqueSorted(
    [...misconceptionById.entries()]
      .filter(([, row]) => parseActive(row.active) === true)
      .map(([id]) => id),
  );
  const relationSnapshotFingerprint = await deterministicFingerprint({
    scheme: "review-relationship-snapshot-v1",
    question_baselines: questionBaselines,
    answer_baselines: answerBaselines,
    misconception_ids: misconceptionIds,
  });
  const contentSnapshotFingerprint = await deterministicFingerprint({
    scheme: "review-question-content-snapshot-v2",
    question_contexts: questionContexts,
  });

  return {
    ok: true,
    snapshot: {
      questionBaselines,
      answerBaselines,
      misconceptionIds,
      questionContexts,
      relationSnapshotFingerprint,
      contentSnapshotFingerprint,
    },
  };
}

export function summarizeTrustedMasterSnapshot(
  snapshot: TrustedMasterSnapshot,
): TrustedMasterPreview {
  return {
    questionCount: snapshot.questionBaselines.length,
    answerBaselineCount: snapshot.answerBaselines.length,
    misconceptionCount: snapshot.misconceptionIds.length,
    psQuestionCount: snapshot.questionContexts.filter(
      (question) => question.questionType === "PS",
    ).length,
    mpQuestionCount: snapshot.questionContexts.filter(
      (question) => question.questionType === "MP",
    ).length,
    structuredQuestionCount: snapshot.questionContexts.filter(
      (question) => question.hasStructuredContent,
    ).length,
    relationSnapshotFingerprint: snapshot.relationSnapshotFingerprint,
    contentSnapshotFingerprint: snapshot.contentSnapshotFingerprint,
    validationErrors: [],
  };
}
