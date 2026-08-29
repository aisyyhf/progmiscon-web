#!/usr/bin/env node
// Progmiscon — STAGING baseline/catalog seed helper.
//
// WHAT IT DOES
//   Builds a master-content snapshot and calls ONE database function on the
//   staging project:  public.sync_master_relation_baselines_v2(jsonb, jsonb, text[])
//   That RPC (service_role only) creates/refreshes:
//     - question_misconception_baselines   (assigns source_version + source_fingerprint)
//     - answer_misconception_baselines     (assigns source_version + source_fingerprint)
//     - master_misconception_catalog
//   It writes NOTHING else. This script never touches question_reviews,
//   answer_reviews, review_audit_log, *_overrides, or *_content_overrides, and
//   never targets production.
//
// WHEN TO RUN
//   AFTER a staging Supabase project exists and staging-bootstrap.sql +
//   20260823000000_review_v3_epoch_guard.sql have been applied. Run it from an
//   operator machine / CI job — never from browser code.
//
// SAFETY
//   * Requires explicit STAGING_* environment variables; fails closed otherwise.
//   * Refuses to run if the target URL looks like the production project
//     (matches PRODUCTION_SUPABASE_URL / VITE_SUPABASE_URL when those are set).
//   * Requires --confirm <project-ref> on the CLI to equal the ref in
//     STAGING_SUPABASE_URL.
//   * Dry-run by default. Pass --apply to actually call the RPC.
//   * The service-role key is read from the environment only and is never
//     printed or written anywhere.
//
// USAGE
//   Dry run from live master sheets:
//     STAGING_SUPABASE_URL=https://<ref>.supabase.co \
//     STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
//     STAGING_SHEET_QUESTIONS_URL=... (+ the other STAGING_SHEET_* or VITE_SHEET_*) \
//     node database/staging/seed-baselines.mjs --confirm <ref> --source sheets
//
//   Apply from a local frozen master fixture directory:
//     STAGING_SUPABASE_URL=... STAGING_SUPABASE_SERVICE_ROLE_KEY=... \
//     node database/staging/seed-baselines.mjs --confirm <ref> \
//       --source frozen --dir /path/to/frozen-master --apply
//
// FINGERPRINT DESIGN (source_fingerprint)
//   Purpose: give sync_master_relation_baselines_v2 a value that changes iff the
//   source content of a row changes, so it can bump source_version and retire
//   stale reviews. Staging does NOT need to reproduce production fingerprint
//   values — only stable, deterministic change detection.
//
//   Value: lowercase hex SHA-256 of a canonical JSON string.
//
//   Question row canonical object:
//     { "k": "question",
//       "question_id": <trimmed>,
//       "misconception_ids": <normalized: trim each, drop blanks, dedupe, sort ascending>,
//       "question_ind": <canonical text or null>,
//       "question_en":  <canonical text or null>,
//       "question_code":<canonical text or null> }
//
//   Answer row canonical object:
//     { "k": "answer",
//       "answer_id": <trimmed>,
//       "question_id": <trimmed>,
//       "misconception_ids": <normalized as above>,
//       "answer_text": <canonical text or null> }
//
//   Text canonicalization: Unicode NFC, CRLF/CR -> LF, strip a UTF-8 BOM,
//   trim leading/trailing whitespace; empty -> null.
//   JSON: keys emitted in the fixed order shown above; arrays already sorted;
//   JSON.stringify with no spaces. Same input bytes => same fingerprint on any
//   machine and any run.

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { argv, env, exit } from "node:process";

// ---------------------------------------------------------------------------
// tiny CSV reader (no external dependency; master sheets are simple CSV)
// ---------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i += 1) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; } else { inQuotes = false; }
      } else { field += c; }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      record.push(field); field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i += 1;
      record.push(field); field = "";
      if (record.length > 1 || record[0] !== "") rows.push(record);
      record = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || record.length > 0) { record.push(field); rows.push(record); }
  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = r[idx] ?? ""; });
    return obj;
  });
}

function canonText(value) {
  if (value === undefined || value === null) return null;
  const s = String(value)
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .normalize("NFC")
    .trim();
  return s.length === 0 ? null : s;
}

function normalizeIds(ids) {
  return [...new Set(ids.map((x) => String(x).trim()).filter((x) => x.length > 0))]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function fingerprint(canonicalObject) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalObject), "utf8")
    .digest("hex");
}

