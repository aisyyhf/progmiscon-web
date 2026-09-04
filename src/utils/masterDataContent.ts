import type { LocalizedText } from "../types/language";
import type {
  QuestionContentBlock,
  QuestionOption,
  QuestionSampleCase,
} from "../types/question";

export const DUMMY_DATA_PATTERN = /\bDATA\s+DUMMY\b/i;

export function isDummyData(value: string | undefined): boolean {
  return DUMMY_DATA_PATTERN.test(value ?? "");
}

function normalized(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function normalizedLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

const SAMPLE_HEADER_LINES = new Set([
  "contoh",
  "contoh kasus",
  "example",
  "sample",
  "sample case",
  "sample cases",
  "masukan hasil",
  "masukan keluaran",
  "input output",
  "input result",
]);

const INPUT_LABEL = /^(?:masukan|input)\s*:?\s*/i;
const OUTPUT_LABEL = /^(?:keluaran|hasil|output|result)\s*:?\s*/i;

function nextNonEmptyLine(lines: string[], start: number): number {
  for (let index = start; index < lines.length; index += 1) {
    if (normalizedLine(lines[index])) return index;
  }
  return -1;
}

function matchValueLines(
  lines: string[],
  start: number,
  expected: string,
): number | undefined {
  const target = normalizedLine(expected);
  let value = "";

  for (let index = start; index < lines.length; index += 1) {
    const line = normalizedLine(lines[index]);
    if (!line) continue;
    value = normalizedLine(`${value} ${line}`);
    if (value === target) return index;
    if (value.length >= target.length || !target.startsWith(value)) return undefined;
  }
  return undefined;
}

function matchLabeledValue(
  lines: string[],
  start: number,
  label: RegExp,
  expected: string,
): number | undefined {
  const line = normalizedLine(lines[start]);
  const match = line.match(label);
  if (!match) return undefined;
  const inlineValue = normalizedLine(line.slice(match[0].length));
  if (inlineValue) return inlineValue === normalizedLine(expected) ? start : undefined;

  const valueStart = nextNonEmptyLine(lines, start + 1);
  return valueStart < 0 ? undefined : matchValueLines(lines, valueStart, expected);
}

function matchSampleAt(
  lines: string[],
  start: number,
  sample: QuestionSampleCase,
): number | undefined {
  const compactPair = normalizedLine(`${sample.input} ${sample.output}`);
  if (normalizedLine(lines[start]) === compactPair) return start;

  const inputEnd = matchLabeledValue(lines, start, INPUT_LABEL, sample.input);
  if (inputEnd === undefined) return undefined;
  const outputStart = nextNonEmptyLine(lines, inputEnd + 1);
  return outputStart < 0
    ? undefined
    : matchLabeledValue(lines, outputStart, OUTPUT_LABEL, sample.output);
}

function removeDuplicateSamplesFromText(
  content: string,
  sampleCases: QuestionSampleCase[],
): string | undefined {
  if (sampleCases.length === 0) return content;
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  for (let start = 0; start < lines.length; start += 1) {
    let cursor = start;
    let end: number | undefined;

    for (const sample of sampleCases) {
      cursor = nextNonEmptyLine(lines, cursor);
      if (cursor < 0) {
        end = undefined;
        break;
      }
      end = matchSampleAt(lines, cursor, sample);
      if (end === undefined) break;
      cursor = end + 1;
    }
    if (end === undefined) continue;

    const followingLine = nextNonEmptyLine(lines, end + 1);
    if (
      followingLine >= 0 &&
      !lines.slice(end + 1, followingLine).some((line) => !normalizedLine(line))
    ) {
      continue;
    }

    let removeStart = start;
    let headerCursor = start - 1;
    let headerCount = 0;
    while (headerCursor >= 0 && !normalizedLine(lines[headerCursor])) {
      removeStart = headerCursor;
      headerCursor -= 1;
    }
    while (headerCursor >= 0 && headerCount < 2) {
      const header = normalizedLine(lines[headerCursor]).replace(/:$/, "").toLowerCase();
      if (!SAMPLE_HEADER_LINES.has(header)) break;
      removeStart = headerCursor;
      headerCount += 1;
      headerCursor -= 1;
      while (headerCursor >= 0 && !normalizedLine(lines[headerCursor])) {
        removeStart = headerCursor;
        headerCursor -= 1;
      }
    }

    const remaining = [...lines.slice(0, removeStart), ...lines.slice(end + 1)]
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    return remaining || undefined;
  }

  return content;
}

export function suppressDuplicateSampleFragments(
  blocks: QuestionContentBlock[],
  sampleCases: QuestionSampleCase[],
): QuestionContentBlock[] {
  if (sampleCases.length === 0) return blocks;

  let suppressed = false;
  return blocks.flatMap((block) => {
    if (suppressed || block.type !== "text") return [block];
    const content = removeDuplicateSamplesFromText(block.content, sampleCases);
    if (content === block.content) return [block];
    suppressed = true;
    return content ? [{ ...block, content }] : [];
  });
}

function comparableText(value: string): string {
  return normalizedLine(value).replace(/[.:;,]+$/, "").toLocaleLowerCase();
}

function withoutMatchingIoLine(
  content: string,
  label: RegExp,
  expected: string,
): string {
  const comparableExpected = comparableText(expected);
  if (!comparableExpected) return content;

  return content
    .split("\n")
    .filter((line) => {
      const match = normalizedLine(line).match(label);
      if (!match) return true;
      return comparableText(normalizedLine(line).slice(match[0].length)) !== comparableExpected;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function suppressDuplicateIoDescriptions(
  blocks: QuestionContentBlock[],
  inputDescription: string | undefined,
  outputDescription: string | undefined,
): QuestionContentBlock[] {
  if (!inputDescription?.trim() && !outputDescription?.trim()) return blocks;

  return blocks.flatMap((block) => {
    if (block.type !== "text") return [block];
    const withoutInput = withoutMatchingIoLine(
      block.content,
      INPUT_LABEL,
      inputDescription ?? "",
    );
    const content = withoutMatchingIoLine(
      withoutInput,
      OUTPUT_LABEL,
      outputDescription ?? "",
    );
    return content ? [{ ...block, content }] : [];
  });
}

export function parseContentBlocks(raw: string | undefined): {
  blocks: QuestionContentBlock[];
  error?: string;
} {
  const value = raw?.trim();
  if (!value) return { blocks: [] };

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return { blocks: [], error: "harus berupa array JSON" };

    const blocks: QuestionContentBlock[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        return { blocks: [], error: "setiap blok harus berupa object" };
      }
      const candidate = item as Record<string, unknown>;
      if (
        (candidate.type !== "text" && candidate.type !== "code") ||
        typeof candidate.content !== "string"
      ) {
        return { blocks: [], error: "type/content blok tidak valid" };
      }
      const content = candidate.content.trim();
      if (content) blocks.push({ type: candidate.type, content });
    }
    return { blocks };
  } catch {
    return { blocks: [], error: "JSON tidak valid" };
  }
}

export function buildQuestionContentBlocks(
  raw: string | undefined,
  legacyText: string | undefined,
  legacyCode: string | undefined,
  sampleCases: QuestionSampleCase[] = [],
): QuestionContentBlock[] {
  const parsed = parseContentBlocks(raw);
  const text = normalized(legacyText ?? "");
  const code = normalized(legacyCode ?? "");
  const blocks = parsed.error || parsed.blocks.length === 0
    ? text
      ? [{ type: "text" as const, content: text }]
      : []
    : [...parsed.blocks];

  const contentBlocks = suppressDuplicateSampleFragments(blocks, sampleCases);
  if (code && !contentBlocks.some((block) => normalized(block.content).includes(code))) {
    contentBlocks.push({ type: "code", content: code });
  }
  return contentBlocks;
}

export function parseStringArray(raw: string | undefined): {
  values: string[];
  error?: string;
} {
  const value = raw?.trim();
  if (!value) return { values: [] };
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      !Array.isArray(parsed) ||
      parsed.some((item) => item !== null && typeof item === "object")
    ) {
      return { values: [], error: "harus berupa array JSON berisi nilai skalar" };
    }
    return {
      values: parsed.map((item) => item === null ? "" : String(item).trim()),
    };
  } catch {
    return { values: [], error: "JSON tidak valid" };
  }
}

