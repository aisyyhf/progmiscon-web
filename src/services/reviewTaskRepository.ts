import type { ReviewTask } from "../types";
import { mockReviewTasks } from "../data/mockReviewTasks";
import { usesGoogleSheets } from "../config/masterDataConfig";
import { getSheetReviewTasks } from "./masterDataRepository";
import { getQuestions } from "./questionRepository";
import { filterEligibleAnswerReviewTasks } from "../utils/reviewWorkspace";

export async function getReviewTasks(): Promise<ReviewTask[]> {
  const [tasks, questions] = await Promise.all([
    usesGoogleSheets()
      ? getSheetReviewTasks()
      : Promise.resolve(mockReviewTasks),
    getQuestions(),
  ]);
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );

  return filterEligibleAnswerReviewTasks(tasks, questionById);
}
