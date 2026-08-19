import type { SimilarMisconceptionRow } from "../types/masterData";

export function buildRelatedMisconceptionMap(
  relations: readonly SimilarMisconceptionRow[],
): Map<string, Set<string>> {
  const related = new Map<string, Set<string>>();

  for (const relation of relations) {
    const status = relation.status.trim().toLowerCase();
    if (status !== "approved" && status !== "pending") continue;
    const left = relation.misconception_id.trim();
    const right = relation.similar_id.trim();
    if (!left || !right || left === right) continue;

    const leftSet = related.get(left) ?? new Set<string>();
    leftSet.add(right);
    related.set(left, leftSet);
    const rightSet = related.get(right) ?? new Set<string>();
    rightSet.add(left);
    related.set(right, rightSet);
  }

  return related;
}
