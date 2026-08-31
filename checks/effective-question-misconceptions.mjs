import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyPublishedMasterOverrides,
  buildEffectiveQuestionMisconceptionMap,
} from "../src/utils/effectiveMasterData.ts";
import {
  buildAnswerReviewValues,
  buildQuestionReviewValues,
  getAdditionalMisconceptionCandidates,
  getQuestionRemovalProposalIds,
  initialMisconceptionReviewFormState,
  limitFormSelectionsToCurrentOptions,
  misconceptionReviewFormReducer,
} from "../src/utils/reviewMisconceptionForm.ts";
import { buildQuestionOptions } from "../src/utils/questionMetadata.ts";

const misconceptions = ["M-01", "M-02", "M-03"].map(
  (misconception_id, index) => ({
    misconception_id,
    topic_id: "T-01",
    title_ind: "",
    title_en: "",
    description_ind: "",
    description_en: "",
    wrong_example: "",
    correct_example: "",
    correction_ind: "",
    correction_en: "",
    common_cause_ind: "",
    common_cause_en: "",
    order_no: String(index + 1),
    active: "TRUE",
  }),
);
const question = {
  question_id: "Q-01",
  question_type: "MP",
  title_ind: "",
  title_en: "",
  question_ind: "",
  question_en: "",
  question_code: "",
  reference_solution: "",
  expected_output: "",
  week: "",
  source_no: "",
  order_no: "1",
  active: "TRUE",
  data_status: "active",
};
const answers = ["A-01", "A-02"].map((answer_id, index) => ({
  answer_id,
  answer_role: "mp_option",
  question_id: "Q-01",
  answer_text: answer_id,
  status: "incorrect",
  explanation_ind: "",
  explanation_en: "",
  order_no: String(index + 1),
  active: "TRUE",
}));
const masterData = (questionMisconceptions, answerMisconceptions) => ({
  topics: [],
  misconceptions,
  questions: [question],
  questionTopics: [],
  questionMisconceptions,
  answers,
  answerMisconceptions,
  similarMisconceptions: [],
});
const questionRelation = (id) => ({
  question_id: "Q-01",
  misconception_id: id,
  source: "master",
  active: "TRUE",
});
const answerRelation = (answerId, id) => ({
  answer_id: answerId,
  misconception_id: id,
  reason_ind: "",
  reason_en: "",
  active: "TRUE",
});
const provenanceFor = (data) =>
  buildEffectiveQuestionMisconceptionMap(data).get("Q-01");
const noOverrides = {
  questionContentOverrides: [],
  answerContentOverrides: [],
  questionMisconceptionOverrides: [],
  answerMisconceptionOverrides: [],
};

assert.deepEqual(
  provenanceFor(masterData([questionRelation(" M-02 ")], [])),
  {
    directQuestionMisconceptionIds: ["M-02"],
    answerDerivedMisconceptionIds: [],
    questionMisconceptionIds: ["M-02"],
  },
  "direct question IDs must form the effective set when no answers are linked",
);
assert.deepEqual(
  provenanceFor(masterData([], [answerRelation("A-01", "M-03")])),
  {
    directQuestionMisconceptionIds: [],
    answerDerivedMisconceptionIds: ["M-03"],
    questionMisconceptionIds: ["M-03"],
  },
  "answer-derived IDs must form the effective set without direct links",
);

const union = provenanceFor(
  masterData(
    [questionRelation("M-02"), questionRelation(" M-01 ")],
    [
      answerRelation("A-01", "M-02"),
      answerRelation("A-01", " "),
      answerRelation("A-02", "M-03"),
    ],
  ),
);
assert.deepEqual(union, {
  directQuestionMisconceptionIds: ["M-01", "M-02"],
  answerDerivedMisconceptionIds: ["M-02", "M-03"],
  questionMisconceptionIds: ["M-01", "M-02", "M-03"],
});
assert.deepEqual(
  getQuestionRemovalProposalIds(union.questionMisconceptionIds),
  ["M-01", "M-02", "M-03"],
  "every effective ID must be available for a question removal proposal",
);
assert.equal(
  getQuestionRemovalProposalIds(
    provenanceFor(masterData([], [answerRelation("A-01", "M-03")]))
      .questionMisconceptionIds,
  ).length > 0,
  true,
  "Yes must be enabled when the effective set is answer-derived only",
);
assert.equal(
  getQuestionRemovalProposalIds([]).length > 0,
  false,
  "Yes must be disabled only when the effective set is empty",
);
assert.deepEqual(
  getAdditionalMisconceptionCandidates(
    [{ id: "M-01" }, { id: "M-02" }, { id: "M-03" }],
    union.questionMisconceptionIds,
  ),
  [],
  "question addition candidates must exclude the complete effective union",
);

