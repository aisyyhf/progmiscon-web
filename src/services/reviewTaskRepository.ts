import type { ReviewTask } from "../types";
import { mockReviewTasks } from "../data/mockReviewTasks";
import { usesGoogleSheets } from "../config/masterDataConfig";
import { getSheetReviewTasks } from "./masterDataRepository";

export async function getReviewTasks(): Promise<ReviewTask[]> {
  if (usesGoogleSheets()) {
    return getSheetReviewTasks();
  }

  return mockReviewTasks;
}
