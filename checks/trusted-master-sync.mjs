import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  buildTrustedMasterSnapshot,
  canonicalQuestionType,
  hasReviewStructuredContent,
  MAX_RETAINED_VALIDATION_ISSUES,
  parseSyncIntent,
  summarizeTrustedMasterSnapshot,
} from "../supabase/functions/_shared/trustedMasterSync.ts";
import { normalizeQuestionType } from "../src/utils/questionMetadata.ts";

function fixture() {
  return {
    questions: [
      {
        question_id: "Q-PS",
        question_type: "PS",
        question_ind: "Jelaskan hasilnya.",
        question_en: "Explain the result.",
        content_blocks_ind: "",
        content_blocks_en: "",
        active: "TRUE",
      },
      {
        question_id: "Q-STRUCTURED",
        question_type: "short_answer",
        question_ind: "Telusuri pseudocode berikut.",
        question_en: "Trace the following pseudocode.",
        content_blocks_ind: JSON.stringify([
          { type: "text", content: "Telusuri pseudocode berikut." },
          { type: "code", content: "x <- 1\nprint(x)" },
        ]),
        content_blocks_en: JSON.stringify([
          { type: "text", content: "Trace the following pseudocode." },
          { type: "code", content: "x <- 1\nprint(x)" },
        ]),
        active: "1",
      },
      {
        question_id: "Q-MP",
        question_type: "multiple_choice",
        question_ind: "Pilih jawaban yang benar.",
        question_en: "Choose the correct answer.",
        content_blocks_ind: "",
        content_blocks_en: "",
        active: "yes",
      },
    ],
    answers: [
      {
        answer_id: "A-MP",
        question_id: "Q-MP",
        answer_role: "mp_option",
        active: "TRUE",
      },
      {
        answer_id: "A-PS-REFERENCE",
        question_id: "Q-PS",
        answer_role: "ps_reference",
        active: "TRUE",
      },
      {
        answer_id: "A-EVIDENCE",
        question_id: "Q-PS",
        answer_role: "evidence",
        active: "TRUE",
      },
    ],
    questionMisconceptions: [
      {
        question_id: "Q-PS",
        misconception_id: "M-1",
        source: "master",
        evidence_level: "E",
        rationale_ind: "Alasan satu",
        source_question_id: "",
        active: "TRUE",
      },
      {
        question_id: "Q-STRUCTURED",
        misconception_id: "M-2",
        source: "master",
        evidence_level: "R",
        rationale_ind: "Alasan dua",
        source_question_id: "",
        active: "TRUE",
      },
      {
        question_id: "Q-MP",
        misconception_id: "M-2",
        source: "master",
        evidence_level: "E",
        rationale_ind: "Alasan MP",
        source_question_id: "",
        active: "TRUE",
      },
    ],
    answerMisconceptions: [
      {
        answer_id: "A-MP",
        misconception_id: "M-1",
        reason_ind: "Alasan opsi",
        reason_en: "Option reason",
        active: "TRUE",
      },
    ],
    misconceptions: [
      { misconception_id: "M-1", active: "TRUE" },
      { misconception_id: "M-2", active: "TRUE" },
    ],
  };
}

async function validSnapshot(input = fixture()) {
  const result = await buildTrustedMasterSnapshot(input);
  assert.equal(
    result.ok,
    true,
    result.ok ? undefined : JSON.stringify(result.issues),
  );
  return result.snapshot;
}

const aliases = [
  ["PS", "PS", "short_answer"],
  ["essay", "PS", "short_answer"],
  ["short answer", "PS", "short_answer"],
  ["short_answer", "PS", "short_answer"],
  ["MP", "MP", "multiple_choice"],
  ["multiple choice", "MP", "multiple_choice"],
  ["multiple_choice", "MP", "multiple_choice"],
];
for (const [raw, trusted, frontend] of aliases) {
  assert.equal(canonicalQuestionType(raw), trusted);
  assert.equal(normalizeQuestionType(raw), frontend);
}
assert.equal(canonicalQuestionType("unknown"), null);

const snapshot = await validSnapshot();
assert.deepEqual(
  snapshot.questionBaselines.map((item) => item.question_id),
  ["Q-MP", "Q-PS", "Q-STRUCTURED"],
  "every active question must appear exactly once",
);
for (const baseline of snapshot.questionBaselines) {
  assert.deepEqual(Object.keys(baseline).sort(), [
    "misconception_ids",
    "question_id",
    "source_fingerprint",
  ]);
}
assert.deepEqual(
  snapshot.answerBaselines.map((item) => item.answer_id),
  ["A-MP"],
  "only active mp_option answers are Review baselines",
);
assert.deepEqual(Object.keys(snapshot.answerBaselines[0]).sort(), [
  "answer_id",
  "misconception_ids",
  "question_id",
  "source_fingerprint",
]);
assert.equal(
  snapshot.answerBaselines.some((item) => item.answer_id === "A-PS-REFERENCE"),
  false,
  "ps_reference must be excluded",
);
assert.equal(
  snapshot.answerBaselines.some((item) => item.answer_id === "A-EVIDENCE"),
  false,
  "evidence must be excluded",
);

