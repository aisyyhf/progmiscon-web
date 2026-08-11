import type { Language, Misconception } from "../types";

export function misconceptionLabel(misconception: Misconception, language: Language): string {
  const title = misconception.title[language].trim();
  const suffix = title.slice(misconception.id.length);
  const alreadyPrefixed =
    title.toLocaleLowerCase().startsWith(misconception.id.toLocaleLowerCase()) &&
    (suffix.length === 0 || /^[\s:\u2013\u2014-]/.test(suffix));

  return alreadyPrefixed
    ? title.replace(/[\u2013\u2014]/g, "-")
    : `${misconception.id} - ${title}`;
}

export function matchesMisconceptionSearch(misconception: Misconception, query: string): boolean {
  const keyword = query.trim().toLocaleLowerCase();
  if (!keyword) return true;
  return [misconception.id, misconception.title.id, misconception.title.en].some((value) =>
    value.toLocaleLowerCase().includes(keyword),
  );
}
