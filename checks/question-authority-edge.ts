import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  canonicalizeQuestionAuthority,
  parseQuestionsCsv,
  QuestionAuthorityError,
} from "../supabase/functions/_shared/questionAuthority.ts";
import {
  readTrustedGoogleQuestionAuthority,
  type GoogleQuestionAuthorityConfig,
} from "../supabase/functions/_shared/googleQuestionAuthority.ts";
import {
  REVIEWED_QUESTION_IDS,
  REVIEWED_QUESTION_SOURCE,
} from "../supabase/functions/_shared/questionAuthorityManifest.ts";
import {
  AdminQuestionWordingError,
  createAdminQuestionWordingHandler,
  type AdminQuestionWordingDependencies,
} from "../supabase/functions/admin-question-wording/handler.ts";

const fixture = await readFile(
  resolve("checks/fixtures/admin-question-wording/questions.csv"),
  "utf8",
);
const matrix = parseQuestionsCsv(fixture);
const dataset = await canonicalizeQuestionAuthority(matrix);
assert.equal(
  dataset.canonicalSha256,
  "eaa8713da12956238fa4c57dbfd6710defcc7f81562ccdb257c5d290432dacc8",
);
assert.equal(dataset.byId.get("Q074")?.editable, true);
assert.equal(dataset.byId.get("Q020")?.blockedReason, "QUESTION_TYPE_NOT_SUPPORTED");
assert.equal(dataset.byId.get("Q154")?.blockedReason, "STRUCTURED_CONTENT_NOT_SUPPORTED");

const headerIndex = new Map(matrix[0].map((header, index) => [header, index]));
const copyMatrix = () => matrix.map((row) => [...row]);
const rowFor = (copy: string[][], questionId: string) => {
  const idColumn = headerIndex.get("question_id")!;
  const row = copy.find((item) => item[idColumn] === questionId);
  assert.ok(row, `${questionId} fixture row exists`);
  return row;
};
const targetHash = async (copy: string[][], questionId: string) =>
  (await canonicalizeQuestionAuthority(copy)).byId.get(questionId)?.targetSha256;
const nestedNumberBlock = (number: string) =>
  `[{"type":"text","content":"x","meta":{"values":[${number}]}}]`;
const targetHashForNumber = async (number: string) => {
  const copy = copyMatrix();
  rowFor(copy, "Q074")[headerIndex.get("content_blocks_ind")!] =
    nestedNumberBlock(number);
  return targetHash(copy, "Q074");
};
const rejectsLossyNumber = async (number: string, name = number) => {
  const copy = copyMatrix();
  rowFor(copy, "Q074")[headerIndex.get("content_blocks_ind")!] =
    nestedNumberBlock(number);
  await assert.rejects(
    canonicalizeQuestionAuthority(copy),
    (error: unknown) =>
      error instanceof QuestionAuthorityError &&
      error.code === "MALFORMED_STRUCTURAL_JSON",
    `${name} fails closed before producing a target SHA`,
  );
};

const q074Hash = dataset.byId.get("Q074")!.targetSha256;
for (const [field, mutate] of [
  ["question_ind", (value: string) => `${value} changed`],
  ["question_en", (value: string) => `${value} changed`],
  ["question_code", (value: string) => `${value}\n# changed`],
] as const) {
  const changed = copyMatrix();
  const column = headerIndex.get(field)!;
  const row = rowFor(changed, "Q074");
  row[column] = mutate(row[column]);
  assert.notEqual(await targetHash(changed, "Q074"), q074Hash, `${field} changes target SHA`);
}

for (const field of ["active", "data_status", "title_en", "lms_question_id"] as const) {
  const changed = copyMatrix();
  const row = rowFor(changed, "Q074");
  const column = headerIndex.get(field)!;
  row[column] = field === "active" ? "false" : `${row[column]} changed`;
  assert.notEqual(await targetHash(changed, "Q074"), q074Hash, `${field} changes target SHA`);
}