const contextById = new Map(
  snapshot.questionContexts.map((question) => [question.questionId, question]),
);
assert.equal(contextById.get("Q-PS")?.questionType, "PS");
assert.equal(contextById.get("Q-MP")?.questionType, "MP");
assert.equal(contextById.get("Q-PS")?.hasStructuredContent, false);
assert.equal(contextById.get("Q-STRUCTURED")?.hasStructuredContent, true);
assert.equal(contextById.get("Q-MP")?.hasStructuredContent, false);

const emptyStructuredInput = {
  contentBlocksInd: [],
  contentBlocksEn: [],
  pseudocode: "",
  inputDescriptionInd: "",
  inputDescriptionEn: "",
  outputDescriptionInd: "",
  outputDescriptionEn: "",
  sampleCases: [],
};
assert.equal(hasReviewStructuredContent(emptyStructuredInput), false);
assert.equal(
  hasReviewStructuredContent({
    ...emptyStructuredInput,
    contentBlocksInd: [{ type: "text", content: "Explicit text" }],
  }),
  true,
);
assert.equal(
  hasReviewStructuredContent({
    ...emptyStructuredInput,
    contentBlocksEn: [{ type: "code", content: "READ x" }],
  }),
  true,
);
assert.equal(
  hasReviewStructuredContent({ ...emptyStructuredInput, pseudocode: "READ x" }),
  true,
);
assert.equal(
  hasReviewStructuredContent({
    ...emptyStructuredInput,
    inputDescriptionInd: "Satu bilangan",
  }),
  true,
);
assert.equal(
  hasReviewStructuredContent({
    ...emptyStructuredInput,
    outputDescriptionEn: "One number",
  }),
  true,
);
assert.equal(
  hasReviewStructuredContent({
    ...emptyStructuredInput,
    sampleCases: [{ input: "1", output: "2" }],
  }),
  true,
);

const noAnswers = fixture();
noAnswers.answers = [];
noAnswers.answerMisconceptions = [];
const noAnswerSnapshot = await validSnapshot(noAnswers);
assert.equal(
  noAnswerSnapshot.questionContexts.find((item) => item.questionId === "Q-MP")
    ?.questionType,
  "MP",
  "question type must come from question_type, not answer existence",
);

const sameSnapshot = await validSnapshot();
assert.equal(
  contextById.get("Q-PS")?.contentFingerprint,
  sameSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.contentFingerprint,
  "same canonical content must produce the same fingerprint",
);

const canonicallyEquivalent = fixture();
canonicallyEquivalent.questions[0].question_ind =
  "  \r\nJelaskan hasilnya.\r\n  ";
const canonicallyEquivalentSnapshot = await validSnapshot(
  canonicallyEquivalent,
);
assert.equal(
  contextById.get("Q-PS")?.contentFingerprint,
  canonicallyEquivalentSnapshot.questionContexts.find(
    (item) => item.questionId === "Q-PS",
  )?.contentFingerprint,
  "equivalent rendered wording must produce the same fingerprint",
);

const wordingChanged = fixture();
wordingChanged.questions[0].question_ind = "Wording yang berubah.";
const wordingSnapshot = await validSnapshot(wordingChanged);
assert.notEqual(
  contextById.get("Q-PS")?.contentFingerprint,
  wordingSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.contentFingerprint,
  "wording changes must change the content fingerprint",
);

const blocksChanged = fixture();
blocksChanged.questions[1].content_blocks_ind = JSON.stringify([
  { type: "text", content: "Telusuri pseudocode berikut." },
  { type: "code", content: "x <- 2\nprint(x)" },
]);
const blocksSnapshot = await validSnapshot(blocksChanged);
assert.notEqual(
  contextById.get("Q-STRUCTURED")?.contentFingerprint,
  blocksSnapshot.questionContexts.find((item) =>
    item.questionId === "Q-STRUCTURED"
  )
    ?.contentFingerprint,
  "structured block changes must change the content fingerprint",
);

const ioChanged = fixture();
ioChanged.questions[0].input_description_ind = "Masukkan satu bilangan.";
const ioSnapshot = await validSnapshot(ioChanged);
assert.notEqual(
  contextById.get("Q-PS")?.contentFingerprint,
  ioSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.contentFingerprint,
  "I/O description changes must change the content fingerprint",
);
assert.equal(
  ioSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.hasStructuredContent,
  true,
);

