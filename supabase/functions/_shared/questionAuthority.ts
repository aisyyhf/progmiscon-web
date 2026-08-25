export const QUESTION_AUTHORITY_CANONICALIZER_VERSION =
  "progmiscon-questions-a-ak-v1";

export const QUESTION_AUTHORITY_HEADERS = [
  "question_id",
  "title_ind",
  "title_en",
  "question_ind",
  "question_en",
  "question_code",
  "reference_solution",
  "expected_output",
  "week",
  "source_no",
  "order_no",
  "active",
  "data_status",
  "question_type",
  "source_system",
  "source_key",
  "source_code",
  "level",
  "short_description_ind",
  "short_description_en",
  "content_blocks_ind",
  "content_blocks_en",
  "sample_inputs",
  "sample_outputs",
  "probe_no",
  "target_misconception_id",
  "input_description_ind",
  "input_description_en",
  "output_description_ind",
  "output_description_en",
  "io_content_type",
  "test_cases_json",
  "options_json",
  "correct_option_label",
  "evidence_available",
  "lms_question_id",
  "display_question_code",
] as const;

export type QuestionAuthorityHeader =
  (typeof QUESTION_AUTHORITY_HEADERS)[number];
export type CanonicalQuestionType = "PS" | "MP";
export type QuestionAuthorityBlockedReason =
  | "QUESTION_INACTIVE"
  | "QUESTION_TYPE_NOT_SUPPORTED"
  | "STRUCTURED_CONTENT_NOT_SUPPORTED"
  | "AUTHORITATIVE_LOCALE_REQUIRED";

export type QuestionAuthorityRow = {
  values: Record<QuestionAuthorityHeader, string>;
  canonicalQuestionType: CanonicalQuestionType;
  active: boolean;
  rawSingleText: boolean;
  editable: boolean;
  blockedReason: QuestionAuthorityBlockedReason | null;
  targetSha256: string;
};

export type QuestionAuthorityDataset = {
  rows: QuestionAuthorityRow[];
  byId: Map<string, QuestionAuthorityRow>;
  canonicalSerialization: string;
  canonicalSha256: string;
};

export class QuestionAuthorityError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "QuestionAuthorityError";
    this.code = code;
  }
}

const JSON_FIELDS = new Set<QuestionAuthorityHeader>([
  "content_blocks_ind",
  "content_blocks_en",
  "sample_inputs",
  "sample_outputs",
  "test_cases_json",
  "options_json",
]);
const TRUE_VALUES = new Set(["true", "1", "yes", "y"]);

function fail(code: string, message: string): never {
  throw new QuestionAuthorityError(code, message);
}

export function normalizeAuthorityText(value: unknown): string {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

function isActiveValue(value: string): boolean {
  return TRUE_VALUES.has(normalizeAuthorityText(value).toLowerCase());
}

function normalizeQuestionType(value: string): CanonicalQuestionType | null {
  const normalized = normalizeAuthorityText(value).toLowerCase();
  if (["ps", "essay", "short answer", "short_answer"].includes(normalized)) {
    return "PS";
  }
  if (["mp", "multiple choice", "multiple_choice"].includes(normalized)) {
    return "MP";
  }
  return null;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [
          key,
          stableValue((value as Record<string, unknown>)[key]),
        ]),
    );
  }
  return value;
}

