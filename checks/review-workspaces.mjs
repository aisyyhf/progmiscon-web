import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  DEFAULT_REVIEW_WORKSPACE,
  assertAnswerReviewEligible,
  classifyReviewItems,
  filterEligibleAnswerReviewCounts,
  filterEligibleAnswerReviewIds,
  filterEligibleAnswerReviewTasks,
  getActionableAnswerReviewSequence,
  getNextUnreviewedAnswerId,
  getReviewProgress,
  isAnswerReviewEligible,
  resolveAnswerSelection,
  selectWorkspaceItemId,
  stripSelectedOptionPrefix,
} from "../src/utils/reviewWorkspace.ts";
import {
  shouldWarnForMpAnswerNavigation,
  shouldWarnForMpQuestionNavigation,
} from "../src/utils/mpQuestionNavigator.ts";

const questions = [
  { id: "Q-PS-1", type: "short_answer" },
  {
    id: "Q-MP-1",
    type: "multiple_choice",
    options: [
      { id: "A", label: "A", text: { id: "8", en: "8" }, isCorrect: true },
      { id: "B", label: "B", text: { id: "9", en: "9" }, isCorrect: false },
    ],
  },
  { id: "Q-PS-2", type: "short_answer" },
];
const answers = [
  { id: "A-PS-1", questionId: "Q-PS-1" },
  {
    id: "A-MP-1",
    questionId: "Q-MP-1",
    selectedOptionId: "B",
    answerText: "9",
  },
  {
    id: "A-MP-MISSING",
    questionId: "Q-MP-1",
    selectedOptionId: "missing",
    answerText: "Fallback",
  },
  { id: "A-ORPHAN", questionId: "missing" },
];

const { items } = classifyReviewItems(questions, answers);
const questionById = new Map(questions.map((question) => [question.id, question]));

assert.deepEqual(items["question-ps"].map(({ id }) => id), ["Q-PS-1", "Q-PS-2"]);
assert.deepEqual(items["question-mp"].map(({ id }) => id), ["Q-MP-1"]);
assert.deepEqual(items["answer-ps"].map(({ id }) => id), ["A-PS-1"]);
assert.deepEqual(
  items["answer-mp"].map(({ id }) => id),
  ["A-MP-1", "A-MP-MISSING"],
);

const questionIds = [
  ...items["question-ps"],
  ...items["question-mp"],
].map(({ id }) => id);
const answerIds = [...items["answer-ps"], ...items["answer-mp"]].map(
  ({ id }) => id,
);
assert.equal(new Set(questionIds).size, questionIds.length);
assert.equal(new Set(answerIds).size, answerIds.length);
assert.equal(questionIds.length, questions.length);
assert.equal(answerIds.length, answers.length - 1);

const selected = resolveAnswerSelection(questions[1], answers[1]);
assert.equal(selected.option?.id, "B");
assert.equal(selected.missingSelectedOption, false);

const missing = resolveAnswerSelection(questions[1], answers[2]);
assert.equal(missing.option, undefined);
assert.equal(missing.fallbackText, "Fallback");
assert.equal(missing.missingSelectedOption, true);
assert.equal(stripSelectedOptionPrefix("A. input(10)", "A"), "input(10)");
assert.equal(stripSelectedOptionPrefix("B) input(-3)", "B"), "input(-3)");
assert.equal(
  stripSelectedOptionPrefix("A variable", "A"),
  "A variable",
  "only a matching leading option prefix may be removed",
);

assert.deepEqual(getReviewProgress(items["question-ps"], ["Q-PS-1"]), {
  reviewed: 1,
  total: 2,
});
assert.deepEqual(getReviewProgress(items["question-mp"], ["Q-PS-1"]), {
  reviewed: 0,
  total: 1,
});
const eligibleAnswerIds = filterEligibleAnswerReviewIds(
  ["A-PS-1", "A-MP-1"],
  answers,
  questionById,
);
assert.deepEqual(eligibleAnswerIds, ["A-MP-1"]);
assert.deepEqual(
  filterEligibleAnswerReviewCounts(
    new Map([
      ["A-PS-1", 3],
      ["A-MP-1", 2],
    ]),
    answers,
    questionById,
  ),
  new Map([["A-MP-1", 2]]),
);
assert.deepEqual(getReviewProgress(items["answer-mp"], ["A-MP-1"]), {
  reviewed: 1,
  total: 2,
});