const acceptedNumberHashes = new Map<string, string | undefined>();
for (const number of [
  "0",
  "-0",
  "1",
  "-1",
  "1.5",
  "-1.5",
  "1e3",
  "1E3",
  "1e+3",
  "1e-3",
  "0.1",
  "9007199254740992",
  "-9007199254740992",
]) {
  acceptedNumberHashes.set(number, await targetHashForNumber(number));
}
assert.equal(acceptedNumberHashes.get("0"), acceptedNumberHashes.get("-0"));
assert.equal(acceptedNumberHashes.get("1e3"), acceptedNumberHashes.get("1E3"));
assert.equal(acceptedNumberHashes.get("1e3"), acceptedNumberHashes.get("1e+3"));
const distinctAcceptedNumbers = [
  "0",
  "1",
  "-1",
  "1.5",
  "-1.5",
  "1e3",
  "1e-3",
  "0.1",
  "9007199254740992",
  "-9007199254740992",
] as const;
assert.equal(
  new Set(distinctAcceptedNumbers.map((number) => acceptedNumberHashes.get(number))).size,
  distinctAcceptedNumbers.length,
  "every accepted mathematically distinct number produces a distinct target SHA",
);

for (const [number, name] of [
  ["9007199254740993", "positive unsafe integer"],
  ["-9007199254740993", "negative unsafe integer"],
  ["1e9999", "overflow versus null"],
  ["1e-9999", "underflow versus zero"],
  ["1e100000", "very large positive exponent"],
  ["1e-100000", "very large negative exponent"],
  ["0.10000000000000001", "decimal beyond IEEE-754 precision"],
] as const) {
  await rejectsLossyNumber(number, name);
}
for (const number of ["01", "+1", ".5", "1.", "1e", "--1"]) {
  await rejectsLossyNumber(number, `invalid JSON number ${number}`);
}

const sampleNumber = copyMatrix();
rowFor(sampleNumber, "Q074")[headerIndex.get("sample_inputs")!] = "[1.5]";
rowFor(sampleNumber, "Q074")[headerIndex.get("sample_outputs")!] = "[-1.5]";
assert.ok(await targetHash(sampleNumber, "Q074"), "numeric array values are accepted losslessly");

const testCaseNumber = copyMatrix();
rowFor(testCaseNumber, "Q074")[headerIndex.get("test_cases_json")!] =
  '[{"input":"x","output":"y","case_no":2,"meta":{"probe":1e3}}]';
assert.ok(await targetHash(testCaseNumber, "Q074"), "nested test-case numbers are accepted losslessly");