function stableJson(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

class DuplicateJsonKeyError extends SyntaxError {}

function exactJsonNumber(value: string): string {
  const match = value.match(
    /^(-?)(0|[1-9]\d*)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/,
  );
  if (!match) throw new SyntaxError("Invalid JSON number");
  const fraction = match[3] ?? "";
  let digits = `${match[2]}${fraction}`.replace(/^0+/, "");
  if (!digits) return "0";

  let exponent = BigInt(match[4] ?? "0") - BigInt(fraction.length);
  const trailingZeros = digits.match(/0+$/)?.[0].length ?? 0;
  if (trailingZeros) {
    digits = digits.slice(0, -trailingZeros);
    exponent += BigInt(trailingZeros);
  }
  return `${match[1]}${digits}e${exponent}`;
}

function parseJsonWithoutDuplicateKeys(source: string): unknown {
  let index = 0;

  const invalid = (): never => {
    throw new SyntaxError("Invalid JSON");
  };
  const skipWhitespace = () => {
    while (
      source[index] === " " ||
      source[index] === "\t" ||
      source[index] === "\r" ||
      source[index] === "\n"
    ) index += 1;
  };
  const parseString = (): string => {
    if (source[index] !== '"') return invalid();
    const start = index;
    index += 1;
    while (index < source.length) {
      if (source[index] === "\\") {
        index += 2;
        continue;
      }
      if (source[index] === '"') {
        index += 1;
        return JSON.parse(source.slice(start, index)) as string;
      }
      index += 1;
    }
    return invalid();
  };
  const parseValue = (): unknown => {
    skipWhitespace();
    if (source[index] === '"') return parseString();
    if (source[index] === "[") {
      index += 1;
      skipWhitespace();
      const values: unknown[] = [];
      if (source[index] === "]") {
        index += 1;
        return values;
      }
      while (true) {
        values.push(parseValue());
        skipWhitespace();
        if (source[index] === "]") {
          index += 1;
          return values;
        }
        if (source[index] !== ",") return invalid();
        index += 1;
      }
    }
    if (source[index] === "{") {
      index += 1;
      skipWhitespace();
      const entries: Array<[string, unknown]> = [];
      const keys = new Set<string>();
      if (source[index] === "}") {
        index += 1;
        return {};
      }
      while (true) {
        skipWhitespace();
        const key = parseString();
        if (keys.has(key)) throw new DuplicateJsonKeyError();
        keys.add(key);
        skipWhitespace();
        if (source[index] !== ":") return invalid();
        index += 1;
        entries.push([key, parseValue()]);
        skipWhitespace();
        if (source[index] === "}") {
          index += 1;
          return Object.fromEntries(entries);
        }
        if (source[index] !== ",") return invalid();
        index += 1;
      }
    }
    for (const [literal, value] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ] as const) {
      if (source.startsWith(literal, index)) {
        index += literal.length;
        return value;
      }
    }
    const number = source.slice(index).match(
      /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/,
    )?.[0];
    if (!number) return invalid();
    index += number.length;
    const parsed = JSON.parse(number) as number;
    if (
      !Number.isFinite(parsed) ||
      exactJsonNumber(number) !== exactJsonNumber(String(parsed))
    ) return invalid();
    return parsed;
  };

  const parsed = parseValue();
  skipWhitespace();
  if (index !== source.length) return invalid();
  return parsed;
}

export async function sha256Hex(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function reviewedSourceIdentitySha256(input: {
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetId: number;
  tab: string;
  range: string;
}): Promise<string> {
  return sha256Hex(JSON.stringify({
    spreadsheetId: normalizeAuthorityText(input.spreadsheetId),
    spreadsheetTitle: normalizeAuthorityText(input.spreadsheetTitle),
    sheetId: input.sheetId,
    tab: normalizeAuthorityText(input.tab),
    range: normalizeAuthorityText(input.range),
  }));
}

function validateJsonShape(
  field: QuestionAuthorityHeader,
  parsed: unknown,
  questionId: string,
): void {
  const malformed = (message: string): never =>
    fail("MALFORMED_STRUCTURAL_JSON", `${questionId} ${field}: ${message}`);

  if (field === "content_blocks_ind" || field === "content_blocks_en") {
    if (!Array.isArray(parsed)) malformed("must be an array");
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        malformed("each block must be an object");
      }
      const block = item as Record<string, unknown>;
      if (block.type !== "text" && block.type !== "code") {
        malformed("block type must be text or code");
      }
      if (typeof block.content !== "string") {
        malformed("block content must be a string");
      }
    }
    return;
  }

  if (field === "sample_inputs" || field === "sample_outputs") {
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => item !== null && typeof item === "object")
    ) {
      malformed("must be an array of scalar values");
    }
    return;
  }

  if (field === "test_cases_json") {
    if (!Array.isArray(parsed)) malformed("must be an array");
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        malformed("each test case must be an object");
      }
      const testCase = item as Record<string, unknown>;
      if (
        typeof testCase.input !== "string" ||
        typeof testCase.output !== "string"
      ) {
        malformed("test case input and output must be strings");
      }
      if (
        !normalizeAuthorityText(testCase.input) &&
        !normalizeAuthorityText(testCase.output)
      ) {
        malformed("test case input and output cannot both be blank");
      }
      if (
        testCase.case_no !== undefined &&
        (!Number.isFinite(Number(testCase.case_no)) || Number(testCase.case_no) <= 0)
      ) {
        malformed("test case case_no must be positive");
      }
    }
    return;
  }

  if (field === "options_json") {
    if (!Array.isArray(parsed)) malformed("must be an array");
    for (const item of parsed) {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        malformed("each option must be an object");
      }
      const option = item as Record<string, unknown>;
      if (
        typeof option.answer_id !== "string" ||
        !normalizeAuthorityText(option.answer_id) ||
        typeof option.label !== "string" ||
        !normalizeAuthorityText(option.label) ||
        typeof option.text !== "string" ||
        !normalizeAuthorityText(option.text)
      ) {
        malformed("option answer_id, label, and text must be nonblank strings");
      }
      if (
        !Array.isArray(option.misconceptions) ||
        option.misconceptions.some(
          (value) => typeof value !== "string" || !normalizeAuthorityText(value),
        )
      ) {
        malformed("option misconceptions must be nonblank strings");
      }
      if (
        option.is_correct !== undefined &&
        typeof option.is_correct !== "boolean"
      ) {
        malformed("option is_correct must be boolean");
      }
    }
  }
}

