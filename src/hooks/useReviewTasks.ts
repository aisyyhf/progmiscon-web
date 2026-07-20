import type { ReviewTask } from "../types";
import { getReviewTasks } from "../services/reviewTaskRepository";
import { useAsyncData } from "./useAsyncData";

export function useReviewTasks(): {
  tasks: ReviewTask[];
  loading: boolean;
} {
  const { data, loading } = useAsyncData<ReviewTask[]>(getReviewTasks, [], []);
  return { tasks: data, loading };
}
