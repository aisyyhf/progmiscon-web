import Papa from "papaparse";

export async function loadCsv<T extends object>(
  url: string,
  sheetName: string,
): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(
      `Gagal mengambil tab ${sheetName}: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const csvText = await response.text();
  const parsed = Papa.parse<T>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  if (parsed.errors.length > 0) {
    const details = parsed.errors
      .slice(0, 5)
      .map((error) => {
        const rowLabel = typeof error.row === "number" ? `baris ${error.row + 2}` : "baris tidak diketahui";
        return `${rowLabel}: ${error.message}`;
      })
      .join("; ");

    throw new Error(`CSV ${sheetName} tidak dapat dibaca dengan benar. ${details}`);
  }

  return parsed.data;
}
