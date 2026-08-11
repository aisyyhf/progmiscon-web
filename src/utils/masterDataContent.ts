import type { LocalizedText } from "../types/language";
import type { QuestionContentBlock, QuestionSampleCase } from "../types/question";

export const DUMMY_DATA_PATTERN = /\bDATA\s+DUMMY\b/i;

export function isDummyData(value: string | undefined): boolean {
  return DUMMY_DATA_PATTERN.test(value ?? "");
}

function normalized(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
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
): QuestionContentBlock[] {
  const parsed = parseContentBlocks(raw);
  const text = normalized(legacyText ?? "");
  const code = normalized(legacyCode ?? "");
  const blocks = parsed.error || parsed.blocks.length === 0
    ? text
      ? [{ type: "text" as const, content: text }]
      : []
    : [...parsed.blocks];

  if (code && !blocks.some((block) => normalized(block.content).includes(code))) {
    blocks.push({ type: "code", content: code });
  }
  return blocks;
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
