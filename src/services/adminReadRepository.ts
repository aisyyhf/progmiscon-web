import type {
  Misconception,
  Question,
  ReviewLifecycleRow,
  StudentAnswer,
} from "../types";
import { getAnswers } from "./answerRepository";
import { getMisconceptions } from "./misconceptionRepository";
import { getQuestions } from "./questionRepository";
import {
  getAdminReviewHistory,
  getAdminReviewLifecycle,
  getReviewSourceVersions,
} from "./reviewPersistenceRepository";
import {
  filterCurrentAdminReviewHistory,
  filterCurrentAdminReviewsToVisibleTargets,
  type CurrentAdminReviewHistory,
} from "../utils/adminCurrentReviews";
import { haveSameReviewSourceVersions } from "../utils/reviewSourceVersions";

export type AdminReviewReadSnapshot = {
  current: CurrentAdminReviewHistory;
  lifecycle: ReviewLifecycleRow[];
  questions: Question[];
  answers: StudentAnswer[];
  misconceptions: Misconception[];
};

export async function getAdminReviewReadSnapshot(): Promise<AdminReviewReadSnapshot> {
  let sourceVersions = await getReviewSourceVersions();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [
      history,
      lifecycle,
      questions,
      answers,
      misconceptions,
      confirmedVersions,
    ] = await Promise.all([
      getAdminReviewHistory(),
      getAdminReviewLifecycle(),
      getQuestions(),
      getAnswers(),
      getMisconceptions(),
      getReviewSourceVersions(),
    ]);

    if (haveSameReviewSourceVersions(sourceVersions, confirmedVersions)) {
      const sourceCurrent = filterCurrentAdminReviewHistory(
        history,
        sourceVersions,
        lifecycle,
      );
      return {
        current: filterCurrentAdminReviewsToVisibleTargets(
          sourceCurrent,
          questions,
          answers,
        ),
        lifecycle,
        questions,
        answers,
        misconceptions,
      };
    }

    sourceVersions = confirmedVersions;
  }

  throw new Error("Review source changed while the Admin workspace was loading.");
}
