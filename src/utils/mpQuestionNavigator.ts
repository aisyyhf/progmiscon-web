import type { ReviewWorkspace } from "./reviewWorkspace.ts";

export function shouldWarnForMpQuestionNavigation(
  dirty: boolean,
  currentWorkspace: ReviewWorkspace,
  currentQuestionId: string | undefined,
  nextWorkspace: ReviewWorkspace,
  nextQuestionId: string | undefined,
): boolean {
  return (
    dirty &&
    currentWorkspace === "question-mp" &&
    (nextWorkspace !== currentWorkspace || nextQuestionId !== currentQuestionId)
  );
}