const pseudocodeChanged = fixture();
pseudocodeChanged.questions[0].question_code = "READ x\nPRINT x";
const pseudocodeSnapshot = await validSnapshot(pseudocodeChanged);
assert.notEqual(
  contextById.get("Q-PS")?.contentFingerprint,
  pseudocodeSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.contentFingerprint,
  "pseudocode changes must change the content fingerprint",
);
assert.equal(
  pseudocodeSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.hasStructuredContent,
  true,
);

const sampleChanged = fixture();
sampleChanged.questions[0].sample_inputs = JSON.stringify(["1"]);
sampleChanged.questions[0].sample_outputs = JSON.stringify(["2"]);
const sampleSnapshot = await validSnapshot(sampleChanged);
assert.notEqual(
  contextById.get("Q-PS")?.contentFingerprint,
  sampleSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.contentFingerprint,
  "sample changes must change the content fingerprint",
);
assert.equal(
  sampleSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.hasStructuredContent,
  true,
);

const testCaseChanged = fixture();
testCaseChanged.questions[0].test_cases_json = JSON.stringify([
  { case_no: 1, input: "3", output: "4" },
]);
const testCaseSnapshot = await validSnapshot(testCaseChanged);
assert.notEqual(
  contextById.get("Q-PS")?.contentFingerprint,
  testCaseSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.contentFingerprint,
  "test-case changes must change the content fingerprint",
);
assert.equal(
  testCaseSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.hasStructuredContent,
  true,
);

const sameRenderedTestCase = structuredClone(testCaseChanged);
sameRenderedTestCase.questions[0].sample_inputs = JSON.stringify(["ignored"]);
sameRenderedTestCase.questions[0].sample_outputs = JSON.stringify(["ignored"]);
const sameRenderedTestCaseSnapshot = await validSnapshot(sameRenderedTestCase);
assert.equal(
  testCaseSnapshot.questionContexts.find((item) => item.questionId === "Q-PS")
    ?.contentFingerprint,
  sameRenderedTestCaseSnapshot.questionContexts.find(
    (item) => item.questionId === "Q-PS",
  )?.contentFingerprint,
  "fallback samples must not change the hash when rendered test cases take precedence",
);

const relationshipChanged = fixture();
relationshipChanged.questionMisconceptions[0].misconception_id = "M-2";
const relationshipSnapshot = await validSnapshot(relationshipChanged);
assert.equal(
  contextById.get("Q-PS")?.contentFingerprint,
  relationshipSnapshot.questionContexts.find((item) =>
    item.questionId === "Q-PS"
  )
    ?.contentFingerprint,
  "relationship-only changes must not change the content fingerprint",
);
assert.notEqual(
  snapshot.questionBaselines.find((item) => item.question_id === "Q-PS")
    ?.source_fingerprint,
  relationshipSnapshot.questionBaselines.find((item) =>
    item.question_id === "Q-PS"
  )
    ?.source_fingerprint,
  "relationship changes must change the relationship fingerprint",
);

const duplicateQuestion = fixture();
duplicateQuestion.questions.push({ ...duplicateQuestion.questions[0] });
const duplicateResult = await buildTrustedMasterSnapshot(duplicateQuestion);
assert.equal(duplicateResult.ok, false);
assert.equal(
  duplicateResult.ok
    ? false
    : duplicateResult.issues.some((issue) => issue.code === "DUPLICATE_ID"),
  true,
  "duplicate question IDs must reject the entire snapshot",
);

const brokenParent = fixture();
brokenParent.answers[0].question_id = "Q-MISSING";
const brokenParentResult = await buildTrustedMasterSnapshot(brokenParent);
assert.equal(brokenParentResult.ok, false);
assert.equal(
  brokenParentResult.ok ? false : brokenParentResult.issues.some(
    (issue) => issue.code === "BROKEN_ANSWER_PARENT",
  ),
  true,
  "answer parent questions must exist",
);

const invalidEvidenceLevel = fixture();
invalidEvidenceLevel.questionMisconceptions[0].evidence_level = "UNKNOWN";
const invalidEvidenceResult = await buildTrustedMasterSnapshot(
  invalidEvidenceLevel,
);
assert.equal(invalidEvidenceResult.ok, false);
assert.equal(
  invalidEvidenceResult.ok ? false : invalidEvidenceResult.issues.some(
    (issue) => issue.code === "INVALID_EVIDENCE_LEVEL",
  ),
  true,
  "unknown evidence levels must reject the snapshot",
);

const manyInvalidRows = fixture();
manyInvalidRows.questions = Array.from(
  { length: MAX_RETAINED_VALIDATION_ISSUES + 50 },
  (_, index) => ({
    ...manyInvalidRows.questions[0],
    question_id: `Q-INVALID-${index}`,
    active: "maybe",
  }),
);
const cappedIssues = await buildTrustedMasterSnapshot(manyInvalidRows);
assert.equal(cappedIssues.ok, false);
assert.equal(
  cappedIssues.ok ? 0 : cappedIssues.issues.length,
  MAX_RETAINED_VALIDATION_ISSUES,
  "retained validation issues must remain bounded",
);

