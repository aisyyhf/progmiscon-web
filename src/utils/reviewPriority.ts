import type { Misconception, ReviewTask } from "../types";

export type PriorityStatus = "conflict" | "unreviewed" | "one_reviewer" | "stable";

export function getPriorityStatus(task: ReviewTask): PriorityStatus {
  const decisions = task.reviewerDecisions;
  if (decisions.length >= 2) {
    const labels = new Set(decisions.map((decision) => decision.selectedMisconceptionId));
    const hasDisagreement = decisions.some((decision) => decision.decision === "disagree");
    if (labels.size > 1 || hasDisagreement) return "conflict";
  }
  if (decisions.length === 0) return "unreviewed";
  if (decisions.length === 1) return "one_reviewer";
  return "stable";
}

export function sortReviewTasks(tasks: ReviewTask[]): ReviewTask[] {
  const rank: Record<PriorityStatus, number> = {
    conflict: 0,
    unreviewed: 1,
    one_reviewer: 2,
    stable: 3,
  };

  return [...tasks].sort((a, b) => {
    const priority = rank[getPriorityStatus(a)] - rank[getPriorityStatus(b)];
    if (priority !== 0) return priority;
    return a.reviewerDecisions.length - b.reviewerDecisions.length;
  });
}

export function prioritizeMisconceptions(
  misconceptions: Misconception[],
  priorityIds: string[],
): Misconception[] {
  const byId = new Map(misconceptions.map((item) => [item.id, item]));
  const seen = new Set<string>();

  return priorityIds.flatMap((id) => {
    const item = byId.get(id);
    if (!item || seen.has(id)) return [];
    seen.add(id);
    return [item];
  });
}
