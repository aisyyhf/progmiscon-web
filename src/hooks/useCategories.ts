import type { Category } from "../types";
import { getCategories } from "../services/categoryRepository";
import { useAsyncData } from "./useAsyncData";

export function useCategories(): { categories: Category[]; loading: boolean } {
  const { data, loading } = useAsyncData<Category[]>(getCategories, [], []);
  return { categories: data, loading };
}