const sequenceAnswers = [
  { id: "A-1", questionId: "Q-MP-1", sourceVersion: "v1" },
  { id: "A-OTHER", questionId: "Q-MP-OTHER", sourceVersion: "v1" },
  { id: "A-2", questionId: "Q-MP-1", sourceVersion: "v1" },
  { id: "A-3", questionId: "Q-MP-1", sourceVersion: "v1" },
  { id: "A-3", questionId: "Q-MP-1", sourceVersion: "v1" },
  { id: "A-STALE", questionId: "Q-MP-1" },
];
const actionableSequence = getActionableAnswerReviewSequence(
  questions[1],
  sequenceAnswers,
  ["A-2"],
  new Map([
    ["A-1", 1],
    ["A-2", 3],
    ["A-3", 3],
  ]),
  3,
);
assert.deepEqual(
  actionableSequence.map(({ id }) => id),
  ["A-1", "A-2"],
  "the MP sequence keeps owned reviews, skips capped foreign reviews, stale rows, and duplicates",
);
assert.equal(getNextUnreviewedAnswerId(actionableSequence, ["A-2"]), "A-1");
assert.equal(
  getNextUnreviewedAnswerId(actionableSequence, ["A-1", "A-2"], "A-1"),
  undefined,
);
const fullSequence = getActionableAnswerReviewSequence(
  questions[1],
  sequenceAnswers.filter(({ id }) => ["A-1", "A-2", "A-3"].includes(id)),
  [],
  new Map(),
  3,
);
assert.equal(getNextUnreviewedAnswerId(fullSequence, ["A-1"], "A-1"), "A-2");
assert.equal(
  getNextUnreviewedAnswerId(fullSequence, ["A-1", "A-2"], "A-2"),
  "A-3",
);
assert.equal(
  getNextUnreviewedAnswerId(fullSequence, ["A-1", "A-2", "A-3"], "A-3"),
  undefined,
  "confirmed saves terminate the sequence without looping",
);
const noRemainingSequence = getActionableAnswerReviewSequence(
  questions[1],
  sequenceAnswers,
  ["A-2"],
  new Map([
    ["A-1", 3],
    ["A-2", 3],
    ["A-3", 3],
  ]),
  3,
);
assert.equal(
  getNextUnreviewedAnswerId(noRemainingSequence, ["A-2"]),
  undefined,
  "zero remaining actionable MP answers completes the workflow",
);
assert.deepEqual(
  getActionableAnswerReviewSequence(
    questions[0],
    sequenceAnswers,
    [],
    new Map(),
    3,
  ),
  [],
  "PS answers remain evidence-only",
);

assert.equal(isAnswerReviewEligible(questions[0]), false);
assert.equal(isAnswerReviewEligible(questions[1]), true);
assert.throws(
  () => assertAnswerReviewEligible(questions[0]),
  /evidence.*tidak dapat direview/i,
);
assert.doesNotThrow(() => assertAnswerReviewEligible(questions[1]));
assert.deepEqual(
  filterEligibleAnswerReviewTasks(
    [
      { id: "T-PS", questionId: "Q-PS-1" },
      { id: "T-MP", questionId: "Q-MP-1" },
    ],
    questionById,
  ).map(({ id }) => id),
  ["T-MP"],
);

assert.equal(DEFAULT_REVIEW_WORKSPACE, "question-ps");
assert.equal(
  selectWorkspaceItemId(items["answer-mp"], ["A-MP-1"]),
  "A-MP-MISSING",
);
assert.equal(
  selectWorkspaceItemId(items["answer-mp"], ["A-MP-1", "A-MP-MISSING"]),
  "A-MP-1",
);

assert.equal(
  shouldWarnForMpQuestionNavigation(
    true,
    "question-mp",
    "Q-MP-1",
    "answer-mp",
    "A-MP-1",
  ),
  true,
);
assert.equal(
  shouldWarnForMpAnswerNavigation(
    true,
    "answer-mp",
    "A-MP-1",
    "answer-mp",
    "A-MP-MISSING",
  ),
  true,
);
assert.equal(
  shouldWarnForMpAnswerNavigation(
    true,
    "answer-mp",
    "A-MP-1",
    "answer-mp",
    "A-MP-1",
  ),
  false,
);

const page = await readFile(
  new URL("../src/pages/LecturerReviewPage.tsx", import.meta.url),
  "utf8",
);
const editor = await readFile(
  new URL("../src/components/review/AdminContentEditor.tsx", import.meta.url),
  "utf8",
);
const reasonCards = await readFile(
  new URL(
    "../src/components/review/MisconceptionReasonCards.tsx",
    import.meta.url,
  ),
  "utf8",
);
const navigation = await readFile(
  new URL(
    "../src/components/review/AnswerWorkspaceNavigation.tsx",
    import.meta.url,
  ),
  "utf8",
);
const answerWorkspace = page.slice(
  page.indexOf("function AnswerValidationWorkspace"),
);
const questionWorkspace = page.slice(
  page.indexOf("function QuestionValidationWorkspace"),
  page.indexOf("function AnswerValidationWorkspace"),
);
const contextStart = answerWorkspace.indexOf("<QuestionContextAccordion");
const contextEnd = answerWorkspace.indexOf(
  "</QuestionContextAccordion>",
  contextStart,
);
const contextAccordion = answerWorkspace.slice(contextStart, contextEnd);

