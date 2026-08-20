import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { tmpdir } from "node:os";
import Papa from "papaparse";

import { buildTrustedMasterSnapshot } from "../supabase/functions/_shared/trustedMasterSync.ts";
import { TRUSTED_MASTER_SOURCE_DEFINITIONS } from "../supabase/functions/sync-review-master-data/index.ts";
import {
  compareBaselineParity,
  loadFrozenMasterRows,
  parityPassed,
  parseProductionOracle,
  trustedBaselineRows,
} from "../scripts/check-trusted-master-parity.ts";

const rowsBySource = {
  questions: [{
    question_id: "Q-1",
    question_type: "MP",
    question_ind: "Pilih jawaban.",
    question_en: "Choose an answer.",
    question_code: "",
    content_blocks_ind: "",
    content_blocks_en: "",
    input_description_ind: "",
    input_description_en: "",
    output_description_ind: "",
    output_description_en: "",
    sample_inputs: "",
    sample_outputs: "",
    test_cases_json: "",
    active: "TRUE",
  }],
  answers: [{
    answer_id: "A-1",
    question_id: "Q-1",
    answer_role: "mp_option",
    active: "TRUE",
  }],
  questionMisconceptions: [{
    question_id: "Q-1",
    misconception_id: "M-1",
    source: "master",
    evidence_level: "E",
    rationale_ind: "Alasan",
    source_question_id: "",
    active: "TRUE",
  }],
  answerMisconceptions: [{
    answer_id: "A-1",
    misconception_id: "M-1",
    reason_ind: "Alasan",
    reason_en: "Reason",
    active: "TRUE",
  }],
  misconceptions: [{ misconception_id: "M-1", active: "TRUE" }],
};

const temporaryRoot = resolve(tmpdir());
const directory = resolve(
  mkdtempSync(join(temporaryRoot, "trusted-master-parity-")),
);
assert.ok(directory.startsWith(`${temporaryRoot}${sep}`));

try {
  for (const source of TRUSTED_MASTER_SOURCE_DEFINITIONS) {
    writeFileSync(
      join(directory, source.frozenFileName),
      Papa.unparse(rowsBySource[source.name], { newline: "\n" }),
    );
  }

  const built = await buildTrustedMasterSnapshot(
    loadFrozenMasterRows(directory),
  );
  assert.equal(
    built.ok,
    true,
    built.ok ? undefined : JSON.stringify(built.issues),
  );
  const trusted = trustedBaselineRows(built.snapshot);
  const oraclePath = join(directory, "production-baselines.json");
  writeFileSync(
    oraclePath,
    JSON.stringify(trusted.map((row) => ({
      target_type: row.targetType,
      target_id: row.targetId,
      source_fingerprint: row.sourceFingerprint,
      misconception_ids: row.misconceptionIds,
    }))),
  );

  const matching = compareBaselineParity(
    parseProductionOracle(oraclePath),
    trusted,
  );
  assert.equal(parityPassed(matching), true);
  assert.deepEqual(matching, {
    storedTotal: 2,
    trustedTotal: 2,
    exactMatches: 2,
    fingerprintMismatches: { count: 0, targetIds: [] },
    storedOnlyTargets: { count: 0, targetIds: [] },
    trustedOnlyTargets: { count: 0, targetIds: [] },
    misconceptionIdMismatches: { count: 0, targetIds: [] },
  });

  const changedStored = [
    {
      ...trusted[0],
      sourceFingerprint: `sha256:${"0".repeat(64)}`,
      misconceptionIds: ["M-2"],
    },
    {
      targetType: "question",
      targetId: "Q-STORED-ONLY",
      sourceFingerprint: `sha256:${"1".repeat(64)}`,
      misconceptionIds: [],
    },
  ];
  const mismatch = compareBaselineParity(changedStored, trusted);
  assert.equal(parityPassed(mismatch), false);
  assert.deepEqual(mismatch.fingerprintMismatches, {
    count: 1,
    targetIds: ["question:Q-1"],
  });
  assert.deepEqual(mismatch.misconceptionIdMismatches, {
    count: 1,
    targetIds: ["question:Q-1"],
  });
  assert.deepEqual(mismatch.storedOnlyTargets, {
    count: 1,
    targetIds: ["question:Q-STORED-ONLY"],
  });
  assert.deepEqual(mismatch.trustedOnlyTargets, {
    count: 1,
    targetIds: ["answer:A-1"],
  });

  const csvOraclePath = join(directory, "production-baselines.csv");
  writeFileSync(
    csvOraclePath,
    Papa.unparse(trusted.map((row) => ({
      target_type: row.targetType,
      target_id: row.targetId,
      source_fingerprint: row.sourceFingerprint,
      misconception_ids: `{${row.misconceptionIds.join(",")}}`,
    }))),
  );
  assert.equal(parseProductionOracle(csvOraclePath).length, 2);
} finally {
  rmSync(directory, { recursive: true, force: true });
}

console.log("trusted master parity fixture checks passed");