function isTruthyActive(value) {
  const v = String(value ?? "").trim().toLowerCase();
  return v === "" || v === "1" || v === "true" || v === "yes" || v === "y" || v === "active";
}

// ---------------------------------------------------------------------------
// arguments + environment
// ---------------------------------------------------------------------------
function getArg(name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}
const APPLY = argv.includes("--apply");
const SOURCE = getArg("--source") ?? "sheets";
const FROZEN_DIR = getArg("--dir");
const CONFIRM_REF = getArg("--confirm");

function fail(message) {
  console.error(`seed-baselines: ${message}`);
  exit(1);
}

const STAGING_URL = env.STAGING_SUPABASE_URL?.trim();
const STAGING_KEY = env.STAGING_SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!STAGING_URL) fail("STAGING_SUPABASE_URL is not set (fail closed).");
if (!STAGING_KEY) fail("STAGING_SUPABASE_SERVICE_ROLE_KEY is not set (fail closed).");
if (!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in|net)\/?$/i.test(STAGING_URL)) {
  fail(`STAGING_SUPABASE_URL does not look like a Supabase project URL: ${STAGING_URL}`);
}

const stagingRef = new URL(STAGING_URL).host.split(".")[0];

if (!CONFIRM_REF) fail("pass --confirm <project-ref> matching STAGING_SUPABASE_URL.");
if (CONFIRM_REF !== stagingRef) {
  fail(`--confirm "${CONFIRM_REF}" does not match STAGING_SUPABASE_URL ref "${stagingRef}".`);
}

for (const guardName of ["PRODUCTION_SUPABASE_URL", "VITE_SUPABASE_URL"]) {
  const guardValue = env[guardName]?.trim();
  if (guardValue && new URL(guardValue).host === new URL(STAGING_URL).host) {
    fail(`refusing to run: STAGING_SUPABASE_URL host matches ${guardName}. This must be a dedicated staging project.`);
  }
}

// ---------------------------------------------------------------------------
// load master content
// ---------------------------------------------------------------------------
async function loadCsvBySource(logicalName, envNames, frozenFile) {
  if (SOURCE === "frozen") {
    if (!FROZEN_DIR) fail("--source frozen requires --dir <frozen-master-dir>.");
    return parseCsv(readFileSync(join(FROZEN_DIR, frozenFile), "utf8"));
  }
  if (SOURCE === "sheets") {
    const url = envNames.map((n) => env[n]?.trim()).find(Boolean);
    if (!url) fail(`no URL for ${logicalName}: set one of ${envNames.join(" / ")}.`);
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) fail(`fetch ${logicalName} failed: HTTP ${response.status}`);
    return parseCsv(await response.text());
  }
  fail(`unknown --source "${SOURCE}" (expected "sheets" or "frozen").`);
  return [];
}

const [questions, answers, questionMisc, answerMisc, misconceptions] = await Promise.all([
  loadCsvBySource("questions", ["STAGING_SHEET_QUESTIONS_URL", "VITE_SHEET_QUESTIONS_URL"], "questions.csv"),
  loadCsvBySource("answers", ["STAGING_SHEET_ANSWERS_URL", "VITE_SHEET_ANSWERS_URL"], "answers.csv"),
  loadCsvBySource("question_misconceptions", ["STAGING_SHEET_QUESTION_MISCONCEPTIONS_URL", "VITE_SHEET_QUESTION_MISCONCEPTIONS_URL"], "question_misconceptions.csv"),
  loadCsvBySource("answer_misconceptions", ["STAGING_SHEET_ANSWER_MISCONCEPTIONS_URL", "VITE_SHEET_ANSWER_MISCONCEPTIONS_URL"], "answer_misconceptions.csv"),
  loadCsvBySource("misconceptions", ["STAGING_SHEET_MISCONCEPTIONS_URL", "VITE_SHEET_MISCONCEPTIONS_URL"], "misconceptions.csv"),
]);

const pick = (row, ...names) => {
  for (const n of names) if (row[n] !== undefined && String(row[n]).trim() !== "") return String(row[n]).trim();
  return "";
};

const misconceptionIds = normalizeIds(
  misconceptions.map((m) => pick(m, "misconception_id", "id", "kode", "code")),
);
const misconceptionSet = new Set(misconceptionIds);