function parseStructuralField(
  field: QuestionAuthorityHeader,
  value: string,
  questionId: string,
): unknown {
  if (!value) return null;
  let parsed: unknown;
  try {
    parsed = parseJsonWithoutDuplicateKeys(value);
  } catch (error) {
    return fail(
      "MALFORMED_STRUCTURAL_JSON",
      `${questionId} ${field}: ${
        error instanceof DuplicateJsonKeyError
          ? "duplicate object key"
          : "invalid JSON"
      }`,
    );
  }
  validateJsonShape(field, parsed, questionId);
  return parsed;
}

type ContentBlock = { type: "text" | "code"; content: string };

function nonblankBlocks(value: unknown): ContentBlock[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const block = item as Record<string, unknown>;
    const content = normalizeAuthorityText(block.content);
    return content && (block.type === "text" || block.type === "code")
      ? [{ type: block.type, content }]
      : [];
  });
}

function exactHeaders(headers: readonly string[]): boolean {
  return headers.length === QUESTION_AUTHORITY_HEADERS.length &&
    headers.every((header, index) => header === QUESTION_AUTHORITY_HEADERS[index]);
}

function rowSerialization(
  values: Record<QuestionAuthorityHeader, string>,
  canonicalQuestionType: CanonicalQuestionType,
  editable: boolean,
): Record<string, string | boolean> {
  const canonical: Record<string, string | boolean> = {};
  for (const header of QUESTION_AUTHORITY_HEADERS) {
    if (header === "question_type") canonical[header] = canonicalQuestionType;
    else if (header === "active") canonical[header] = isActiveValue(values.active);
    else canonical[header] = values[header];
  }
  canonical.canonical_question_type = canonicalQuestionType;
  canonical.raw_single_text_editable = editable;
  return canonical;
}

