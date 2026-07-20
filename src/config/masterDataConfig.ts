const env = import.meta.env as unknown as Record<string, string | undefined>;

export type DataSource = "mock" | "sheets";

const rawDataSource = (env.VITE_DATA_SOURCE ?? "mock").trim().toLowerCase();

if (rawDataSource !== "mock" && rawDataSource !== "sheets") {
  throw new Error(
    `VITE_DATA_SOURCE harus bernilai "mock" atau "sheets", tetapi menerima "${rawDataSource}".`,
  );
}

export const dataSource = rawDataSource as DataSource;

function readSheetUrl(name: string): string {
  const value = env[name]?.trim() ?? "";

  if (dataSource === "sheets" && !value) {
    throw new Error(`${name} belum diisi di .env.local.`);
  }

  return value;
}

export const masterDataConfig = {
  topicsUrl: readSheetUrl("VITE_SHEET_TOPICS_URL"),
  misconceptionsUrl: readSheetUrl("VITE_SHEET_MISCONCEPTIONS_URL"),
  questionsUrl: readSheetUrl("VITE_SHEET_QUESTIONS_URL"),
  questionTopicsUrl: readSheetUrl("VITE_SHEET_QUESTION_TOPICS_URL"),
  questionMisconceptionsUrl: readSheetUrl("VITE_SHEET_QUESTION_MISCONCEPTIONS_URL"),
  answersUrl: readSheetUrl("VITE_SHEET_ANSWERS_URL"),
  answerMisconceptionsUrl: readSheetUrl("VITE_SHEET_ANSWER_MISCONCEPTIONS_URL"),
  similarMisconceptionsUrl: readSheetUrl("VITE_SHEET_SIMILAR_MISCONCEPTIONS_URL"),
} as const;

export function usesGoogleSheets(): boolean {
  return dataSource === "sheets";
}