const activeQuestionIds = new Set(
  questions
    .filter((q) => isTruthyActive(q.active ?? q.is_active))
    .map((q) => pick(q, "question_id", "id"))
    .filter(Boolean),
);

const questionMiscMap = new Map();
for (const rel of questionMisc) {
  const qid = pick(rel, "question_id");
  const mid = pick(rel, "misconception_id");
  if (!activeQuestionIds.has(qid) || !misconceptionSet.has(mid)) continue;
  if (!isTruthyActive(rel.active ?? rel.is_active)) continue;
  if (!questionMiscMap.has(qid)) questionMiscMap.set(qid, []);
  questionMiscMap.get(qid).push(mid);
}

const answerParent = new Map();
for (const a of answers) {
  const aid = pick(a, "answer_id", "id");
  const qid = pick(a, "question_id");
  if (!aid || !activeQuestionIds.has(qid)) continue;
  if (!isTruthyActive(a.active ?? a.is_active)) continue;
  answerParent.set(aid, { questionId: qid, text: canonText(pick(a, "answer_text", "text", "jawaban")) });
}

const answerMiscMap = new Map();
for (const rel of answerMisc) {
  const aid = pick(rel, "answer_id");
  const mid = pick(rel, "misconception_id");
  if (!answerParent.has(aid) || !misconceptionSet.has(mid)) continue;
  if (!isTruthyActive(rel.active ?? rel.is_active)) continue;
  if (!answerMiscMap.has(aid)) answerMiscMap.set(aid, []);
  answerMiscMap.get(aid).push(mid);
}

const questionContent = new Map(
  questions.map((q) => [
    pick(q, "question_id", "id"),
    {
      ind: canonText(pick(q, "question_ind", "soal_ind", "pertanyaan_ind")),
      en: canonText(pick(q, "question_en", "soal_en", "pertanyaan_en")),
      code: canonText(pick(q, "question_code", "kode", "pseudocode")),
    },
  ]),
);

// ---------------------------------------------------------------------------
// build the v2 payload
// ---------------------------------------------------------------------------
const questionBaselines = [...activeQuestionIds].sort().map((questionId) => {
  const ids = normalizeIds(questionMiscMap.get(questionId) ?? []);
  const content = questionContent.get(questionId) ?? { ind: null, en: null, code: null };
  const canonical = {
    k: "question",
    question_id: questionId,
    misconception_ids: ids,
    question_ind: content.ind,
    question_en: content.en,
    question_code: content.code,
  };
  return { question_id: questionId, misconception_ids: ids, source_fingerprint: fingerprint(canonical) };
});

const answerBaselines = [...answerParent.keys()].sort().map((answerId) => {
  const parent = answerParent.get(answerId);
  const ids = normalizeIds(answerMiscMap.get(answerId) ?? []);
  const canonical = {
    k: "answer",
    answer_id: answerId,
    question_id: parent.questionId,
    misconception_ids: ids,
    answer_text: parent.text,
  };
  return {
    answer_id: answerId,
    question_id: parent.questionId,
    misconception_ids: ids,
    source_fingerprint: fingerprint(canonical),
  };
});

console.log(
  `built snapshot: ${questionBaselines.length} questions, ${answerBaselines.length} answers, ${misconceptionIds.length} misconceptions`,
);
console.log(`target: ${stagingRef}.supabase.co   source: ${SOURCE}   mode: ${APPLY ? "APPLY" : "dry-run"}`);

if (!APPLY) {
  console.log("dry run — no RPC call made. Re-run with --apply to sync.");
  console.log(
    JSON.stringify(
      {
        sample_question: questionBaselines[0],
        sample_answer: answerBaselines[0],
      },
      null,
      2,
    ),
  );
  exit(0);
}

// ---------------------------------------------------------------------------
// apply — the ONLY write this script performs
// ---------------------------------------------------------------------------
const { createClient } = await import("@supabase/supabase-js");
const client = createClient(STAGING_URL, STAGING_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SEED_RPC = "sync_master_relation_baselines_v2";
const { data, error } = await client.rpc(SEED_RPC, {
  input_question_baselines: questionBaselines,
  input_answer_baselines: answerBaselines,
  input_misconception_ids: misconceptionIds,
});

if (error) {
  console.error(`${SEED_RPC} failed: ${error.message}`);
  exit(1);
}

console.log(`${SEED_RPC} ok:`, JSON.stringify(data));
