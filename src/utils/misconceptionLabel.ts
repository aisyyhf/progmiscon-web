import type { Language, Misconception } from "../types";

export function misconceptionLabel(misconception: Misconception, language: Language): string {
  return `${misconception.id} — ${misconception.title[language]}`;
}

export function matchesMisconceptionSearch(misconception: Misconception, query: string): boolean {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) return true;
  return [misconception.id, misconception.title.id, misconception.title.en].some((value) =>
    value.toLocaleLowerCase().includes(keyword),
  );
}