let questionReviewForm = misconceptionReviewFormReducer(
  initialMisconceptionReviewFormState,
  { type: "set_presence", field: "removal", value: true },
);
questionReviewForm = misconceptionReviewFormReducer(questionReviewForm, {
  type: "set_ids",
  field: "removal",
  ids: ["M-03"],
});
questionReviewForm = misconceptionReviewFormReducer(questionReviewForm, {
  type: "set_reason",
  field: "removal",
  value: "Relasi jawaban perlu ditinjau",
});
questionReviewForm = misconceptionReviewFormReducer(questionReviewForm, {
  type: "set_presence",
  field: "addition",
  value: false,
});
assert.deepEqual(buildQuestionReviewValues(questionReviewForm), {
  hasIncorrectMisconceptions: true,
  removedMisconceptionIds: ["M-03"],
  removalReason: "Relasi jawaban perlu ditinjau",
  hasAdditionalMisconceptions: false,
  additionalMisconceptionIds: [],
  additionReason: null,
  note: null,
});
assert.deepEqual(buildAnswerReviewValues(questionReviewForm), {
  hasMismatchedMisconceptions: true,
  removedMisconceptionIds: ["M-03"],
  removalReason: "Relasi jawaban perlu ditinjau",
  hasAdditionalMisconceptions: false,
  additionalMisconceptionIds: [],
  additionReason: null,
  note: null,
});

const baseline = masterData(
  [questionRelation("M-01")],
  [answerRelation("A-01", "M-02"), answerRelation("A-02", "M-02")],
);
const directRemoved = applyPublishedMasterOverrides(baseline, {
  ...noOverrides,
  questionMisconceptionOverrides: [
    {
      question_id: "Q-01",
      misconception_ids: [],
      published_at: "2026-07-29T00:00:00Z",
      updated_at: "2026-07-29T00:00:00Z",
    },
  ],
});
assert.deepEqual(
  provenanceFor(directRemoved).questionMisconceptionIds,
  ["M-02"],
  "an answer-derived ID must remain effective after direct question removal",
);

const answerAddition = applyPublishedMasterOverrides(baseline, {
  ...noOverrides,
  answerMisconceptionOverrides: [
    {
      answer_id: "A-01",
      question_id: "Q-01",
      misconception_ids: ["M-02", "M-03"],
      published_at: "2026-07-29T00:00:00Z",
      updated_at: "2026-07-29T00:00:00Z",
    },
  ],
});
assert.deepEqual(
  provenanceFor(answerAddition).questionMisconceptionIds,
  ["M-01", "M-02", "M-03"],
  "an answer override addition must propagate to its parent question",
);
assert.deepEqual(
  provenanceFor(answerAddition).directQuestionMisconceptionIds,
  ["M-01"],
  "an answer override must not replace the direct question snapshot",
);

const oneAnswerRemoved = applyPublishedMasterOverrides(baseline, {
  ...noOverrides,
  answerMisconceptionOverrides: [
    {
      answer_id: "A-01",
      question_id: "Q-01",
      misconception_ids: [],
      published_at: "2026-07-29T00:00:00Z",
      updated_at: "2026-07-29T00:00:00Z",
    },
  ],
});
assert.deepEqual(
  provenanceFor(oneAnswerRemoved).questionMisconceptionIds,
  ["M-01", "M-02"],
  "another answer relation must retain an ID after one answer removes it",
);

const allAnswersRemoved = applyPublishedMasterOverrides(baseline, {
  ...noOverrides,
  answerMisconceptionOverrides: answers.map((answer) => ({
    answer_id: answer.answer_id,
    question_id: "Q-01",
    misconception_ids: [],
    published_at: "2026-07-29T00:00:00Z",
    updated_at: "2026-07-29T00:00:00Z",
  })),
});
assert.deepEqual(
  provenanceFor(allAnswersRemoved).questionMisconceptionIds,
  ["M-01"],
  "an answer-derived ID must disappear only when no answer or direct relation retains it",
);

