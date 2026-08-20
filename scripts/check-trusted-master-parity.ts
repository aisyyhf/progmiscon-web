import { readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Papa from "papaparse";

import {
  buildTrustedMasterSnapshot,
  type TrustedMasterRows,
  type TrustedMasterSnapshot,
} from "../supabase/functions/_shared/trustedMasterSync.ts";
import {
  MAX_CSV_BYTES,
  parseTrustedMasterCsv,
  TRUSTED_MASTER_SOURCE_DEFINITIONS,
} from "../supabase/functions/sync-review-master-data/index.ts";

type TargetType = "question" | "answer";

export type BaselineOracleRow = {
  targetType: TargetType;
  targetId: string;
  sourceFingerprint: string;
  misconceptionIds: string[];
};

export type ParityReport = {
  storedTotal: number;
  trustedTotal: number;
  exactMatches: number;
  fingerprintMismatches: { count: number; targetIds: string[] };
  storedOnlyTargets: { count: number; targetIds: string[] };
  trustedOnlyTargets: { count: number; targetIds: string[] };
  misconceptionIdMismatches: { count: number; targetIds: string[] };
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function targetKey(targetType: TargetType, targetId: string): string {
  return `${targetType}:${targetId}`;
}

function readBoundedLocalFile(path: string): string {
  if (statSync(path).size > MAX_CSV_BYTES) {
    throw new Error(`Local input exceeds ${MAX_CSV_BYTES} bytes: ${path}`);
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path));
}

function parseMisconceptionIds(value: unknown): string[] {
  let parsed: unknown = value;
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || text === "{}") return [];
    if (text.startsWith("[")) {
      parsed = JSON.parse(text);
    } else if (text.startsWith("{") && text.endsWith("}")) {
      const inner = text.slice(1, -1);
      if (/["\\]/.test(inner)) {
        throw new Error(
          "Quoted PostgreSQL array elements are unsupported; export JSON instead",
        );
      }
      parsed = inner ? inner.split(",") : [];
    } else {
      throw new Error("misconception_ids must be a JSON or PostgreSQL array");
    }
  }
  if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
    throw new Error("misconception_ids must contain only strings");
  }
  const ids = parsed.map((id) => id.trim());
  if (ids.some((id) => !id)) {
    throw new Error("misconception_ids must not contain blank IDs");
  }
  return ids.sort(compareText);
}

function parseOracleRecords(records: unknown): BaselineOracleRow[] {
  if (!Array.isArray(records)) {
    throw new Error("Production baseline export must be an array or CSV table");
  }
  const seen = new Set<string>();
  return records.map((record, index) => {
    if (!record || typeof record !== "object" || Array.isArray(record)) {
      throw new Error(`Oracle row ${index + 1} must be an object`);
    }
    const row = record as Record<string, unknown>;
    const targetType = String(row.target_type ?? "").trim() as TargetType;
    const targetId = String(row.target_id ?? "").trim();
    const sourceFingerprint = String(row.source_fingerprint ?? "").trim();
    if (targetType !== "question" && targetType !== "answer") {
      throw new Error(`Oracle row ${index + 1} has invalid target_type`);
    }
    if (!targetId) {
      throw new Error(`Oracle row ${index + 1} has blank target_id`);
    }
    if (!/^sha256:[0-9a-f]{64}$/.test(sourceFingerprint)) {
      throw new Error(
        `Oracle row ${index + 1} has invalid source_fingerprint`,
      );
    }
    const key = targetKey(targetType, targetId);
    if (seen.has(key)) {
      throw new Error(`Oracle contains duplicate target ${key}`);
    }
    seen.add(key);
    return {
      targetType,
      targetId,
      sourceFingerprint,
      misconceptionIds: parseMisconceptionIds(row.misconception_ids),
    };
  });
}

export function parseProductionOracle(path: string): BaselineOracleRow[] {
  const text = readBoundedLocalFile(path);
  if (extname(path).toLowerCase() === ".json") {
    return parseOracleRecords(JSON.parse(text));
  }
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.replace(/^\uFEFF/, "").trim(),
  });
  if (parsed.errors.length > 0) {
    throw new Error("Production baseline CSV could not be parsed");
  }
  return parseOracleRecords(parsed.data);
}

export function loadFrozenMasterRows(
  masterDirectory: string,
): TrustedMasterRows {
  return Object.fromEntries(
    TRUSTED_MASTER_SOURCE_DEFINITIONS.map((source) => {
      const path = join(masterDirectory, source.frozenFileName);
      return [
        source.name,
        parseTrustedMasterCsv(source, readBoundedLocalFile(path)),
      ];
    }),
  ) as TrustedMasterRows;
}

