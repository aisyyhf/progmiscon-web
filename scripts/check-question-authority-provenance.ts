import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canonicalizeQuestionAuthority,
  parseQuestionsCsv,
  QUESTION_AUTHORITY_CANONICALIZER_VERSION,
  reviewedSourceIdentitySha256,
  sha256Hex,
} from "../supabase/functions/_shared/questionAuthority.ts";

const EXPECTED_CANONICAL_SHA256 =
  "eaa8713da12956238fa4c57dbfd6710defcc7f81562ccdb257c5d290432dacc8";
const EXPECTED_STRUCTURED_IDS = [
  "Q154",
  "Q155",
  "Q156",
  "Q157",
  "Q159",
  "Q163",
  "Q164",
  "Q165",
];
const EXPECTED_SHEET_ID = 1427406797;
const EXPECTED_TITLE = "Progmiscon Master Data";
const EXPECTED_TAB = "questions";
const EXPECTED_RANGE = "'questions'!A:AK";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fixturePath = resolve(
  root,
  "checks/fixtures/admin-question-wording/questions.csv",
);
const manifestPath = resolve(
  root,
  "checks/fixtures/admin-question-wording/manifest.json",
);
const runtimeManifestPath = resolve(
  root,
  "supabase/functions/_shared/questionAuthorityManifest.ts",
);

type Manifest = {
  canonicalizerVersion: string;
  source: {
    spreadsheetTitle: string;
    questionsSheetId: number;
    tab: string;
    range: string;
    reviewedSourceIdentitySha256: string;
  };
  rawSnapshotSha256: string;
  canonicalSnapshotSha256: string;
  counts: {
    activeUniqueIds: number;
    ps: number;
    mp: number;
    editableRawSingleTextPs: number;
  };
  structuredReadOnlyPsIds: string[];
  localeCompleteness: {
    blankIndonesianIds: string[];
    blankEnglishIds: string[];
  };
  q074Editable: boolean;
  reviewedQuestionIds: string[];
};

function parseEnvFile(text: string): Record<string, string> {
  return Object.fromEntries(
    text.split(/\r?\n/).flatMap((raw) => {
      const line = raw.trim();
      if (!line || line.startsWith("#")) return [];
      const separator = line.indexOf("=");
      if (separator < 1) return [];
      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) value = value.slice(1, -1);
      return [[key, value]];
    }),
  );
}

async function buildManifest(
  raw: Uint8Array,
  spreadsheetId: string,
): Promise<Manifest> {
  const csv = new TextDecoder().decode(raw);
  const dataset = await canonicalizeQuestionAuthority(parseQuestionsCsv(csv));
  const active = dataset.rows.filter((row) => row.active);
  const ps = active.filter((row) => row.canonicalQuestionType === "PS");
  const mp = active.filter((row) => row.canonicalQuestionType === "MP");
  const editable = ps.filter((row) => row.editable);
  const structured = ps
    .filter((row) => !row.rawSingleText)
    .map((row) => row.values.question_id)
    .sort();
  const blankIndonesian = ps
    .filter((row) => row.rawSingleText && !row.values.question_ind)
    .map((row) => row.values.question_id);
  const blankEnglish = ps
    .filter((row) => row.rawSingleText && !row.values.question_en)
    .map((row) => row.values.question_id);
  const reviewedQuestionIds = active
    .map((row) => row.values.question_id)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

  assert.equal(active.length, 296, "authority fixture must have 296 active IDs");
  assert.equal(new Set(reviewedQuestionIds).size, 296, "active IDs must be unique");
  assert.equal(ps.length, 110, "authority fixture must have 110 PS questions");
  assert.equal(mp.length, 186, "authority fixture must have 186 MP questions");
  assert.equal(editable.length, 102, "authority fixture must have 102 editable PS questions");
  assert.deepEqual(structured, EXPECTED_STRUCTURED_IDS, "structured PS IDs changed");
  assert.deepEqual(blankIndonesian, [], "editable Indonesian wording must be complete");
  assert.deepEqual(blankEnglish, [], "editable English wording must be complete");
  assert.equal(dataset.byId.get("Q074")?.editable, true, "Q074 must remain editable");
  assert.equal(
    dataset.canonicalSha256,
    EXPECTED_CANONICAL_SHA256,
    "canonical authority snapshot changed",
  );

  return {
    canonicalizerVersion: QUESTION_AUTHORITY_CANONICALIZER_VERSION,
    source: {
      spreadsheetTitle: EXPECTED_TITLE,
      questionsSheetId: EXPECTED_SHEET_ID,
      tab: EXPECTED_TAB,
      range: EXPECTED_RANGE,
      reviewedSourceIdentitySha256: await reviewedSourceIdentitySha256({
        spreadsheetId,
        spreadsheetTitle: EXPECTED_TITLE,
        sheetId: EXPECTED_SHEET_ID,
        tab: EXPECTED_TAB,
        range: EXPECTED_RANGE,
      }),
    },
    rawSnapshotSha256: await sha256Hex(raw),
    canonicalSnapshotSha256: dataset.canonicalSha256,
    counts: {
      activeUniqueIds: active.length,
      ps: ps.length,
      mp: mp.length,
      editableRawSingleTextPs: editable.length,
    },
    structuredReadOnlyPsIds: structured,
    localeCompleteness: {
      blankIndonesianIds: blankIndonesian,
      blankEnglishIds: blankEnglish,
    },
    q074Editable: dataset.byId.get("Q074")?.editable === true,
    reviewedQuestionIds,
  };
}