for (const field of [
  "content_blocks_ind",
  "content_blocks_en",
  "sample_inputs",
  "sample_outputs",
  "test_cases_json",
  "options_json",
] as const) {
  const copy = copyMatrix();
  const questionId = field === "options_json" ? "Q020" : "Q074";
  const row = rowFor(copy, questionId);
  const column = headerIndex.get(field)!;
  if (field === "content_blocks_ind" || field === "content_blocks_en") {
    row[column] = nestedNumberBlock("1e9999");
  } else if (field === "sample_inputs" || field === "sample_outputs") {
    row[headerIndex.get("sample_inputs")!] = field === "sample_inputs"
      ? "[1e9999]"
      : "[0]";
    row[headerIndex.get("sample_outputs")!] = field === "sample_outputs"
      ? "[1e9999]"
      : "[0]";
  } else if (field === "test_cases_json") {
    row[column] = '[{"input":"x","output":"y","meta":{"probe":1e9999}}]';
  } else {
    row[column] = row[column].replace(/^\[\{/, '[{"numeric_probe":1e9999,');
  }
  await assert.rejects(
    canonicalizeQuestionAuthority(copy),
    (error: unknown) =>
      error instanceof QuestionAuthorityError &&
      error.code === "MALFORMED_STRUCTURAL_JSON",
    `${field} uses the shared fail-closed numeric parser`,
  );
}

const typeChanged = copyMatrix();
rowFor(typeChanged, "Q020")[headerIndex.get("question_type")!] = "PS";
assert.notEqual(
  await targetHash(typeChanged, "Q020"),
  dataset.byId.get("Q020")!.targetSha256,
  "type mutation changes target SHA",
);

const blockChanged = copyMatrix();
const structuredField = "content_blocks_en";
const structuredBlocks = JSON.parse(
  rowFor(blockChanged, "Q154")[headerIndex.get(structuredField)!],
) as unknown[];
assert.ok(structuredBlocks.length > 1);
rowFor(blockChanged, "Q154")[headerIndex.get(structuredField)!] =
  JSON.stringify([...structuredBlocks].reverse());
assert.notEqual(
  await targetHash(blockChanged, "Q154"),
  dataset.byId.get("Q154")!.targetSha256,
  "block order changes target SHA",
);

const optionsChanged = copyMatrix();
const optionColumn = headerIndex.get("options_json")!;
const options = JSON.parse(rowFor(optionsChanged, "Q020")[optionColumn]) as Array<
  Record<string, unknown>
>;
options[0].text = `${String(options[0].text)} changed`;
rowFor(optionsChanged, "Q020")[optionColumn] = JSON.stringify(options);
assert.notEqual(
  await targetHash(optionsChanged, "Q020"),
  dataset.byId.get("Q020")!.targetSha256,
  "option mutation changes target SHA",
);

const correctAnswerChanged = copyMatrix();
const correctOptions = JSON.parse(
  rowFor(correctAnswerChanged, "Q020")[optionColumn],
) as Array<Record<string, unknown>>;
const currentCorrectLabel = rowFor(
  correctAnswerChanged,
  "Q020",
)[headerIndex.get("correct_option_label")!];
const alternativeCorrectOption = correctOptions.find(
  (option) => String(option.label) !== currentCorrectLabel,
);
assert.ok(alternativeCorrectOption);
rowFor(correctAnswerChanged, "Q020")[headerIndex.get("correct_option_label")!] =
  String(alternativeCorrectOption.label);
assert.notEqual(
  await targetHash(correctAnswerChanged, "Q020"),
  dataset.byId.get("Q020")!.targetSha256,
  "correct-answer mutation changes target SHA",
);

const sampleChanged = copyMatrix();
const sampleRow = sampleChanged.slice(1).find((row) => {
  const inputs = row[headerIndex.get("sample_inputs")!];
  const outputs = row[headerIndex.get("sample_outputs")!];
  return inputs?.startsWith("[") && outputs?.startsWith("[");
});
assert.ok(sampleRow);
const sampleId = sampleRow[headerIndex.get("question_id")!];
const sampleInputs = JSON.parse(sampleRow[headerIndex.get("sample_inputs")!]) as unknown[];
const sampleOutputs = JSON.parse(sampleRow[headerIndex.get("sample_outputs")!]) as unknown[];
sampleInputs.push("authority-test-input");
sampleOutputs.push("authority-test-output");
sampleRow[headerIndex.get("sample_inputs")!] = JSON.stringify(sampleInputs);
sampleRow[headerIndex.get("sample_outputs")!] = JSON.stringify(sampleOutputs);
assert.notEqual(
  await targetHash(sampleChanged, sampleId),
  dataset.byId.get(sampleId)!.targetSha256,
  "sample mutation changes target SHA",
);

const testCaseChanged = copyMatrix();
const testRow = testCaseChanged.slice(1).find((row) => {
  const raw = row[headerIndex.get("test_cases_json")!];
  return raw?.startsWith("[") && raw !== "[]";
});
assert.ok(testRow);
const testId = testRow[headerIndex.get("question_id")!];
const testCases = JSON.parse(testRow[headerIndex.get("test_cases_json")!]) as Array<
  Record<string, unknown>
>;
testCases[0].output = `${String(testCases[0].output)} changed`;
testRow[headerIndex.get("test_cases_json")!] = JSON.stringify(testCases);
assert.notEqual(
  await targetHash(testCaseChanged, testId),
  dataset.byId.get(testId)!.targetSha256,
  "test-case mutation changes target SHA",
);

const malformed = copyMatrix();
rowFor(malformed, "Q074")[headerIndex.get("content_blocks_ind")!] = "{";
await assert.rejects(
  canonicalizeQuestionAuthority(malformed),
  (error: unknown) =>
    error instanceof QuestionAuthorityError &&
    error.code === "MALFORMED_STRUCTURAL_JSON",
);

const duplicateJsonFields = [
  "content_blocks_ind",
  "content_blocks_en",
  "sample_inputs",
  "sample_outputs",
  "test_cases_json",
  "options_json",
] as const;
for (const field of duplicateJsonFields) {
  const duplicate = copyMatrix();
  rowFor(duplicate, "Q074")[headerIndex.get(field)!] =
    '{"duplicate":1,"duplicate":1}';
  await assert.rejects(
    canonicalizeQuestionAuthority(duplicate),
    (error: unknown) =>
      error instanceof QuestionAuthorityError &&
      error.code === "MALFORMED_STRUCTURAL_JSON" &&
      error.message.includes("duplicate object key"),
    `${field} rejects identical duplicate keys`,
  );
}

for (const [name, raw] of [
  ["differing top-level values", '[{"type":"text","type":"code","content":"x"}]'],
  ["nested duplicate", '[{"type":"text","content":"x","meta":{"key":1,"key":2}}]'],
  ["escaped-equivalent duplicate", '[{"type":"text","content":"x","meta":{"key":1,"\\u006bey":1}}]'],
] as const) {
  const duplicate = copyMatrix();
  rowFor(duplicate, "Q074")[headerIndex.get("content_blocks_ind")!] = raw;
  await assert.rejects(
    canonicalizeQuestionAuthority(duplicate),
    (error: unknown) =>
      error instanceof QuestionAuthorityError &&
      error.message.includes("duplicate object key"),
    name,
  );
}

const siblingKeys = copyMatrix();
rowFor(siblingKeys, "Q074")[headerIndex.get("content_blocks_ind")!] =
  '[{"type":"text","content":"x","left":{"same":1},"right":{"same":2}}]';
assert.equal(
  await targetHash(siblingKeys, "Q074"),
  await targetHash(siblingKeys, "Q074"),
  "the same key in separate sibling objects remains valid and deterministic",
);

const unrelated = copyMatrix();
rowFor(unrelated, "Q075")[headerIndex.get("question_en")!] += " unrelated";
assert.equal(
  await targetHash(unrelated, "Q074"),
  q074Hash,
  "unrelated question mutation leaves Q074 target SHA unchanged",
);

const lineEndingSource = matrix.slice(1).find((row) =>
  row.some((cell) => typeof cell === "string" && cell.includes("\n"))
);
assert.ok(lineEndingSource, "fixture has a multiline value for line-ending test");
const lineEndingId = lineEndingSource[headerIndex.get("question_id")!];
const lineEndings = copyMatrix();
const lineEndingTarget = rowFor(lineEndings, lineEndingId);
for (let index = 0; index < lineEndingTarget.length; index += 1) {
  lineEndingTarget[index] = lineEndingTarget[index].replace(/\n/g, "\r\n");
}
assert.equal(
  await targetHash(lineEndings, lineEndingId),
  dataset.byId.get(lineEndingId)!.targetSha256,
  "CRLF and LF canonicalize identically",
);

const actorId = "00000000-0000-4000-8000-000000000011";
let saveCalls = 0;
const baseDependencies = (): AdminQuestionWordingDependencies => ({
  allowedOrigin: "https://app.example.invalid",
  reviewedQuestionIds: new Set(REVIEWED_QUESTION_IDS),
  authenticate: async () => ({ id: actorId }),
  actorIsAuthorized: async () => true,
  readAuthority: async () => ({ dataset, driveVersion: "169" }),
  readDriveVersion: async () => "169",
  loadOverride: async () => null,
  saveOverride: async (input) => {
    saveCalls += 1;
    assert.equal(input.trustedQuestionInd, dataset.byId.get(input.questionId)!.values.question_ind);
    assert.equal(input.trustedQuestionEn, dataset.byId.get(input.questionId)!.values.question_en);
    return {
      questionId: input.questionId,
      questionInd: input.questionInd,
      questionEn: input.questionEn,
      contentVersion: "10000000-0000-4000-8000-000000000001",
      updatedAt: "2026-08-25T00:00:00.000Z",
    };
  },
});
const invoke = async (
  body: Record<string, unknown>,
  overrides: Partial<AdminQuestionWordingDependencies> = {},
  requestOverrides: { origin?: string; authorization?: string } = {},
) => {
  const handler = createAdminQuestionWordingHandler({
    ...baseDependencies(),
    ...overrides,
  });
  const response = await handler(new Request("https://edge.example.invalid", {
    method: "POST",
    headers: {
      origin: requestOverrides.origin ?? "https://app.example.invalid",
      authorization: requestOverrides.authorization ?? "Bearer valid-token",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }));
  return { response, body: await response.json() as Record<string, unknown> };
};

const q074Load = await invoke({ action: "load", questionId: "Q074" });
assert.equal(q074Load.response.status, 200);
assert.equal((q074Load.body.data as Record<string, unknown>).editable, true);

const mpLoad = await invoke({ action: "load", questionId: "Q020" });
assert.equal((mpLoad.body.data as Record<string, unknown>).editable, false);
assert.equal(
  (mpLoad.body.data as Record<string, unknown>).readOnlyReason,
  "QUESTION_TYPE_NOT_SUPPORTED",
);
const structuredLoad = await invoke({ action: "load", questionId: "Q154" });
assert.equal(
  (structuredLoad.body.data as Record<string, unknown>).readOnlyReason,
  "STRUCTURED_CONTENT_NOT_SUPPORTED",
);

const saveBody = {
  action: "save",
  questionId: "Q074",
  expectedAuthoritySha256: q074Hash,
  expectedOverrideVersion: null,
  questionInd: "Wording Indonesia baru",
  questionEn: "New English wording",
};
saveCalls = 0;
assert.equal((await invoke(saveBody)).response.status, 200);
assert.equal(saveCalls, 1, "Q074 reaches the trusted save exactly once");

for (const [name, expectedStatus, result] of [
  ["anonymous", 401, await invoke({ action: "load", questionId: "Q074" }, {}, { authorization: "" })],
  ["malformed token", 401, await invoke(
    { action: "load", questionId: "Q074" },
    { authenticate: async () => null },
    { authorization: "Bearer malformed-token" },
  )],
  ["expired token", 401, await invoke(
    { action: "load", questionId: "Q074" },
    { authenticate: async () => null },
    { authorization: "Bearer expired-token" },
  )],
  ["inactive lecturer", 403, await invoke(
    { action: "load", questionId: "Q074" },
    { actorIsAuthorized: async () => false },
  )],
  ["inactive allowlist", 403, await invoke(
    { action: "load", questionId: "Q074" },
    { actorIsAuthorized: async () => false },
  )],
  ["authenticated non-admin", 403, await invoke(
    { action: "load", questionId: "Q074" },
    { actorIsAuthorized: async () => false },
  )],
  ["wrong origin", 403, await invoke(
    { action: "load", questionId: "Q074" },
    {},
    { origin: "https://evil.example.invalid" },
  )],
  ["unreviewed ID", 404, await invoke({ action: "load", questionId: "Q999" })],
] as const) {
  assert.equal(result.response.status, expectedStatus, `${name} fails closed`);
}

const forged = await invoke({
  ...saveBody,
  canonicalType: "PS",
  editable: true,
  trustedQuestionInd: "browser must not supply trusted authority",
});
assert.equal(forged.response.status, 400, "forged client authority fields are rejected");

saveCalls = 0;
const forgedSha = await invoke({
  ...saveBody,
  expectedAuthoritySha256: "0".repeat(64),
});
assert.equal(forgedSha.response.status, 409);
assert.equal(forgedSha.body.error, "SOURCE_CHANGED_RELOAD_REQUIRED");
assert.equal(saveCalls, 0);

saveCalls = 0;
const finalFence = await invoke(saveBody, { readDriveVersion: async () => "170" });
assert.equal(finalFence.response.status, 409);
assert.equal(saveCalls, 0, "final Drive fence blocks the DB mutation");

saveCalls = 0;
const authorityUnavailable = await invoke(saveBody, {
  readAuthority: async () => {
    throw new Error("private upstream detail");
  },
});
assert.equal(authorityUnavailable.response.status, 503);
assert.deepEqual(authorityUnavailable.body, { error: "AUTHORITY_UNAVAILABLE" });
assert.equal(saveCalls, 0);

const staleOverride = await invoke(saveBody, {
  saveOverride: async () => {
    throw new AdminQuestionWordingError("OVERRIDE_CHANGED_RELOAD_REQUIRED", 409);
  },
});
assert.equal(staleOverride.body.error, "OVERRIDE_CHANGED_RELOAD_REQUIRED");

for (const field of ["questionInd", "questionEn"] as const) {
  saveCalls = 0;
  const blank = await invoke({ ...saveBody, [field]: "   " });
  assert.equal(blank.response.status, 400);
  assert.equal(saveCalls, 0);
}

const mpSave = await invoke({
  ...saveBody,
  questionId: "Q020",
  expectedAuthoritySha256: dataset.byId.get("Q020")!.targetSha256,
});
assert.equal(mpSave.body.error, "QUESTION_TYPE_NOT_SUPPORTED");
const structuredSave = await invoke({
  ...saveBody,
  questionId: "Q154",
  expectedAuthoritySha256: dataset.byId.get("Q154")!.targetSha256,
});
assert.equal(structuredSave.body.error, "STRUCTURED_CONTENT_NOT_SUPPORTED");

const generatedKey = await crypto.subtle.generateKey(
  { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
  true,
  ["sign", "verify"],
);
const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", generatedKey.privateKey));
const privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(pkcs8).toString("base64")}\n-----END PRIVATE KEY-----`;
const googleConfig: GoogleQuestionAuthorityConfig = {
  credential: { type: "service_account", client_email: "authority@example.invalid", private_key: privateKey },
  spreadsheetId: "test-spreadsheet-id",
  spreadsheetTitle: REVIEWED_QUESTION_SOURCE.spreadsheetTitle,
  sheetId: REVIEWED_QUESTION_SOURCE.questionsSheetId,
  tab: REVIEWED_QUESTION_SOURCE.tab,
  range: REVIEWED_QUESTION_SOURCE.range,
  reviewedSourceIdentitySha256: await (async () => {
    const { reviewedSourceIdentitySha256 } = await import(
      "../supabase/functions/_shared/questionAuthority.ts"
    );
    return reviewedSourceIdentitySha256({
      spreadsheetId: "test-spreadsheet-id",
      spreadsheetTitle: REVIEWED_QUESTION_SOURCE.spreadsheetTitle,
      sheetId: REVIEWED_QUESTION_SOURCE.questionsSheetId,
      tab: REVIEWED_QUESTION_SOURCE.tab,
      range: REVIEWED_QUESTION_SOURCE.range,
    });
  })(),
};

function googleFetcher(
  versions: string[],
  options: {
    wrongTitle?: boolean;
    columnCount?: number;
    values?: string[][];
  } = {},
): {
  fetcher: typeof fetch;
  calls: string[];
} {
  const calls: string[] = [];
  let versionIndex = 0;
  const fetcher = async (input: string | URL | Request) => {
    const url = String(input);
    if (url === "https://oauth2.googleapis.com/token") {
      calls.push("token");
      return Response.json({ access_token: "redacted-test-token" });
    }
    if (url.includes("sheets.googleapis.com/v4/spreadsheets/") && !url.includes("/values/")) {
      calls.push("metadata");
      return Response.json({
        spreadsheetId: googleConfig.spreadsheetId,
        properties: { title: options.wrongTitle ? "Wrong" : googleConfig.spreadsheetTitle },
        sheets: [{ properties: {
          sheetId: googleConfig.sheetId,
          title: googleConfig.tab,
          sheetType: "GRID",
          gridProperties: { rowCount: 1000, columnCount: options.columnCount ?? 37 },
        } }],
      });
    }
    if (url.includes("fields=id%2Cname%2CmimeType%2Ctrashed")) {
      calls.push("identity");
      return Response.json({
        id: googleConfig.spreadsheetId,
        name: googleConfig.spreadsheetTitle,
        mimeType: "application/vnd.google-apps.spreadsheet",
        trashed: false,
      });
    }
    if (url.includes("/values/")) {
      calls.push("values");
      assert.ok(
        url.includes(encodeURIComponent(googleConfig.range)),
        "trusted values read uses the reviewed exact A:AK range",
      );
      return Response.json({ values: options.values ?? matrix });
    }
    if (url.includes("fields=version")) {
      calls.push(`version:${versions[versionIndex]}`);
      return Response.json({ version: versions[versionIndex++] });
    }
    return new Response(null, { status: 404 });
  };
  return { fetcher: fetcher as typeof fetch, calls };
}

const stableGoogle = googleFetcher(["169", "169"]);
const trusted = await readTrustedGoogleQuestionAuthority(
  googleConfig,
  stableGoogle.fetcher,
);
assert.equal(trusted.driveVersion, "169");
assert.ok(
  stableGoogle.calls.indexOf("version:169") < stableGoogle.calls.indexOf("values"),
  "Drive versionBefore precedes the Sheets values read",
);
assert.ok(
  stableGoogle.calls.lastIndexOf("version:169") > stableGoogle.calls.indexOf("values"),
  "Drive versionAfter follows the Sheets values read",
);

const unstableGoogle = googleFetcher(["169", "170"]);
await assert.rejects(
  readTrustedGoogleQuestionAuthority(googleConfig, unstableGoogle.fetcher),
  QuestionAuthorityError,
);
const wrongIdentity = googleFetcher(["169", "169"], { wrongTitle: true });
await assert.rejects(
  readTrustedGoogleQuestionAuthority(googleConfig, wrongIdentity.fetcher),
  QuestionAuthorityError,
);

for (const columnCount of [36, 38]) {
  const wrongWidth = googleFetcher(["169", "169"], { columnCount });
  await assert.rejects(
    readTrustedGoogleQuestionAuthority(googleConfig, wrongWidth.fetcher),
    (error: unknown) =>
      error instanceof QuestionAuthorityError && error.code === "SCHEMA_MISMATCH",
    `${columnCount} trusted columns fail closed`,
  );
  assert.equal(
    wrongWidth.calls.includes("values"),
    false,
    `${columnCount} columns fail before trusted values are read`,
  );
}

const renamedHeaders = copyMatrix();
renamedHeaders[0][1] = "renamed_title_ind";
const wrongHeaders = googleFetcher(["169", "169"], { values: renamedHeaders });
await assert.rejects(
  readTrustedGoogleQuestionAuthority(googleConfig, wrongHeaders.fetcher),
  (error: unknown) =>
    error instanceof QuestionAuthorityError && error.code === "SCHEMA_MISMATCH",
  "37 columns with a renamed header fail closed",
);

console.log("Question authority canonicalizer and Edge checks passed");