const directlyRetained = applyPublishedMasterOverrides(
  masterData(
    [questionRelation("M-02")],
    [answerRelation("A-01", "M-02")],
  ),
  {
    ...noOverrides,
    answerMisconceptionOverrides: [
      {
        answer_id: "A-01",
        question_id: "Q-01",
        misconception_ids: [],
        published_at: "2026-07-29T00:00:00Z",
        updated_at: "2026-07-29T00:00:00Z",
      },
    ],
  },
);
assert.deepEqual(
  provenanceFor(directlyRetained).questionMisconceptionIds,
  ["M-02"],
  "a direct question relation must retain an ID removed from its answers",
);

const options = buildQuestionOptions(
  answers,
  new Map([["A-01", ["M-03", "M-01", "M-02", "M-02"]]]),
);
assert.deepEqual(
  options[0].misconceptionIds,
  ["M-01", "M-02", "M-03"],
  "MP options must retain every misconception ID",
);

// ---------------------------------------------------------------------------
// Restoring a submitted Question Review must not keep selections that have
// since left the effective set (e.g. an answer-derived misconception dropped
// from its answer relation). Such IDs are invisible in the form and would make
// save_question_review_v3 reject a re-save.
// ---------------------------------------------------------------------------
const restoredForm = {
  removalChoice: true,
  // M-01 direct, M-03 answer-derived at save time
  removedMisconceptionIds: ["M-03", "M-01"],
  removalReason: "IO-05-style answer-derived removal plus a direct one",
  additionChoice: true,
  additionalMisconceptionIds: ["M-04"],
  additionReason: "extra proposal",
  note: "reviewer note",
};

const unionAtSaveTime = provenanceFor(
  masterData(
    [questionRelation("M-01"), questionRelation("M-02")],
    [answerRelation("A-01", "M-02"), answerRelation("A-01", "M-03")],
  ),
).questionMisconceptionIds;
assert.deepEqual(unionAtSaveTime, ["M-01", "M-02", "M-03"]);

// M-03 still part of the effective set -> every retained selection survives and
// the untouched form keeps its identity.
const stillCurrent = limitFormSelectionsToCurrentOptions(restoredForm, {
  removableIds: getQuestionRemovalProposalIds(unionAtSaveTime),
  addableIds: getAdditionalMisconceptionCandidates(
    [{ id: "M-04" }, { id: "M-05" }],
    unionAtSaveTime,
  ).map((item) => item.id),
});
assert.equal(
  stillCurrent,
  restoredForm,
  "a still-valid restored review is returned unchanged",
);
assert.deepEqual(stillCurrent.removedMisconceptionIds, ["M-03", "M-01"]);
assert.deepEqual(stillCurrent.additionalMisconceptionIds, ["M-04"]);

// M-03 has been dropped from the answer relation -> effective set is now
// [M-01, M-02]. The stale answer-derived removal is pruned; the direct removal,
// the still-addable addition, and every reason / note field are untouched.
const reducedUnion = provenanceFor(
  masterData(
    [questionRelation("M-01"), questionRelation("M-02")],
    [answerRelation("A-01", "M-02")],
  ),
).questionMisconceptionIds;
assert.deepEqual(reducedUnion, ["M-01", "M-02"]);

const afterStale = limitFormSelectionsToCurrentOptions(restoredForm, {
  removableIds: getQuestionRemovalProposalIds(reducedUnion),
  addableIds: getAdditionalMisconceptionCandidates(
    [{ id: "M-03" }, { id: "M-04" }, { id: "M-05" }],
    reducedUnion,
  ).map((item) => item.id),
});
assert.deepEqual(
  afterStale.removedMisconceptionIds,
  ["M-01"],
  "stale answer-derived removal is dropped, the direct removal is kept",
);
assert.deepEqual(
  afterStale.additionalMisconceptionIds,
  ["M-04"],
  "a still-addable addition survives the prune",
);
assert.equal(afterStale.removalChoice, true, "removal choice is untouched");
assert.equal(
  afterStale.removalReason,
  restoredForm.removalReason,
  "removal reason is untouched",
);
assert.equal(afterStale.additionChoice, true, "addition choice is untouched");
assert.equal(
  afterStale.additionReason,
  restoredForm.additionReason,
  "addition reason is untouched",
);
assert.equal(afterStale.note, restoredForm.note, "note is untouched");