export async function canonicalizeQuestionAuthority(
  matrix: readonly (readonly unknown[])[],
): Promise<QuestionAuthorityDataset> {
  if (matrix.length === 0) fail("EMPTY_DATASET", "Questions dataset is empty");
  const headers = matrix[0].map(normalizeAuthorityText);
  if (!exactHeaders(headers)) {
    fail("SCHEMA_MISMATCH", "Questions A:AK schema does not match the reviewed schema");
  }

  const parsedRows: Array<{
    values: Record<QuestionAuthorityHeader, string>;
    parsed: Partial<Record<QuestionAuthorityHeader, unknown>>;
    canonicalQuestionType: CanonicalQuestionType;
    active: boolean;
    rawSingleText: boolean;
    editable: boolean;
    blockedReason: QuestionAuthorityBlockedReason | null;
  }> = [];
  const seen = new Set<string>();

  for (let index = 1; index < matrix.length; index += 1) {
    const source = matrix[index];
    if (source.every((value) => !normalizeAuthorityText(value))) continue;
    if (source.length > QUESTION_AUTHORITY_HEADERS.length) {
      fail("SCHEMA_MISMATCH", `Questions row ${index + 1} exceeds column AK`);
    }
    const values = Object.fromEntries(
      QUESTION_AUTHORITY_HEADERS.map((header, column) => [
        header,
        normalizeAuthorityText(source[column]),
      ]),
    ) as Record<QuestionAuthorityHeader, string>;
    const questionId = values.question_id;
    if (!/^Q\d{3}$/.test(questionId)) {
      fail("MALFORMED_QUESTION_ID", `Questions row ${index + 1} has an invalid ID`);
    }
    if (seen.has(questionId)) {
      fail("DUPLICATE_QUESTION_ID", `Duplicate question_id: ${questionId}`);
    }
    seen.add(questionId);

    const canonicalQuestionType = normalizeQuestionType(values.question_type);
    if (!canonicalQuestionType) {
      fail("UNKNOWN_QUESTION_TYPE", `${questionId} has an unknown question type`);
    }

    const parsed: Partial<Record<QuestionAuthorityHeader, unknown>> = {};
    for (const field of JSON_FIELDS) {
      parsed[field] = parseStructuralField(field, values[field], questionId);
      if (parsed[field] !== null) values[field] = stableJson(parsed[field]);
    }
    const sampleInputs = (parsed.sample_inputs ?? []) as unknown[];
    const sampleOutputs = (parsed.sample_outputs ?? []) as unknown[];
    if (sampleInputs.length !== sampleOutputs.length) {
      fail(
        "MALFORMED_STRUCTURAL_JSON",
        `${questionId} sample input/output counts differ`,
      );
    }
    if (canonicalQuestionType === "MP") {
      const options = parsed.options_json;
      if (!Array.isArray(options) || options.length !== 4) {
        fail(
          "MALFORMED_STRUCTURAL_JSON",
          `${questionId} must contain exactly four options`,
        );
      }
      const labels = options.map((item) =>
        normalizeAuthorityText((item as Record<string, unknown>).label).toUpperCase()
      );
      if (new Set(labels).size !== labels.length) {
        fail("MALFORMED_STRUCTURAL_JSON", `${questionId} option labels are not unique`);
      }
      const correct = values.correct_option_label.toUpperCase();
      if (!correct || !labels.includes(correct)) {
        fail(
          "MALFORMED_STRUCTURAL_JSON",
          `${questionId} correct option label does not resolve`,
        );
      }
    }

    const active = isActiveValue(values.active);
    const indBlocks = nonblankBlocks(parsed.content_blocks_ind);
    const enBlocks = nonblankBlocks(parsed.content_blocks_en);
    const singleText = indBlocks.length === 1 && indBlocks[0].type === "text" &&
      enBlocks.length === 1 && enBlocks[0].type === "text";
    const localesComplete = Boolean(values.question_ind && values.question_en);
    const editable = active && canonicalQuestionType === "PS" && singleText &&
      localesComplete;
    const blockedReason: QuestionAuthorityBlockedReason | null = editable
      ? null
      : !active
      ? "QUESTION_INACTIVE"
      : canonicalQuestionType === "MP"
      ? "QUESTION_TYPE_NOT_SUPPORTED"
      : !singleText
      ? "STRUCTURED_CONTENT_NOT_SUPPORTED"
      : "AUTHORITATIVE_LOCALE_REQUIRED";

    parsedRows.push({
      values,
      parsed,
      canonicalQuestionType,
      active,
      rawSingleText: singleText,
      editable,
      blockedReason,
    });
  }

  const sorted = [...parsedRows].sort((left, right) =>
    left.values.question_id.localeCompare(right.values.question_id, undefined, {
      numeric: true,
    })
  );
  const activeCanonicalRows = sorted
    .filter((row) => row.active)
    .map((row) =>
      rowSerialization(row.values, row.canonicalQuestionType, row.editable)
    );
  const canonicalSerialization = JSON.stringify({
    canonicalizer: QUESTION_AUTHORITY_CANONICALIZER_VERSION,
    headers: QUESTION_AUTHORITY_HEADERS,
    rows: activeCanonicalRows,
  });

  const rows = await Promise.all(sorted.map(async (row) => {
    const targetSerialization = JSON.stringify({
      canonicalizer: QUESTION_AUTHORITY_CANONICALIZER_VERSION,
      row: rowSerialization(
        row.values,
        row.canonicalQuestionType,
        row.editable,
      ),
    });
    return {
      values: row.values,
      canonicalQuestionType: row.canonicalQuestionType,
      active: row.active,
      rawSingleText: row.rawSingleText,
      editable: row.editable,
      blockedReason: row.blockedReason,
      targetSha256: await sha256Hex(targetSerialization),
    } satisfies QuestionAuthorityRow;
  }));

  return {
    rows,
    byId: new Map(rows.map((row) => [row.values.question_id, row])),
    canonicalSerialization,
    canonicalSha256: await sha256Hex(canonicalSerialization),
  };
}

export function parseQuestionsCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"') {
        if (csv[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += character;
      }
    } else if (character === '"') {
      if (field) fail("CSV_MALFORMED", "Quote inside an unquoted CSV field");
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) fail("CSV_MALFORMED", "CSV ended inside a quoted field");
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  if (rows[0]?.[0]?.charCodeAt(0) === 0xfeff) {
    rows[0][0] = rows[0][0].slice(1);
  }
  return rows;
}