assert.deepEqual(parseSyncIntent(undefined), { ok: true, mode: "preview" });
assert.deepEqual(parseSyncIntent({ mode: "preview" }), {
  ok: true,
  mode: "preview",
});
assert.deepEqual(parseSyncIntent({ mode: "sync" }), { ok: true, mode: "sync" });
assert.equal(parseSyncIntent({ url: "https://example.com" }).ok, false);
assert.equal(parseSyncIntent({ mode: "sync", rpc: "anything" }).ok, false);

const preview = summarizeTrustedMasterSnapshot(snapshot);
assert.deepEqual(preview, {
  questionCount: 3,
  answerBaselineCount: 1,
  misconceptionCount: 2,
  psQuestionCount: 2,
  mpQuestionCount: 1,
  structuredQuestionCount: 1,
  relationSnapshotFingerprint: snapshot.relationSnapshotFingerprint,
  contentSnapshotFingerprint: snapshot.contentSnapshotFingerprint,
  validationErrors: [],
});

function filesUnder(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

for (const path of filesUnder("src")) {
  assert.equal(
    readFileSync(path, "utf8").includes("SUPABASE_SERVICE_ROLE_KEY"),
    false,
    `service-role environment name must not appear in browser source: ${path}`,
  );
}

const edgePath = "supabase/functions/sync-review-master-data/index.ts";
const edgeSource = readFileSync(edgePath, "utf8");
assert.equal(edgeSource.includes("VITE_"), false);
assert.equal(
  /console\s*\./.test(edgeSource),
  false,
  "Edge Function must not log secrets/errors",
);
assert.equal(
  (edgeSource.match(/SUPABASE_SERVICE_ROLE_KEY/g) ?? []).length,
  1,
  "service-role key must have one server-runtime read",
);
assert.equal(
  (edgeSource.match(/serviceRoleKey/g) ?? []).length,
  2,
  "service-role value must only be read and passed into the isolated client",
);
assert.equal(
  (edgeSource.match(/sync_master_relation_baselines_v2/g) ?? []).length,
  1,
  "the mutation contract must be explicitly named exactly once",
);

const handlerIndex = edgeSource.indexOf("async function handleRequest");
const authorizationIndex = edgeSource.indexOf(
  "await authorizeActiveAdmin(request, dependencies)",
  handlerIndex,
);
const loadIndex = edgeSource.indexOf(
  "await loadTrustedMasterRows(dependencies)",
  handlerIndex,
);
const previewIndex = edgeSource.indexOf('mode === "preview"', handlerIndex);
const serviceKeyIndex = edgeSource.indexOf(
  '"SUPABASE_SERVICE_ROLE_KEY"',
  handlerIndex,
);
const mutationIndex = edgeSource.indexOf(
  '"sync_master_relation_baselines_v2"',
  handlerIndex,
);
assert.ok(handlerIndex >= 0);
assert.ok(authorizationIndex > handlerIndex);
assert.ok(
  loadIndex > authorizationIndex,
  "master sources load only after Admin authorization",
);
assert.ok(
  previewIndex > loadIndex,
  "preview must validate the complete trusted snapshot",
);
assert.ok(
  serviceKeyIndex > previewIndex,
  "preview must return before service-role access",
);
assert.ok(
  mutationIndex > serviceKeyIndex,
  "mutation is unreachable before service-role setup",
);
assert.ok(edgeSource.includes("profile?.active !== true"));
assert.ok(edgeSource.includes('"current_user_is_admin"'));
assert.ok(
  edgeSource.includes(
    "input_question_baselines: built.snapshot.questionBaselines",
  ),
);
assert.ok(
  edgeSource.includes("input_answer_baselines: built.snapshot.answerBaselines"),
);
assert.ok(
  edgeSource.includes(
    "input_misconception_ids: built.snapshot.misconceptionIds",
  ),
);
assert.ok(edgeSource.includes('request.method === "OPTIONS"'));
assert.ok(edgeSource.includes('requiredEnvironment("ADMIN_APP_ORIGINS"'));
assert.ok(edgeSource.includes('redirect: "manual"'));
assert.equal(edgeSource.includes("request.text()"), false);
assert.equal(edgeSource.includes("response.text()"), false);

const functionConfig = readFileSync("supabase/config.toml", "utf8");
assert.match(
  functionConfig,
  /\[functions\.sync-review-master-data\][\s\S]*verify_jwt\s*=\s*true/,
);

console.log("trusted master sync checks passed");
