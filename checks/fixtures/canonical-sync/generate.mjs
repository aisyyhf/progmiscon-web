// Regenerates the canonical-sync fixtures deterministically.
//   node checks/fixtures/canonical-sync/generate.mjs
// The committed fixtures ARE the checked-in output of this script.
// checks/canonical-master-sync.mjs re-runs it into a temp dir and byte-compares
// to guard against drift.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildBaselineSnapshot, parseCsv } from "../../../database/staging/lib/build-baseline-snapshot.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));

const MISCONCEPTIONS = `misconception_id,active
M1,TRUE
M2,TRUE
M3,TRUE
`;
const ANSWERS = `answer_id,question_id,active,answer_text
A1,Q2,TRUE,Jawaban A
A2,Q2,TRUE,Jawaban B
`;
const QUESTION_MISC = `question_id,misconception_id,active
Q1,M1,TRUE
Q2,M2,TRUE
Q3,M3,TRUE
`;
const ANSWER_MISC_BASE = `answer_id,misconception_id,active
A2,M2,TRUE
`;
const ANSWER_MISC_BUMP = `answer_id,misconception_id,active
A2,M2,TRUE
A1,M1,TRUE
`;
const questionsCsv = (q2Ind, q3Ind, dropQ3 = false) => {
  const rows = [
    "question_id,active,question_ind,question_en,question_code",
    "Q1,TRUE,Soal satu.,Question one.,CODE1",
    `Q2,TRUE,${q2Ind},Question two.,CODE2`,
  ];
  if (!dropQ3) rows.push(`Q3,TRUE,${q3Ind},Question three.,CODE3`);
  return rows.join("\n") + "\n";
};

const dirFiles = (questions, answerMisc = ANSWER_MISC_BASE) => ({
  "misconceptions.csv": MISCONCEPTIONS,
  "questions.csv": questions,
  "answers.csv": ANSWERS,
  "question_misconceptions.csv": QUESTION_MISC,
  "answer_misconceptions.csv": answerMisc,
});

const DIRS = {
  current: dirFiles(questionsCsv("Soal dua.", "Soal tiga.")),
  "proposed-identical": dirFiles(questionsCsv("Soal dua.", "Soal tiga.")),
  "proposed-ok": dirFiles(questionsCsv("Soal dua (revisi).", "Soal tiga.")),
  "proposed-extra-question": dirFiles(questionsCsv("Soal dua (revisi).", "Soal tiga (revisi).")),
  "proposed-answer-bump": dirFiles(questionsCsv("Soal dua (revisi).", "Soal tiga."), ANSWER_MISC_BUMP),
  "proposed-drop-question": dirFiles(questionsCsv("Soal dua (revisi).", "Soal tiga.", true)),
};

const written = [];
for (const [dir, files] of Object.entries(DIRS)) {
  const target = join(ROOT, dir);
  mkdirSync(target, { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    const path = join(target, name);
    writeFileSync(path, content);
    written.push(path);
  }
}

const snapshotOf = (files) =>
  buildBaselineSnapshot({
    misconceptions: parseCsv(files["misconceptions.csv"]),
    questions: parseCsv(files["questions.csv"]),
    answers: parseCsv(files["answers.csv"]),
    questionMisconceptions: parseCsv(files["question_misconceptions.csv"]),
    answerMisconceptions: parseCsv(files["answer_misconceptions.csv"]),
  });

const currentSnapshot = snapshotOf(DIRS.current);
const proposedOkSnapshot = snapshotOf(DIRS["proposed-ok"]);
const proposedOkQ2Fp = proposedOkSnapshot.questionBaselines.find(
  (r) => r.question_id === "Q2",
).source_fingerprint;

const oracleClean = [
  ...currentSnapshot.questionBaselines.map((r, i) => ({
    target_type: "question",
    target_id: r.question_id,
    source_version: `00000000-0000-4000-8000-00000000000${i + 1}`,
    source_fingerprint: r.source_fingerprint,
    misconception_ids: r.misconception_ids,
    active_review_count: r.question_id === "Q2" ? 2 : 0,
    override_exists: r.question_id === "Q2",
  })),
  ...currentSnapshot.answerBaselines.map((r, i) => ({
    target_type: "answer",
    target_id: r.answer_id,
    question_id: r.question_id,
    source_version: `10000000-0000-4000-8000-00000000000${i + 1}`,
    source_fingerprint: r.source_fingerprint,
    misconception_ids: r.misconception_ids,
    active_review_count: 0,
    override_exists: false,
  })),
];
const clone = (rows) => rows.map((r) => ({ ...r }));
const oracleNull = clone(oracleClean).map((r) =>
  r.target_id === "Q1" ? { ...r, source_fingerprint: null } : r,
);
const oracleParityMismatch = clone(oracleClean).map((r) =>
  r.target_id === "Q1" ? { ...r, source_fingerprint: `sha256:${"0".repeat(64)}` } : r,
);
// CORRECT post-apply oracle for the proposed-ok content edit: Q2's
// source_fingerprint is refreshed, its source_version is HELD STABLE, and no
// review count / override changes (a content edit deactivates nothing).
const oracleAfterQ2Edit = clone(oracleClean).map((r) =>
  r.target_id === "Q2" ? { ...r, source_fingerprint: proposedOkQ2Fp } : r,
);
// ALERT post-apply oracle: the edit landed but Q2's source_version ALSO rotated
// (this must NEVER happen for a content edit).
const oracleAfterQ2Rotated = clone(oracleClean).map((r) =>
  r.target_id === "Q2"
    ? {
        ...r,
        source_fingerprint: proposedOkQ2Fp,
        source_version: "99999999-0000-4000-8000-000000000002",
      }
    : r,
);
// ALERT post-apply oracle: the WRONG question (Q1, not the allowlisted Q2)
// rotated its source_version.
const oracleAfterWrongQ1 = clone(oracleClean).map((r) =>
  r.target_id === "Q1"
    ? { ...r, source_version: "99999999-0000-4000-8000-000000000001" }
    : r,
);
// ALERT post-apply oracle: an ANSWER rotated (unexpected in a question-only edit)
const oracleAfterAnswerRotated = clone(oracleClean).map((r) => {
  if (r.target_id === "Q2") return { ...r, source_fingerprint: proposedOkQ2Fp };
  if (r.target_id === "A1") return { ...r, source_version: "99999999-1000-4000-8000-000000000001" };
  return r;
});

const writeJson = (name, value) => {
  const path = join(ROOT, name);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
  written.push(path);
};
writeJson("oracle-clean.json", oracleClean);
writeJson("oracle-null.json", oracleNull);
writeJson("oracle-parity-mismatch.json", oracleParityMismatch);
writeJson("oracle-after-q2-edit.json", oracleAfterQ2Edit);
writeJson("oracle-after-q2-rotated.json", oracleAfterQ2Rotated);
writeJson("oracle-after-wrong-q1.json", oracleAfterWrongQ1);
writeJson("oracle-after-answer-rotated.json", oracleAfterAnswerRotated);

console.log(`wrote ${written.length} fixture files`);
