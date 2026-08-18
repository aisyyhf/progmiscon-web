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
  getCanonicalMpAnswerSequence,
  getCompositeReviewedQuestionIds,
  getNextUnreviewedAnswerId,
  getReachableAnswerReviewSequence,
  getReviewProgress,
  isAnswerReviewEligible,
  isCompositeQuestionReviewComplete,
  resolveAnswerSelection,
  selectWorkspaceItemId,
  stripSelectedOptionPrefix,
} from "../src/utils/reviewWorkspace.ts";
import {
  shouldWarnForMpAnswerNavigation,
  shouldWarnForMpQuestionNavigation,
} from "../src/utils/mpQuestionNavigator.ts";
import {
  getMisconceptionReviewFormErrors,
  initialMisconceptionReviewFormState,
} from "../src/utils/reviewMisconceptionForm.ts";

assert.deepEqual(
  getMisconceptionReviewFormErrors(initialMisconceptionReviewFormState),
  { removal: "choice", addition: "choice" },
);
const selectedReviewState = {
  ...initialMisconceptionReviewFormState,
  removalChoice: false,
  additionChoice: true,
};
assert.deepEqual(getMisconceptionReviewFormErrors(selectedReviewState), {
  addition: "selection",
});
assert.deepEqual(
  getMisconceptionReviewFormErrors({
    ...selectedReviewState,
    additionalMisconceptionIds: ["M-1"],
  }),
  { addition: "reason" },
);
assert.deepEqual(
  getMisconceptionReviewFormErrors({
    ...selectedReviewState,
    additionalMisconceptionIds: ["M-1"],
    additionReason: "Relevant reason",
  }),
  {},
  "a field error clears as soon as its existing business rule is satisfied",
);

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
  { id: "A-PS-1", questionId: "Q-PS-1", answerRole: "evidence" },
  {
    id: "A-MP-1",
    questionId: "Q-MP-1",
    answerRole: "mp_option",
    selectedOptionId: "B",
    answerText: "9",
  },
  {
    id: "A-MP-MISSING",
    questionId: "Q-MP-1",
    answerRole: "mp_option",
    selectedOptionId: "missing",
    answerText: "Fallback",
  },
  { id: "A-ORPHAN", questionId: "missing", answerRole: "evidence" },
];