assert.match(
  page,
  /`\$\{progress\.reviewed\} dari \$\{progress\.total\} jawaban sudah Anda review`/,
  "MP toolbar progress must use the global eligible-answer progress source",
);
assert.match(page, /siblingAnswerIds=\{\(activeItems as StudentAnswer\[\]\)\.map/);
assert.doesNotMatch(page, /answerReviewCount=/);
assert.match(page, /onDirtyChange=\{setMpAnswerReviewDirty\}/);
assert.match(page, /requestOpenWorkspaceItem\(\s*"answer-mp"/);
assert.match(
  page,
  /onBackToQuestion=\{\(\) =>\s*requestOpenWorkspaceItem\([\s\S]{0,180}answerQuestion\.id/,
);
assert.match(contextAccordion, /question\.options\.map/);
assert.match(contextAccordion, /<QuestionContent question=\{question\}/);
assert.match(contextAccordion, /option\.isCorrect/);
assert.match(contextAccordion, /Jawaban benar/);
assert.match(contextAccordion, /Sedang direview/);
assert.doesNotMatch(answerWorkspace, /AdminAnswerContentEditor|Edit jawaban/);
assert.doesNotMatch(answerWorkspace, /AdminQuestionContentEditor|Edit soal/);
assert.doesNotMatch(questionWorkspace, /AdminQuestionContentEditor|Edit soal/);
assert.match(answerWorkspace, /generalReasons=\{answer\.explanation/);
assert.match(answerWorkspace, /mappedReasons=\{mappedReasons\}/);
assert.doesNotMatch(
  answerWorkspace,
  /Nilai label berdasarkan pola yang terlihat|Evaluate labels based on the pattern visible/,
);
assert.match(
  answerWorkspace,
  /Apakah ada miskonsepsi terkait yang tidak sesuai dengan jawaban ini\?/,
);
assert.match(
  answerWorkspace,
  /Are any linked misconceptions inconsistent with this answer\?/,
);
assert.doesNotMatch(answerWorkspace, /Belum Anda review|Not yet reviewed/);
assert.doesNotMatch(answerWorkspace, /reviewerCountLabel|<Users size=\{14\}/);
assert.match(answerWorkspace, /REVIEW JAWABAN/);
assert.match(answerWorkspace, /Jawaban yang sedang direview/);
assert.match(answerWorkspace, /Lihat soal & pilihan jawaban/);
assert.match(answerWorkspace, /Lihat evidence/);
assert.ok(
  answerWorkspace.indexOf("<ParentQuestionBackAction") <
    answerWorkspace.indexOf("<SiblingNavigator") &&
    answerWorkspace.indexOf("<SiblingNavigator") <
      answerWorkspace.indexOf("<header"),
  "MP back and sibling navigation must share the utility row above the answer header",
);
assert.match(questionWorkspace, /REVIEW MISKONSEPSI SOAL/);
assert.match(questionWorkspace, /QUESTION MISCONCEPTION REVIEW/);
assert.match(answerWorkspace, /REVIEW MISKONSEPSI JAWABAN/);
assert.match(answerWorkspace, /ANSWER MISCONCEPTION REVIEW/);
assert.doesNotMatch(
  page,
  /Jawab kedua pertanyaan dan lengkapi pilihan serta alasan jika memilih Ada\.|Answer both questions and complete the selection and reason when choosing Yes\./,
);
assert.match(editor, />\s*Edit soal\s*</);
assert.match(editor, /saveAnswerContentOverride\(answer\.id, answerText\)/);
assert.doesNotMatch(editor, />\s*Edit jawaban\s*</);
assert.match(reasonCards, /mappedReasons = \[\]/);
assert.match(reasonCards, /presentation\.cards\.map/);
assert.match(reasonCards, /Alasan belum tersedia/);
assert.match(reasonCards, /Reason not yet available/);
assert.match(reasonCards, /Catatan umum jawaban/);
assert.match(reasonCards, /General answer note/);
assert.doesNotMatch(
  reasonCards,
  /menunjukkan pola yang cocok|shows a pattern that matches/,
  "Misconception cards must not fabricate reasons",
);
assert.match(navigation, /aria-expanded=\{open\}/);
assert.match(navigation, /aria-controls=\{id\}/);
assert.match(navigation, /useState\(false\)/);
assert.match(navigation, /type="button"/);
assert.match(navigation, /<CircleHelp/);
assert.match(navigation, /open && "rotate-180"/);
assert.match(navigation, /disabled=\{index <= 0\}/);
assert.match(navigation, /disabled=\{index < 0 \|\| index >= total - 1\}/);

console.log("Review workspace self-check passed.");
