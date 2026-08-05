import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  filterAdminReviewConsensusItems,
  getAnswerWorkspaceForQuestion,
} from "../src/utils/reviewWorkspace.ts";
import {
  getAnswersForQuestion,
  normalizeReviewSessionState,
} from "../src/utils/reviewLinking.ts";
import { classifyReviewItems } from "../src/utils/reviewWorkspace.ts";

const psQuestion = { id: "Q-PS", type: "short_answer", number: "1" };
const emptyPsQuestion = { id: "Q-EMPTY", type: "short_answer", number: "2" };
const mpQuestion = { id: "Q-MP", type: "multiple_choice", number: "3" };
const questions = [psQuestion, emptyPsQuestion, mpQuestion];
const answers = [
  { id: "PS-1", questionId: "Q-PS", studentId: "student-1" },
  { id: "MP-1", questionId: "Q-MP", studentId: "student-2" },
  { id: "PS-2", questionId: "Q-PS", studentId: "student-3" },
  { id: "OTHER", questionId: "Q-OTHER", studentId: "student-4" },
];

assert.equal(getAnswerWorkspaceForQuestion(psQuestion), "answer-ps");
assert.equal(getAnswerWorkspaceForQuestion(mpQuestion), "answer-mp");
assert.deepEqual(
  getAnswersForQuestion("Q-PS", answers).map(({ id }) => id),
  ["PS-1", "PS-2"],
  "PS evidence must stay scoped to its selected question",
);
assert.deepEqual(getAnswersForQuestion("Q-EMPTY", answers), []);

const { items, questionById } = classifyReviewItems(questions, answers);
const switchedQuestion = normalizeReviewSessionState(
  {
    workspace: "question-ps",
    activeItemIds: {
      "question-ps": "Q-EMPTY",
      "answer-ps": "PS-2",
    },
    activeParentQuestionIds: { ps: "Q-PS" },
  },
  items,
  questionById,
  [],
  [],
);
assert.equal(switchedQuestion.activeParentQuestionIds.ps, "Q-EMPTY");
assert.equal(switchedQuestion.activeItemIds["answer-ps"], undefined);

const consensus = filterAdminReviewConsensusItems(
  [
    { targetType: "question", targetId: "Q-PS", questionId: "Q-PS" },
    { targetType: "answer", targetId: "PS-1", questionId: "Q-PS" },
    { targetType: "answer", targetId: "MP-1", questionId: "Q-MP" },
  ],
  questionById,
);
assert.deepEqual(
  consensus.map(({ targetId }) => targetId),
  ["Q-PS", "MP-1"],
  "PS question finalization must remain while PS answer consensus is excluded",
);

const app = await readFile(new URL("../src/app/App.tsx", import.meta.url), "utf8");
const page = await readFile(
  new URL("../src/pages/LecturerReviewPage.tsx", import.meta.url),
  "utf8",
);
const evidence = await readFile(
  new URL(
    "../src/components/review/PsAnswerEvidenceWorkspace.tsx",
    import.meta.url,
  ),
  "utf8",
);
const persistence = await readFile(
  new URL("../src/services/reviewPersistenceRepository.ts", import.meta.url),
  "utf8",
);

assert.match(app, /path="\/review\/answer\/:answerId"/);
assert.match(page, /getAnswerWorkspaceForQuestion\(question\)/);
assert.match(page, /<PsAnswerEvidenceWorkspace/);
assert.match(
  page,
  /onBackToQuestion=\{\(\) =>\s*openWorkspaceItem\("question-ps", activeParentQuestion\.id\)/,
);
assert.match(page, /<QuestionValidationWorkspace/);
assert.match(page, /<AnswerValidationWorkspace/);
assert.match(page, /await saveAnswerReview\(/);
assert.match(evidence, /Evidence Jawaban PS/);
assert.match(evidence, /Nama mahasiswa belum tersedia/);
assert.match(evidence, /Belum ada evidence jawaban untuk soal ini/);
assert.match(evidence, /<ParentQuestionBackAction/);
assert.match(evidence, /<SiblingNavigator/);
assert.match(evidence, /kind="evidence"/);
assert.match(evidence, /answers\[activeIndex - 1\]\.id/);
assert.match(evidence, /answers\[activeIndex \+ 1\]\.id/);
assert.match(evidence, /<QuestionContextAccordion/);
assert.match(evidence, /t\(question\.prompt, language\)/);
assert.match(evidence, /getQuestionReference\(question\)/);
assert.match(evidence, /<MisconceptionReasonCards/);
assert.doesNotMatch(evidence, /<select|Metadata evidence|Source key|Kunci sumber/);
assert.doesNotMatch(evidence, /Form validasi jawaban|Save Review|Submit Review/);

const guardIndex = persistence.indexOf(
  "assertAnswerReviewEligible(await getQuestionById(questionId))",
);
const writeIndex = persistence.indexOf('.from("answer_reviews")', guardIndex);
assert.ok(guardIndex >= 0 && writeIndex > guardIndex);
assert.doesNotMatch(
  persistence,
  /from\("answer_reviews"\)[\s\S]{0,160}\.delete\(/,
  "Historical answer review rows must not be deleted",
);

console.log("PS answer evidence self-check passed.");