const shuffledMpOptions = [
  { id: "OPT-C", questionId: "Q-MP-1", answerRole: "mp_option", optionLabel: "C", order: 3, sourceVersion: "v1" },
  { id: "EVIDENCE", questionId: "Q-MP-1", answerRole: "evidence", optionLabel: null, order: 1, sourceVersion: "v1" },
  { id: "OPT-A", questionId: "Q-MP-1", answerRole: "mp_option", optionLabel: "A", order: 1, sourceVersion: "v1" },
  { id: "REFERENCE", questionId: "Q-MP-1", answerRole: "ps_reference", optionLabel: null, order: 2, sourceVersion: "v1" },
  { id: "OPT-D", questionId: "Q-MP-1", answerRole: "mp_option", optionLabel: "D", order: 4, sourceVersion: "v1" },
  { id: "OPT-B", questionId: "Q-MP-1", answerRole: "mp_option", optionLabel: "B", order: 2, sourceVersion: "v1" },
  { id: "OTHER-A", questionId: "Q-MP-OTHER", answerRole: "mp_option", optionLabel: "A", order: 1, sourceVersion: "v1" },
];
const canonicalMpOptions = getCanonicalMpAnswerSequence(
  "Q-MP-1",
  shuffledMpOptions,
);
assert.deepEqual(
  canonicalMpOptions.map(({ optionLabel }) => optionLabel),
  ["A", "B", "C", "D"],
  "physical/task order and non-option rows must not affect canonical MP order",
);
assert.deepEqual(
  getActionableAnswerReviewSequence(
    questions[1],
    shuffledMpOptions,
    [],
    new Map(),
    3,
  ).map(({ optionLabel }) => optionLabel),
  ["A", "B", "C", "D"],
  "the actionable Review Jawaban sequence uses canonical MP order",
);
assert.deepEqual(
  getCanonicalMpAnswerSequence(
    "Q-MP-1",
    shuffledMpOptions.map((answer) =>
      answer.answerRole === "mp_option" && answer.questionId === "Q-MP-1"
        ? { ...answer, order: answer.optionLabel === "B" ? 1 : null }
        : answer,
    ),
  ).map(({ optionLabel }) => optionLabel),
  ["A", "B", "C", "D"],
  "missing, invalid, or tied order values fall back to semantic option labels",
);
for (const [label, position, previous, next] of [
  ["A", 1, undefined, "B"],
  ["B", 2, "A", "C"],
  ["C", 3, "B", "D"],
]) {
  const index = canonicalMpOptions.findIndex((answer) => answer.optionLabel === label);
  assert.equal(index + 1, position);
  assert.equal(canonicalMpOptions[index - 1]?.optionLabel, previous);
  assert.equal(canonicalMpOptions[index + 1]?.optionLabel, next);
}
assert.equal(
  getNextUnreviewedAnswerId(canonicalMpOptions, ["OPT-A", "OPT-B"]),
  "OPT-C",
  "partial MP progression resumes at the first unfinished canonical option",
);
assert.deepEqual(
  getReachableAnswerReviewSequence(
    canonicalMpOptions,
    ["OPT-A", "OPT-B"],
    "OPT-C",
  ).map(({ optionLabel }) => optionLabel),
  ["A", "B", "C"],
  "reachability is applied after canonical ordering",
);

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
  { id: "A-1", questionId: "Q-MP-1", sourceVersion: "v1", answerRole: "mp_option" },
  { id: "A-OTHER", questionId: "Q-MP-OTHER", sourceVersion: "v1", answerRole: "mp_option" },
  { id: "A-2", questionId: "Q-MP-1", sourceVersion: "v1", answerRole: "mp_option" },
  { id: "A-3", questionId: "Q-MP-1", sourceVersion: "v1", answerRole: "mp_option" },
  { id: "A-3", questionId: "Q-MP-1", sourceVersion: "v1", answerRole: "mp_option" },
  { id: "A-STALE", questionId: "Q-MP-1", answerRole: "mp_option" },
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
const partialMpSequence = ["A", "B", "C", "D"].map((id) => ({ id }));
assert.equal(
  getNextUnreviewedAnswerId(partialMpSequence, ["A", "B"]),
  "C",
  "resuming a partial MP review starts at the first unfinished answer",
);
assert.equal(
  getNextUnreviewedAnswerId(partialMpSequence, ["A", "B", "C"], "C"),
  "D",
  "the resumed MP sequence continues from C to D",
);
assert.deepEqual(
  getReachableAnswerReviewSequence(fullSequence, ["A-1", "A-2"]).map(
    ({ id }) => id,
  ),
  ["A-1", "A-2"],
  "persisted A and B remain reachable after navigating back while untouched C stays hidden",
);
assert.deepEqual(
  getReachableAnswerReviewSequence(fullSequence, ["A-1"], "A-2").map(
    ({ id }) => id,
  ),
  ["A-1", "A-2"],
  "the current unfinished B remains reachable from A",
);
assert.deepEqual(
  getReachableAnswerReviewSequence(fullSequence, ["A-1"], "A-3").map(
    ({ id }) => id,
  ),
  ["A-1"],
  "an active target cannot skip the earlier untouched B",
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

assert.equal(
  isCompositeQuestionReviewComplete(
    questions[0],
    sequenceAnswers,
    ["Q-PS-1"],
    [],
    new Map(),
    3,
  ),
  true,
  "a saved PS question review completes its row without answer steps",
);
assert.equal(
  isCompositeQuestionReviewComplete(
    questions[1],
    sequenceAnswers,
    ["Q-MP-1"],
    [],
    new Map(),
    3,
  ),
  false,
  "an MP question-only save remains incomplete",
);
assert.equal(
  isCompositeQuestionReviewComplete(
    questions[1],
    sequenceAnswers,
    ["Q-MP-1"],
    ["A-1"],
    new Map([
      ["A-2", 3],
      ["A-3", 3],
    ]),
    3,
  ),
  true,
  "owned current reviews and cap-full answers both satisfy MP answer steps",
);
assert.deepEqual(
  getCompositeReviewedQuestionIds(
    questions,
    sequenceAnswers,
    ["Q-PS-1", "Q-MP-1"],
    ["A-1", "A-2", "A-3"],
    new Map(),
    3,
  ),
  ["Q-PS-1", "Q-MP-1"],
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
      { id: "T-PS", questionId: "Q-PS-1", answerRole: "evidence" },
      { id: "T-MP", questionId: "Q-MP-1", answerRole: "mp_option" },
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
const structuredEvidence = await readFile(
  new URL(
    "../src/components/review/StructuredEvidenceList.tsx",
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
const stepNavigation = page.slice(
  page.indexOf("function ReviewStepNavigation"),
  page.indexOf("function reviewValidationMessage"),
);

assert.match(
  page,
  /`\$\{progress\.reviewed\} dari \$\{progress\.total\} jawaban sudah Anda review`/,
  "MP toolbar progress must use the global eligible-answer progress source",
);
assert.match(page, /optionAnswers=\{getMpOptionAnswersForQuestion\(answerQuestion\.id, answers\)\}/);
assert.doesNotMatch(page, /siblingAnswerIds=|activeIndex=\{/);
assert.doesNotMatch(page, /answerReviewCount=/);
assert.match(page, /onDirtyChange=\{setMpAnswerReviewDirty\}/);
assert.match(
  page,
  /previousStep=\{\{[\s\S]{0,180}Kembali ke soal[\s\S]{0,220}requestOpenWorkspaceItem\([\s\S]{0,180}answerQuestion\.id/,
);
assert.match(page, /function ReviewStepNavigation/);
assert.match(
  stepNavigation,
  /min-h-9[\s\S]*?border border-border bg-white px-3 py-1\.5 text-\[13px\] font-medium leading-5 text-navy-deep/,
);
assert.match(stepNavigation, /flex min-h-9 items-center justify-between/);
assert.match(stepNavigation, /hover:border-brand\/30 hover:bg-neutral/);
assert.doesNotMatch(stepNavigation, /(?:text|bg|border)-brand(?:\s|")/);
assert.match(stepNavigation, /<ArrowLeft size=\{13\}/);
assert.match(page, /<ArrowRight size=\{13\}/);
assert.match(contextAccordion, /question\.options\.map/);
assert.match(contextAccordion, /<QuestionContent question=\{question\}/);
assert.match(contextAccordion, /option\.isCorrect/);
assert.match(contextAccordion, /Jawaban benar/);
assert.match(contextAccordion, /Sedang direview/);
assert.doesNotMatch(answerWorkspace, /AdminAnswerContentEditor|Edit jawaban/);
assert.doesNotMatch(answerWorkspace, /AdminQuestionContentEditor|Edit soal/);
assert.doesNotMatch(questionWorkspace, /AdminQuestionContentEditor|Edit soal/);
assert.match(answerWorkspace, /optionAnswer\?\.misconceptionReasons/);
assert.match(answerWorkspace, /evidence\.evidenceMisconceptionId\?\.trim\(\) === misconception\.id/);
assert.match(answerWorkspace, /<MisconceptionEvidenceDialog/);
assert.doesNotMatch(answerWorkspace, /<StructuredEvidenceList|mp-answer-evidence/);
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
assert.match(answerWorkspace, /Jawaban yang sedang direview/);
assert.match(answerWorkspace, /Lihat soal & pilihan jawaban/);
assert.match(answerWorkspace, /<ReviewStepNavigation previous=\{previousStep\} next=\{nextStep\} \/>/);
assert.doesNotMatch(answerWorkspace, /<SiblingNavigator/);
assert.doesNotMatch(answerWorkspace, /parentReference|siblingAnswerIds|activeIndex/);
assert.doesNotMatch(answerWorkspace, /\? "REVIEW JAWABAN" : "ANSWER REVIEW"/);
assert.match(questionWorkspace, /REVIEW MISKONSEPSI SOAL/);
assert.match(questionWorkspace, /QUESTION MISCONCEPTION REVIEW/);
assert.match(questionWorkspace, /EDIT REVIEW SOAL/);
assert.match(questionWorkspace, /HASIL REVIEW SOAL/);
assert.match(answerWorkspace, /REVIEW MISKONSEPSI JAWABAN/);
assert.match(answerWorkspace, /ANSWER MISCONCEPTION REVIEW/);
assert.match(answerWorkspace, /EDIT REVIEW JAWABAN/);
assert.match(answerWorkspace, /HASIL REVIEW JAWABAN/);
assert.doesNotMatch(questionWorkspace, /<SubmittedQuestionReview/);
assert.doesNotMatch(questionWorkspace, /Mode lihat/);
assert.doesNotMatch(questionWorkspace, /Jawaban terkait/);
assert.doesNotMatch(
  page,
  /Jawab kedua pertanyaan dan lengkapi pilihan serta alasan jika memilih Ada\.|Answer both questions and complete the selection and reason when choosing Yes\./,
);
assert.match(editor, />\s*Edit soal\s*</);
assert.match(editor, /saveAnswerContentOverride\(answer\.id, answerText\)/);
assert.doesNotMatch(editor, />\s*Edit jawaban\s*</);
assert.match(structuredEvidence, /"Nama"/);
assert.match(structuredEvidence, /"Jawaban"/);
assert.match(structuredEvidence, /Miskonsepsi/);
assert.match(structuredEvidence, /Penjelasan/);
assert.match(structuredEvidence, /Tidak tersedia/);
assert.match(structuredEvidence, /showModal\(\)/);
assert.match(structuredEvidence, /<PseudocodeBlock code=\{answerText\} \/>/);
assert.doesNotMatch(structuredEvidence, /answer\.evidenceId/);
assert.doesNotMatch(structuredEvidence, /General answer note|Catatan umum jawaban/);
assert.match(navigation, /aria-expanded=\{open\}/);
assert.match(navigation, /aria-controls=\{id\}/);
assert.match(navigation, /useState\(false\)/);
assert.match(navigation, /type="button"/);
assert.match(navigation, /<CircleHelp/);
assert.match(navigation, /open && "rotate-180"/);
assert.match(navigation, /disabled=\{index <= 0\}/);
assert.match(navigation, /disabled=\{index < 0 \|\| index >= total - 1\}/);

console.log("Review workspace self-check passed.");
