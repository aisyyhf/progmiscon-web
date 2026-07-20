import type { Category } from "../types";
import { mockCategories } from "../data/mockCategories";
import { usesGoogleSheets } from "../config/masterDataConfig";
import { getSheetCategories } from "./masterDataRepository";

export async function getCategories(): Promise<Category[]> {
  return usesGoogleSheets()
    ? getSheetCategories()
    : [...mockCategories].sort((a, b) => a.order - b.order);
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  const categories = await getCategories();
  return categories.find((category) => category.id === id);
}