// The re-save payload built from the restored state carries no hidden stale ID.
const restoredPayload = buildQuestionReviewValues(
  misconceptionReviewFormReducer(initialMisconceptionReviewFormState, {
    type: "replace",
    value: afterStale,
  }),
);
assert.deepEqual(restoredPayload.removedMisconceptionIds, ["M-01"]);
assert.ok(
  !restoredPayload.removedMisconceptionIds.includes("M-03"),
  "re-save payload must not resurrect the pruned answer-derived removal",
);
assert.deepEqual(restoredPayload.additionalMisconceptionIds, ["M-04"]);

// An addition that has since BECOME part of the effective set (through an
// answer relation) is pruned too, matching save_question_review_v3's
// ADDITION_ALREADY_IN_BASELINE guard against the effective union.
const additionNowEffective = limitFormSelectionsToCurrentOptions(
  { ...restoredForm, additionalMisconceptionIds: ["M-03"] },
  {
    removableIds: getQuestionRemovalProposalIds(unionAtSaveTime),
    addableIds: getAdditionalMisconceptionCandidates(
      [{ id: "M-04" }],
      unionAtSaveTime,
    ).map((item) => item.id),
  },
);
assert.deepEqual(
  additionNowEffective.additionalMisconceptionIds,
  [],
  "an addition now covered by the effective set is dropped on restore",
);

// A review that only ever proposed a now-stale removal ends up with an empty
// selection (surfaced by the form's existing selection validation, never sent
// as a hidden stale ID).
const onlyStaleRemoval = limitFormSelectionsToCurrentOptions(
  {
    ...restoredForm,
    removedMisconceptionIds: ["M-03"],
    additionChoice: false,
    additionalMisconceptionIds: [],
    additionReason: "",
  },
  {
    removableIds: getQuestionRemovalProposalIds(reducedUnion),
    addableIds: [],
  },
);
assert.deepEqual(onlyStaleRemoval.removedMisconceptionIds, []);
assert.equal(onlyStaleRemoval.removalReason, restoredForm.removalReason);

const questionReviewSource = readFileSync(
  "src/pages/LecturerReviewPage.tsx",
  "utf8",
);
assert.match(
  questionReviewSource,
  /limitFormSelectionsToCurrentOptions\(\s*loadPreservedReviewForm\(savedForm, draftIdentity\),\s*restorableSelectionOptions,?\s*\)/,
  "the restored Question Review form state must be pruned to the current options",
);
const removalProposalSection = questionReviewSource.slice(
  questionReviewSource.indexOf('aria-labelledby="remove-misconception-question"'),
  questionReviewSource.indexOf(
    'aria-labelledby="add-misconception-question"',
  ),
);
assert.match(
  removalProposalSection,
  /yesDisabled=\{questionRemovalProposalIds\.length === 0\}/,
  "Question 1 Yes availability must follow the effective set",
);
assert.match(
  removalProposalSection,
  /\{recommended\.map\(\(item\) => \([\s\S]+\{item\.id\}[\s\S]+t\(item\.title, language\)/,
  "every effective misconception must appear in the compact removal list",
);
assert.doesNotMatch(
  removalProposalSection,
  /misconceptionSourceLabel|Terkait langsung ke soal|—/,
  "the compact removal list must omit redundant provenance copy and separators",
);
assert.doesNotMatch(
  removalProposalSection,
  /removableMisconceptions|getEffectivelyRemovableQuestionMisconceptionIds/,
  "the removal list must not be restricted to direct-only candidates",
);

const persistenceSource = readFileSync(
  "src/services/reviewPersistenceRepository.ts",
  "utf8",
);
assert.match(
  persistenceSource,
  /removed_misconception_ids:\s*values\.removedMisconceptionIds/,
  "question review persistence must store selected answer-derived IDs unchanged",
);

const adminSource = readFileSync(
  "src/components/admin/AdminFinalizationPanel.tsx",
  "utf8",
);
assert.match(
  adminSource,
  /Usulan hapus yang masih berasal dari jawaban tidak akan hilang dari\s+kemungkinan miskonsepsi soal sampai relasi jawaban terkait juga\s+dihapus\./,
  "Admin finalization must explain retained answer-derived removal votes",
);
assert.match(
  adminSource,
  /disabled=\{!ready \|\| !baselineAvailable \|\| busy\}/,
  "answer-derived removal votes must not block question publication",
);

console.log("effective question misconception checks passed");
