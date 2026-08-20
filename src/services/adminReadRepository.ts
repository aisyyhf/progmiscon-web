import type { Misconception, Question, StudentAnswer } from "../types";
import { getAnswers } from "./answerRepository";
import { getMisconceptions } from "./misconceptionRepository";
import { getQuestions } from "./questionRepository";
import {
  getAdminReviewHistory,
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
  questions: Question[];
  answers: StudentAnswer[];
  misconceptions: Misconception[];
};

export async function getAdminReviewReadSnapshot(): Promise<AdminReviewReadSnapshot> {
  let sourceVersions = await getReviewSourceVersions();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const [history, questions, answers, misconceptions, confirmedVersions] =
      await Promise.all([
        getAdminReviewHistory(),
        getQuestions(),
        getAnswers(),
        getMisconceptions(),
        getReviewSourceVersions(),
      ]);

    if (haveSameReviewSourceVersions(sourceVersions, confirmedVersions)) {
      const sourceCurrent = filterCurrentAdminReviewHistory(
        history,
        sourceVersions,
      );
      return {
        current: filterCurrentAdminReviewsToVisibleTargets(
          sourceCurrent,
          questions,
          answers,
        ),
        questions,
        answers,
        misconceptions,
      };
    }

    sourceVersions = confirmedVersions;
  }

  throw new Error("Review source changed while the Admin workspace was loading.");
}
