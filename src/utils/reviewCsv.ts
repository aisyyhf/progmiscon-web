export type CsvValue = string | number | boolean | null | undefined;

function escapeCsvValue(value: CsvValue): string {
  const text = value == null ? "" : String(value);

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function serializeCsv(headers: string[], rows: CsvValue[][]): string {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\r\n");

  return `\uFEFF${csv}`;
}

export function downloadCsvFile(
  filename: string,
  headers: string[],
  rows: CsvValue[][],
): void {
  const blob = new Blob([serializeCsv(headers, rows)], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportDateStamp(value = new Date()): string {
  const pad = (part: number) => String(part).padStart(2, "0");

  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

const JAKARTA_TIME_ZONE = "Asia/Jakarta";

function jakartaParts(
  value: Date,
  options: Intl.DateTimeFormatOptions,
): (type: Intl.DateTimeFormatPartTypes) => string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: JAKARTA_TIME_ZONE,
    ...options,
  }).formatToParts(value);

  return (type) => parts.find((part) => part.type === type)?.value ?? "";
}

/**
 * Formats an ISO timestamp as `YYYY-MM-DD HH:mm WIB` in Asia/Jakarta time.
 * Falls back to the raw input when it cannot be parsed so nothing is lost.
 */
export function formatWibDateTime(value: string | null | undefined): string {
  const text = value == null ? "" : String(value);
  if (!text) return "";

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;

  const pick = jakartaParts(date, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  return `${pick("year")}-${pick("month")}-${pick("day")} ${pick("hour")}:${pick("minute")} WIB`;
}

/** Date stamp (`YYYY-MM-DD`) for export filenames, anchored to Asia/Jakarta. */
export function wibDateStamp(value = new Date()): string {
  const pick = jakartaParts(value, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return `${pick("year")}-${pick("month")}-${pick("day")}`;
}
