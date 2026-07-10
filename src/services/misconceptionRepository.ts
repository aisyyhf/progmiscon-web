import type { Misconception } from "../types";
import { mockMisconceptions } from "../data/mockMisconceptions";

const hiddenMisconceptionIds = new Set(["mc-assign-simultaneous"]);

function visible(misconception: Misconception): boolean {
  return !hiddenMisconceptionIds.has(misconception.id);
}

export async function getMisconceptions(): Promise<Misconception[]> {
  return mockMisconceptions.filter(visible);
}

export async function getMisconceptionById(id: string): Promise<Misconception | undefined> {
  return mockMisconceptions.find((misconception) => misconception.id === id && visible(misconception));
}

export async function getMisconceptionsByCategory(categoryId: string): Promise<Misconception[]> {
  return mockMisconceptions.filter(
    (misconception) => misconception.categoryId === categoryId && visible(misconception),
  );
}

export async function getMisconceptionsByIds(ids: string[]): Promise<Misconception[]> {
  const idSet = new Set(ids);
  return mockMisconceptions.filter((misconception) => idSet.has(misconception.id) && visible(misconception));
}
