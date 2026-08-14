import type { ReviewSourceVersions } from "../types";

export function haveSameReviewSourceVersions(
  left: ReviewSourceVersions,
  right: ReviewSourceVersions,
): boolean {
  if (
    left.questions.size !== right.questions.size ||
    left.answers.size !== right.answers.size
  ) return false;

  for (const [questionId, sourceVersion] of left.questions) {
    if (right.questions.get(questionId) !== sourceVersion) return false;
  }

  for (const [answerId, source] of left.answers) {
    const rightSource = right.answers.get(answerId);
    if (
      rightSource?.questionId !== source.questionId ||
      rightSource.sourceVersion !== source.sourceVersion
    ) return false;
  }

  return true;
}
