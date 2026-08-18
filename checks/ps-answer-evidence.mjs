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
  { id: "PS-1", questionId: "Q-PS", studentId: "student-1", answerRole: "evidence" },
  { id: "MP-1", questionId: "Q-MP", studentId: "student-2", answerRole: "mp_option" },
  { id: "PS-2", questionId: "Q-PS", studentId: "student-3", answerRole: "evidence" },
  { id: "PS-NON-EVIDENCE", questionId: "Q-PS", studentId: "student-5", answerRole: "ps_reference" },
  { id: "OTHER", questionId: "Q-OTHER", studentId: "student-4", answerRole: "evidence" },
];

assert.equal(getAnswerWorkspaceForQuestion(psQuestion), "answer-ps");
assert.equal(getAnswerWorkspaceForQuestion(mpQuestion), "answer-mp");
assert.deepEqual(
  getAnswersForQuestion("Q-PS", answers).map(({ id }) => id),
  ["PS-1", "PS-2", "PS-NON-EVIDENCE"],
  "answer lookup must stay scoped to its selected question",
);
assert.deepEqual(getAnswersForQuestion("Q-EMPTY", answers), []);

const { items, questionById } = classifyReviewItems(questions, answers);
assert.deepEqual(items["answer-ps"].map(({ id }) => id), ["PS-1", "PS-2"]);
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
const structuredEvidence = await readFile(
  new URL(
    "../src/components/review/StructuredEvidenceList.tsx",
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
assert.match(evidence, /Identitas mahasiswa belum tersedia/);
assert.match(evidence, /Student identity unavailable/);
assert.match(evidence, /resolveEvidenceIdentity/);
assert.doesNotMatch(evidence, /studentId\.startsWith|anonymous-/);
assert.match(evidence, /Belum ada evidence jawaban untuk soal ini/);
assert.match(evidence, /<ParentQuestionBackAction/);
assert.match(evidence, /<SiblingNavigator/);
assert.match(evidence, /kind="evidence"/);
assert.match(evidence, /answers\[activeIndex - 1\]\.id/);
assert.match(evidence, /answers\[activeIndex \+ 1\]\.id/);
assert.match(evidence, /<QuestionContextAccordion/);
assert.match(evidence, /<QuestionContent question=\{question\}/);
assert.match(evidence, /<StructuredEvidenceList/);
assert.match(structuredEvidence, /Nama siswa/);
assert.match(structuredEvidence, /Jawaban siswa/);
assert.match(structuredEvidence, /Miskonsepsi/);
assert.match(structuredEvidence, /Penjelasan/);
assert.doesNotMatch(evidence, /Evidence provenance|<MisconceptionReasonCards/);
assert.doesNotMatch(evidence, /<select|Source key|Kunci sumber/);
assert.doesNotMatch(evidence, /Form validasi jawaban|Save Review|Submit Review/);

const guardIndex = persistence.indexOf(
  "assertAnswerReviewEligible(await getQuestionById(questionId))",
);
const writeIndex = persistence.indexOf(
  'supabase.rpc("save_answer_review_v3"',
  guardIndex,
);
assert.ok(guardIndex >= 0 && writeIndex > guardIndex);
assert.doesNotMatch(
  persistence,
  /from\("answer_reviews"\)[\s\S]{0,200}\.(?:insert|update|upsert|delete)\(/,
  "Answer review writes must remain behind Review v3 RPCs",
);

console.log("PS answer evidence self-check passed.");