export function trustedBaselineRows(
  snapshot: TrustedMasterSnapshot,
): BaselineOracleRow[] {
  return [
    ...snapshot.questionBaselines.map((baseline) => ({
      targetType: "question" as const,
      targetId: baseline.question_id,
      sourceFingerprint: baseline.source_fingerprint,
      misconceptionIds: [...baseline.misconception_ids].sort(compareText),
    })),
    ...snapshot.answerBaselines.map((baseline) => ({
      targetType: "answer" as const,
      targetId: baseline.answer_id,
      sourceFingerprint: baseline.source_fingerprint,
      misconceptionIds: [...baseline.misconception_ids].sort(compareText),
    })),
  ];
}

export function compareBaselineParity(
  storedRows: BaselineOracleRow[],
  trustedRows: BaselineOracleRow[],
): ParityReport {
  const stored = new Map(
    storedRows.map((row) => [targetKey(row.targetType, row.targetId), row]),
  );
  const trusted = new Map(
    trustedRows.map((row) => [targetKey(row.targetType, row.targetId), row]),
  );
  const fingerprintMismatches: string[] = [];
  const misconceptionIdMismatches: string[] = [];
  const storedOnlyTargets: string[] = [];
  const trustedOnlyTargets: string[] = [];
  let exactMatches = 0;

  for (const [key, storedRow] of stored) {
    const trustedRow = trusted.get(key);
    if (!trustedRow) {
      storedOnlyTargets.push(key);
      continue;
    }
    const fingerprintMatches =
      storedRow.sourceFingerprint === trustedRow.sourceFingerprint;
    const idsMatch = JSON.stringify(storedRow.misconceptionIds) ===
      JSON.stringify(trustedRow.misconceptionIds);
    if (!fingerprintMatches) fingerprintMismatches.push(key);
    if (!idsMatch) misconceptionIdMismatches.push(key);
    if (fingerprintMatches && idsMatch) exactMatches += 1;
  }
  for (const key of trusted.keys()) {
    if (!stored.has(key)) trustedOnlyTargets.push(key);
  }

  fingerprintMismatches.sort(compareText);
  misconceptionIdMismatches.sort(compareText);
  storedOnlyTargets.sort(compareText);
  trustedOnlyTargets.sort(compareText);
  return {
    storedTotal: stored.size,
    trustedTotal: trusted.size,
    exactMatches,
    fingerprintMismatches: {
      count: fingerprintMismatches.length,
      targetIds: fingerprintMismatches,
    },
    storedOnlyTargets: {
      count: storedOnlyTargets.length,
      targetIds: storedOnlyTargets,
    },
    trustedOnlyTargets: {
      count: trustedOnlyTargets.length,
      targetIds: trustedOnlyTargets,
    },
    misconceptionIdMismatches: {
      count: misconceptionIdMismatches.length,
      targetIds: misconceptionIdMismatches,
    },
  };
}

export function parityPassed(report: ParityReport): boolean {
  return report.fingerprintMismatches.count === 0 &&
    report.storedOnlyTargets.count === 0 &&
    report.trustedOnlyTargets.count === 0 &&
    report.misconceptionIdMismatches.count === 0;
}

function parseArguments(
  args: string[],
): { oracle: string; masterDirectory: string } {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 2) {
    const name = args[index];
    const value = args[index + 1];
    if (!name?.startsWith("--") || !value) {
      throw new Error(
        "Usage: --oracle <baseline.csv|json> --master-dir <frozen-directory>",
      );
    }
    values.set(name, value);
  }
  const oracle = values.get("--oracle");
  const masterDirectory = values.get("--master-dir");
  if (!oracle || !masterDirectory || values.size !== 2) {
    throw new Error(
      "Usage: --oracle <baseline.csv|json> --master-dir <frozen-directory>",
    );
  }
  return { oracle: resolve(oracle), masterDirectory: resolve(masterDirectory) };
}

async function run(args: string[]): Promise<number> {
  const { oracle, masterDirectory } = parseArguments(args);
  const built = await buildTrustedMasterSnapshot(
    loadFrozenMasterRows(masterDirectory),
  );
  if (!built.ok) {
    throw new Error(
      `Frozen master validation failed: ${
        JSON.stringify(built.issues.slice(0, 20))
      }`,
    );
  }
  const report = compareBaselineParity(
    parseProductionOracle(oracle),
    trustedBaselineRows(built.snapshot),
  );
  console.log(JSON.stringify(report, null, 2));
  return parityPassed(report) ? 0 : 1;
}

if (
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  run(process.argv.slice(2)).then(
    (code) => {
      process.exitCode = code;
    },
    (error: unknown) => {
      console.error(
        error instanceof Error ? error.message : "Parity check failed",
      );
      process.exitCode = 2;
    },
  );
}
