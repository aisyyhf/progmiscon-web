import type { Category } from "../types";
import { mockCategories } from "../data/mockCategories";

export async function getCategories(): Promise<Category[]> {
  return [...mockCategories].sort((a, b) => a.order - b.order);
}

export async function getCategoryById(id: string): Promise<Category | undefined> {
  return mockCategories.find((category) => category.id === id);
}
