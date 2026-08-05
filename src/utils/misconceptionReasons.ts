import type { Language, LocalizedText } from "../types";

export type MappedMisconceptionReason = {
  misconceptionId: string;
  reasons: LocalizedText[];
};

export function groupMisconceptionReasons<T>(misconceptionCount: number, reasons: T[]): T[][] {
  if (misconceptionCount <= 0) return [];
  if (misconceptionCount === 1) return [reasons];

  return Array.from({ length: misconceptionCount }, (_, index) => {
    if (index === misconceptionCount - 1) return reasons.slice(index);
    return reasons[index] ? [reasons[index]] : [];
  });
}

function uniqueVisibleReasons(reasons: LocalizedText[], language: Language) {
  const seen = new Set<string>();

  return reasons.filter((reason) => {
    const text = reason[language].trim();
    if (!text || seen.has(text)) return false;
    seen.add(text);
    return true;
  });
}

export function buildMisconceptionReasonPresentation(
  misconceptionIds: string[],
  mappedReasons: MappedMisconceptionReason[],
  generalReasons: LocalizedText[],
  language: Language,
) {
  const reasonMap = new Map<string, LocalizedText[]>();

  for (const mapping of mappedReasons) {
    reasonMap.set(
      mapping.misconceptionId,
      [...(reasonMap.get(mapping.misconceptionId) ?? []), ...mapping.reasons],
    );
  }

  const cards = [...new Set(misconceptionIds)].map((misconceptionId) => ({
    misconceptionId,
    reasons: uniqueVisibleReasons(reasonMap.get(misconceptionId) ?? [], language),
  }));
  const specificReasonTexts = new Set(
    cards.flatMap(({ reasons }) =>
      reasons.map((reason) => reason[language].trim()),
    ),
  );
  const sharedReasons = uniqueVisibleReasons(generalReasons, language).filter(
    (reason) => {
      const text = reason[language].trim();
      const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
      return !specificReasonTexts.has(text) &&
        !lines.every((line) => specificReasonTexts.has(line));
    },
  );

  return { cards, generalReasons: sharedReasons };
}