export function buildSampleCases(
  inputsRaw: string | undefined,
  outputsRaw: string | undefined,
): QuestionSampleCase[] {
  const inputs = parseStringArray(inputsRaw);
  const outputs = parseStringArray(outputsRaw);
  if (inputs.error || outputs.error || inputs.values.length !== outputs.values.length) return [];

  return inputs.values.flatMap((input, index) => {
    const output = outputs.values[index] ?? "";
    return input && output && !isDummyData(input) && !isDummyData(output)
      ? [{ input, output }]
      : [];
  });
}

export function parseTestCases(raw: string | undefined): {
  cases: QuestionSampleCase[];
  error?: string;
} {
  const value = raw?.trim();
  if (!value) return { cases: [] };

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return { cases: [], error: "harus berupa array JSON" };

    const cases: QuestionSampleCase[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        return { cases: [], error: "setiap test case harus berupa object" };
      }
      const candidate = item as Record<string, unknown>;
      if (typeof candidate.input !== "string" || typeof candidate.output !== "string") {
        return { cases: [], error: "input/output test case wajib berupa string" };
      }
      const input = candidate.input.trim();
      const output = candidate.output.trim();
      const caseNo = Number(candidate.case_no);
      if (!input && !output) {
        return { cases: [], error: "input/output test case tidak boleh sama-sama kosong" };
      }
      cases.push({
        ...(Number.isFinite(caseNo) && caseNo > 0 ? { caseNo } : {}),
        input,
        output,
      });
    }
    return { cases };
  } catch {
    return { cases: [], error: "JSON tidak valid" };
  }
}

