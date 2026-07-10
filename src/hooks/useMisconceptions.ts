import type { Misconception } from "../types";
import {
  getMisconceptionById,
  getMisconceptions,
  getMisconceptionsByCategory,
  getMisconceptionsByIds,
} from "../services/misconceptionRepository";
import { useAsyncData } from "./useAsyncData";

export function useMisconceptions(): { misconceptions: Misconception[]; loading: boolean } {
  const { data, loading } = useAsyncData<Misconception[]>(getMisconceptions, [], []);
  return { misconceptions: data, loading };
}

export function useMisconceptionsByCategory(categoryId: string | undefined): {
  misconceptions: Misconception[];
  loading: boolean;
} {
  const { data, loading } = useAsyncData<Misconception[]>(
    () => (categoryId ? getMisconceptionsByCategory(categoryId) : getMisconceptions()),
    [categoryId],
    [],
  );
  return { misconceptions: data, loading };
}

export function useMisconceptionsByIds(ids: string[]): {
  misconceptions: Misconception[];
  loading: boolean;
} {
  const key = ids.join(",");
  const { data, loading } = useAsyncData<Misconception[]>(
    () => getMisconceptionsByIds(ids),
    [key],
    [],
  );
  return { misconceptions: data, loading };
}

export function useMisconception(id: string | undefined): {
  misconception: Misconception | undefined;
  loading: boolean;
} {
  const { data, loading } = useAsyncData<Misconception | undefined>(
    () => (id ? getMisconceptionById(id) : Promise.resolve(undefined)),
    [id],
    undefined,
  );
  return { misconception: data, loading };
}
