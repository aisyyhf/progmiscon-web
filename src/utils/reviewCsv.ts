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