export function buildQuestionSampleCases(
  testCasesRaw: string | undefined,
  inputsRaw: string | undefined,
  outputsRaw: string | undefined,
): QuestionSampleCase[] {
  const structured = parseTestCases(testCasesRaw);
  return !structured.error && structured.cases.length > 0
    ? structured.cases
    : buildSampleCases(inputsRaw, outputsRaw);
}

/**
 * Resolves an option's localized text from either shape:
 * - legacy: `text` (single string, shown unchanged in both languages)
 * - bilingual: `text_ind` + `text_en` (both required together)
 *
 * If both shapes are present and complete, this is treated as an ambiguous
 * authoring error rather than silently preferring one — no current data
 * needs both at once, and picking a winner would hide a mistake in the
 * canonical Sheet instead of surfacing it.
 */
function resolveOptionLocalizedText(
  candidate: Record<string, unknown>,
): { text: LocalizedText | null; ambiguous: boolean } {
  const legacyText = typeof candidate.text === "string" ? candidate.text.trim() : "";
  const textInd = typeof candidate.text_ind === "string" ? candidate.text_ind.trim() : "";
  const textEn = typeof candidate.text_en === "string" ? candidate.text_en.trim() : "";

  const hasLegacy = legacyText.length > 0;
  const hasBilingual = textInd.length > 0 && textEn.length > 0;

  if (hasLegacy && hasBilingual) return { text: null, ambiguous: true };
  if (hasLegacy) return { text: { id: legacyText, en: legacyText }, ambiguous: false };
  if (hasBilingual) return { text: { id: textInd, en: textEn }, ambiguous: false };
  return { text: null, ambiguous: false };
}

export function parseQuestionOptions(
  raw: string | undefined,
  correctOptionLabel: string | undefined,
): { options: QuestionOption[]; error?: string } {
  const value = raw?.trim();
  if (!value) return { options: [] };
  const correctLabel = correctOptionLabel?.trim().toUpperCase() ?? "";

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return { options: [], error: "harus berupa array JSON" };

    const options: QuestionOption[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") {
        return { options: [], error: "setiap opsi harus berupa object" };
      }
      const candidate = item as Record<string, unknown>;
      const id = typeof candidate.answer_id === "string" ? candidate.answer_id.trim() : "";
      const label = typeof candidate.label === "string" ? candidate.label.trim().toUpperCase() : "";
      const rawMisconceptions = candidate.misconceptions;
      const resolvedText = resolveOptionLocalizedText(candidate);
      if (resolvedText.ambiguous) {
        return {
          options: [],
          error: "opsi tidak boleh mengisi text bersamaan dengan text_ind dan text_en",
        };
      }
      if (!id || !label || !resolvedText.text || !Array.isArray(rawMisconceptions)) {
        return {
          options: [],
          error: "answer_id/label/text (atau text_ind dan text_en)/misconceptions opsi tidak valid",
        };
      }
      const misconceptionIds = [...new Set(
        rawMisconceptions
          .filter((misconception): misconception is string => typeof misconception === "string")
          .map((misconception) => misconception.trim())
          .filter(Boolean),
      )];
      if (misconceptionIds.length !== rawMisconceptions.length) {
        return { options: [], error: "misconceptions opsi harus berupa array string" };
      }
      options.push({
        id,
        label,
        text: resolvedText.text,
        isCorrect: correctLabel
          ? label === correctLabel
          : candidate.is_correct === true,
        misconceptionIds,
        ...(misconceptionIds.length === 1
          ? { misconceptionId: misconceptionIds[0] }
          : {}),
      });
    }
    return { options };
  } catch {
    return { options: [], error: "JSON tidak valid" };
  }
}

export function parseDelimitedIds(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(/[;,\n]/).map((id) => id.trim()).filter(Boolean))];
}

export function parseReasonMap(raw: string | undefined): {
  reasons: Map<string, string>;
  error?: string;
} {
  const value = raw?.trim();
  if (!value) return { reasons: new Map() };
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      return { reasons: new Map(), error: "harus berupa object JSON" };
    }
    const entries = Object.entries(parsed as Record<string, unknown>);
    if (entries.some(([, reason]) => typeof reason !== "string")) {
      return { reasons: new Map(), error: "nilai alasan harus berupa string" };
    }
    return {
      reasons: new Map(entries.map(([id, reason]) => [id.trim(), (reason as string).trim()])),
    };
  } catch {
    return { reasons: new Map(), error: "JSON tidak valid" };
  }
}

export function buildLocalizedReasonMap(
  indonesianRaw: string | undefined,
  englishRaw: string | undefined,
): Array<{ misconceptionId: string; reason: LocalizedText }> {
  const indonesian = parseReasonMap(indonesianRaw).reasons;
  const english = parseReasonMap(englishRaw).reasons;
  return [...new Set([...indonesian.keys(), ...english.keys()])].map((misconceptionId) => {
    const id = indonesian.get(misconceptionId) ?? "";
    const en = english.get(misconceptionId) ?? "";
    return { misconceptionId, reason: { id: id || en, en: en || id } };
  });
}
