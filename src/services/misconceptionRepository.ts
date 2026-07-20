import type { Misconception } from "../types";
import { mockMisconceptions } from "../data/mockMisconceptions";
import { usesGoogleSheets } from "../config/masterDataConfig";
import { getSheetMisconceptions } from "./masterDataRepository";

const hiddenMisconceptionIds = new Set(["mc-assign-simultaneous"]);
const visible = (misconception: Misconception): boolean => !hiddenMisconceptionIds.has(misconception.id);

export async function getMisconceptions(): Promise<Misconception[]> {
  return usesGoogleSheets() ? getSheetMisconceptions() : mockMisconceptions.filter(visible);
}

export async function getMisconceptionById(id: string): Promise<Misconception | undefined> {
  const misconceptions = await getMisconceptions();
  return misconceptions.find((misconception) => misconception.id === id);
}

export async function getMisconceptionsByCategory(categoryId: string): Promise<Misconception[]> {
  const misconceptions = await getMisconceptions();
  return misconceptions.filter((misconception) => misconception.categoryId === categoryId);
}

export async function getMisconceptionsByIds(ids: string[]): Promise<Misconception[]> {
  const idSet = new Set(ids);
  const misconceptions = await getMisconceptions();
  return misconceptions.filter((misconception) => idSet.has(misconception.id));
}