function runtimeManifestSource(manifest: Manifest): string {
  return `// Generated by scripts/check-question-authority-provenance.ts.\n` +
    `// Runtime authority remains the live trusted Google read.\n` +
    `export const REVIEWED_QUESTION_SOURCE = ${JSON.stringify(manifest.source, null, 2)} as const;\n\n` +
    `export const REVIEWED_QUESTION_IDS = ${JSON.stringify(manifest.reviewedQuestionIds, null, 2)} as const;\n`;
}

async function refresh(): Promise<void> {
  const env = {
    ...parseEnvFile(await readFile(resolve(root, ".env.local"), "utf8")),
    ...process.env,
  };
  const spreadsheetId = env.PROGMISCON_GOOGLE_SPREADSHEET_ID?.trim();
  const configuredSheetId = env.PROGMISCON_GOOGLE_QUESTIONS_SHEET_ID?.trim();
  const publicUrlText = env.VITE_SHEET_QUESTIONS_URL?.trim();
  assert.ok(spreadsheetId, "PROGMISCON_GOOGLE_SPREADSHEET_ID is required to refresh provenance");
  assert.equal(configuredSheetId, String(EXPECTED_SHEET_ID));
  assert.ok(publicUrlText, "VITE_SHEET_QUESTIONS_URL is required to refresh provenance");
  const publicUrl = new URL(publicUrlText);
  assert.equal(publicUrl.hostname, "docs.google.com");
  assert.match(publicUrl.pathname, /^\/spreadsheets\/d\/e\/[^/]+\/pub$/);
  assert.equal(publicUrl.searchParams.get("gid"), String(EXPECTED_SHEET_ID));

  const response = await fetch(publicUrl, {
    headers: { "cache-control": "no-cache", pragma: "no-cache" },
  });
  assert.equal(response.ok, true, `published Questions fetch failed (${response.status})`);
  const raw = new Uint8Array(await response.arrayBuffer());
  const manifest = await buildManifest(raw, spreadsheetId);

  await mkdir(dirname(fixturePath), { recursive: true });
  await writeFile(fixturePath, raw);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(runtimeManifestPath, runtimeManifestSource(manifest));
}

async function check(): Promise<void> {
  const raw = new Uint8Array(await readFile(fixturePath));
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as Manifest;
  const spreadsheetId = process.env.PROGMISCON_GOOGLE_SPREADSHEET_ID?.trim();
  assert.ok(
    spreadsheetId,
    "PROGMISCON_GOOGLE_SPREADSHEET_ID is required to verify source identity",
  );
  const generated = await buildManifest(raw, spreadsheetId);
  assert.deepEqual(manifest, generated, "frozen manifest must be generated from questions.csv");
  assert.equal(
    await readFile(runtimeManifestPath, "utf8"),
    runtimeManifestSource(generated),
    "runtime membership/source binding must match the frozen manifest",
  );
  console.log("Question authority provenance checks passed", {
    rawSnapshotSha256: manifest.rawSnapshotSha256,
    canonicalSnapshotSha256: manifest.canonicalSnapshotSha256,
    counts: manifest.counts,
    structuredReadOnlyPsIds: manifest.structuredReadOnlyPsIds,
    q074Editable: manifest.q074Editable,
  });
}

if (process.argv.includes("--refresh")) await refresh();
await check();
