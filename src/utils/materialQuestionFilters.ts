import type { Question } from "../types";

export type MaterialQuestionTypeFilter = "all" | "ps" | "mp";
export type MaterialWeekFilter = "all" | "unassigned" | string;

export const DEFAULT_MATERIAL_QUESTION_FILTERS = {
  searchQuery: "",
  type: "all",
  week: "all",
} as const;

export function getMaterialQuestionType(
  type: Question["type"],
): Exclude<MaterialQuestionTypeFilter, "all"> {
  return type === "multiple_choice" ? "mp" : "ps";
}

export function getMaterialQuestionIdentifier(question: Question): string {
  return question.sourceCode?.trim() || question.id;
}

export function getMaterialWeekLabel(week: string): string {
  return `WEEK ${week.replace(/^W/i, "")}`;
}

export function getMaterialQuestionConcepts(question: Question): Question["expectedConcepts"] {
  return question.expectedConcepts;
}

export function intersectMaterialQuestionGroups(groups: Question[][]): Question[] {
  if (groups.length === 0) return [];

  const remainingGroupIds = groups.slice(1).map((group) => new Set(group.map(({ id }) => id)));
  const seenQuestionIds = new Set<string>();

  return groups[0].filter(({ id }) => {
    if (seenQuestionIds.has(id) || !remainingGroupIds.every((ids) => ids.has(id))) return false;
    seenQuestionIds.add(id);
    return true;
  });
}

function weekSortKey(week: string): [number, number, string] {
  const match = /^W(\d+)(?:-(\d+))?$/i.exec(week);
  if (!match) return [Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, week];

  const start = Number.parseInt(match[1], 10);
  return [start, match[2] ? Number.parseInt(match[2], 10) : start, week];
}

export function getMaterialWeekOptions(questions: Question[]): string[] {
  return [...new Set(questions.map((question) => question.week).filter((week): week is string => Boolean(week)))]
    .sort((left, right) => {
      const leftKey = weekSortKey(left);
      const rightKey = weekSortKey(right);
      return (
        leftKey[0] - rightKey[0] ||
        leftKey[1] - rightKey[1] ||
        leftKey[2].localeCompare(rightKey[2], undefined, { numeric: true })
      );
    });
}

export function getMaterialPaginationItems(
  currentPage: number,
  totalPages: number,
): number[] {
  if (totalPages <= 1) return totalPages === 1 ? [1] : [];

  const pairStart = Math.floor((currentPage - 1) / 2) * 2 + 1;
  const stableStart = pairStart === totalPages ? totalPages - 1 : pairStart;
  return [stableStart, stableStart + 1].filter((page) => page <= totalPages);
}

export function filterMaterialQuestions(
  questions: Question[],
  {
    searchQuery = "",
    type = "all",
    week = "all",
  }: {
    searchQuery?: string;
    type?: MaterialQuestionTypeFilter;
    week?: MaterialWeekFilter;
  } = {},
): Question[] {
  const query = searchQuery.trim().toLowerCase();
  const seenQuestionIds = new Set<string>();

  return questions.filter((question) => {
    if (seenQuestionIds.has(question.id)) return false;

    const matchesSearch =
      !query ||
      [
        question.id,
        question.number,
        question.title.id,
        question.title.en,
        question.shortDescription?.id ?? "",
        question.shortDescription?.en ?? "",
      ].some((value) => value.toLowerCase().includes(query));
    const matchesType = type === "all" || getMaterialQuestionType(question.type) === type;
    const matchesWeek =
      week === "all" ||
      (week === "unassigned" ? question.week === null : question.week === week);

    if (!matchesSearch || !matchesType || !matchesWeek) return false;
    seenQuestionIds.add(question.id);
    return true;
  });
}
