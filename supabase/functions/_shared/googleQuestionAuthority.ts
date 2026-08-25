import {
  canonicalizeQuestionAuthority,
  QuestionAuthorityError,
  reviewedSourceIdentitySha256,
  type QuestionAuthorityDataset,
} from "./questionAuthority.ts";

const SHEETS_READONLY_SCOPE =
  "https://www.googleapis.com/auth/spreadsheets.readonly";
const DRIVE_METADATA_READONLY_SCOPE =
  "https://www.googleapis.com/auth/drive.metadata.readonly";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_SHEETS_MIME = "application/vnd.google-apps.spreadsheet";

export type GoogleServiceAccountCredential = {
  type: "service_account";
  client_email: string;
  private_key: string;
};

export type GoogleQuestionAuthorityConfig = {
  credential: GoogleServiceAccountCredential;
  spreadsheetId: string;
  spreadsheetTitle: string;
  sheetId: number;
  tab: string;
  range: string;
  reviewedSourceIdentitySha256: string;
};

export type TrustedGoogleQuestionAuthority = {
  dataset: QuestionAuthorityDataset;
  driveVersion: string;
};

function unavailable(): never {
  throw new QuestionAuthorityError(
    "GOOGLE_AUTHORITY_UNAVAILABLE",
    "Trusted Google authority is unavailable",
  );
}

function schemaMismatch(): never {
  throw new QuestionAuthorityError(
    "SCHEMA_MISMATCH",
    "Trusted Google Questions schema does not match the reviewed A:AK schema",
  );
}

function base64Url(value: string | Uint8Array): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function privateKeyBytes(pem: string): Uint8Array {
  const base64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  if (!base64) return unavailable();
  let binary: string;
  try {
    binary = atob(base64);
  } catch {
    return unavailable();
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export function parseGoogleServiceAccountCredential(
  raw: string,
): GoogleServiceAccountCredential {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return unavailable();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return unavailable();
  }
  const credential = value as Record<string, unknown>;
  if (
    credential.type !== "service_account" ||
    typeof credential.client_email !== "string" ||
    !credential.client_email.trim() ||
    typeof credential.private_key !== "string" ||
    !credential.private_key.trim()
  ) return unavailable();
  return {
    type: "service_account",
    client_email: credential.client_email.trim(),
    private_key: credential.private_key,
  };
}

export async function getGoogleReadOnlyAccessToken(
  credential: GoogleServiceAccountCredential,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64Url(JSON.stringify({
    iss: credential.client_email,
    scope: `${SHEETS_READONLY_SCOPE} ${DRIVE_METADATA_READONLY_SCOPE}`,
    aud: GOOGLE_TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + 3600,
  }));
  const unsigned = `${header}.${claims}`;
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "pkcs8",
      privateKeyBytes(credential.private_key),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch {
    return unavailable();
  }
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsigned),
  );
  const assertion = `${unsigned}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetcher(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!response.ok) return unavailable();
  const payload = await response.json() as Record<string, unknown>;
  if (typeof payload.access_token !== "string" || !payload.access_token) {
    return unavailable();
  }
  return payload.access_token;
}

async function googleJson(
  url: string,
  accessToken: string,
  fetcher: typeof fetch,
): Promise<Record<string, unknown>> {
  const response = await fetcher(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) return unavailable();
  return await response.json() as Record<string, unknown>;
}

export async function readGoogleDriveVersion(
  config: GoogleQuestionAuthorityConfig,
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const accessToken = await getGoogleReadOnlyAccessToken(config.credential, fetcher);
  const payload = await googleJson(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(config.spreadsheetId)}` +
      "?fields=version&supportsAllDrives=true",
    accessToken,
    fetcher,
  );
  if (typeof payload.version !== "string" || !payload.version) return unavailable();
  return payload.version;
}

export async function readTrustedGoogleQuestionAuthority(
  config: GoogleQuestionAuthorityConfig,
  fetcher: typeof fetch = fetch,
): Promise<TrustedGoogleQuestionAuthority> {
  const accessToken = await getGoogleReadOnlyAccessToken(config.credential, fetcher);
  const encodedSpreadsheetId = encodeURIComponent(config.spreadsheetId);
  const [spreadsheet, driveIdentity] = await Promise.all([
    googleJson(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodedSpreadsheetId}` +
        "?includeGridData=false&fields=spreadsheetId%2Cproperties.title%2Csheets.properties",
      accessToken,
      fetcher,
    ),
    googleJson(
      `https://www.googleapis.com/drive/v3/files/${encodedSpreadsheetId}` +
        "?fields=id%2Cname%2CmimeType%2Ctrashed&supportsAllDrives=true",
      accessToken,
      fetcher,
    ),
  ]);
  if (
    spreadsheet.spreadsheetId !== config.spreadsheetId ||
    driveIdentity.id !== config.spreadsheetId ||
    driveIdentity.mimeType !== GOOGLE_SHEETS_MIME ||
    driveIdentity.trashed !== false ||
    driveIdentity.name !== config.spreadsheetTitle
  ) return unavailable();
  const properties = spreadsheet.properties as Record<string, unknown> | undefined;
  if (properties?.title !== config.spreadsheetTitle) return unavailable();
  const sheets = Array.isArray(spreadsheet.sheets) ? spreadsheet.sheets : [];
  const matches = sheets.filter((sheet) => {
    const sheetProperties = (sheet as Record<string, unknown>).properties as
      | Record<string, unknown>
      | undefined;
    return sheetProperties?.sheetId === config.sheetId;
  });
  if (matches.length !== 1) return unavailable();
  const sheetProperties = (matches[0] as Record<string, unknown>).properties as
    Record<string, unknown>;
  const grid = sheetProperties.gridProperties as Record<string, unknown> | undefined;
  if (
    sheetProperties.title !== config.tab ||
    sheetProperties.sheetType !== "GRID" ||
    typeof grid?.columnCount !== "number"
  ) return unavailable();
  if (grid.columnCount !== 37) return schemaMismatch();
  const identityHash = await reviewedSourceIdentitySha256({
    spreadsheetId: config.spreadsheetId,
    spreadsheetTitle: config.spreadsheetTitle,
    sheetId: config.sheetId,
    tab: config.tab,
    range: config.range,
  });
  if (identityHash !== config.reviewedSourceIdentitySha256) return unavailable();

  const versionBeforePayload = await googleJson(
    `https://www.googleapis.com/drive/v3/files/${encodedSpreadsheetId}` +
      "?fields=version&supportsAllDrives=true",
    accessToken,
    fetcher,
  );
  if (typeof versionBeforePayload.version !== "string") return unavailable();
  const valuesPayload = await googleJson(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodedSpreadsheetId}/values/` +
      `${encodeURIComponent(config.range)}` +
      "?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING",
    accessToken,
    fetcher,
  );
  const versionAfterPayload = await googleJson(
    `https://www.googleapis.com/drive/v3/files/${encodedSpreadsheetId}` +
      "?fields=version&supportsAllDrives=true",
    accessToken,
    fetcher,
  );
  if (
    typeof versionAfterPayload.version !== "string" ||
    versionBeforePayload.version !== versionAfterPayload.version
  ) return unavailable();
  const values = Array.isArray(valuesPayload.values)
    ? valuesPayload.values as unknown[][]
    : [];
  return {
    dataset: await canonicalizeQuestionAuthority(values),
    driveVersion: versionAfterPayload.version,
  };
}
