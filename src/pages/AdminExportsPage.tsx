import { Download, Network, Rows3 } from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { useAsyncData } from "../hooks/useAsyncData";
import { useLanguage } from "../hooks/useLanguage";
import { getMasterData } from "../services/masterDataRepository";
import type { MasterData } from "../types";
import {
  buildCurrentAnswerMisconceptionsCsv,
  buildCurrentAnswersCsv,
  buildCurrentQuestionMisconceptionsCsv,
  buildCurrentQuestionsCsv,
  buildCurrentSimilarMisconceptionsCsv,
} from "../utils/adminExports";
import { downloadCsvFile, exportDateStamp } from "../utils/reviewCsv";

const emptyMasterData: MasterData = {
  topics: [],
  misconceptions: [],
  questions: [],
  questionTopics: [],
  questionMisconceptions: [],
  answers: [],
  answerMisconceptions: [],
  similarMisconceptions: [],
};

export function AdminExportsPage() {
  const { language } = useLanguage();
  const isIndonesian = language === "id";
  const { data, loading, error } = useAsyncData(
    getMasterData,
    [],
    emptyMasterData,
  );

  const exportQuestionsAndAnswers = () => {
    const stamp = exportDateStamp();
    const questions = buildCurrentQuestionsCsv(data);
    const answers = buildCurrentAnswersCsv(data);
    downloadCsvFile(`questions_current_${stamp}.csv`, questions.headers, questions.rows);
    downloadCsvFile(`answers_current_${stamp}.csv`, answers.headers, answers.rows);
  };

  const exportRelations = () => {
    const stamp = exportDateStamp();
    const questionRelations = buildCurrentQuestionMisconceptionsCsv(data);
    const answerRelations = buildCurrentAnswerMisconceptionsCsv(data);
    const similarRelations = buildCurrentSimilarMisconceptionsCsv(data);
    downloadCsvFile(
      `question_misconceptions_current_${stamp}.csv`,
      questionRelations.headers,
      questionRelations.rows,
    );
    downloadCsvFile(
      `answer_misconceptions_current_${stamp}.csv`,
      answerRelations.headers,
      answerRelations.rows,
    );
    downloadCsvFile(
      `similar_misconceptions_current_${stamp}.csv`,
      similarRelations.headers,
      similarRelations.rows,
    );
  };

  if (loading) {
    return <EmptyState loading message={isIndonesian ? "Menyiapkan data efektif..." : "Preparing effective data..."} />;
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm leading-6 text-incorrect">
        {isIndonesian
          ? "Data ekspor belum dapat disiapkan. Silakan coba lagi."
          : "Export data could not be prepared. Please try again."}
      </p>
    );
  }

  const questions = buildCurrentQuestionsCsv(data);
  const answers = buildCurrentAnswersCsv(data);
  const questionRelations = buildCurrentQuestionMisconceptionsCsv(data);
  const answerRelations = buildCurrentAnswerMisconceptionsCsv(data);
  const similarRelations = buildCurrentSimilarMisconceptionsCsv(data);

  return (
    <section className="mx-auto w-full max-w-[980px]" aria-labelledby="admin-exports-title">
      <header className="border-b border-border pb-5">
        <h1 id="admin-exports-title" className="text-2xl font-semibold tracking-tight text-navy-deep">
          {isIndonesian ? "Export Data" : "Export Data"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {isIndonesian
            ? "Unduh snapshot CSV dari data efektif saat ini. Ekspor ini tidak menyertakan riwayat review atau baris tidak aktif."
            : "Download CSV snapshots of the current effective data. These exports exclude review history and inactive rows."}
        </p>
      </header>

      <div className="mt-5 divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
        <article className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
              <Rows3 size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-medium text-navy-deep">
                {isIndonesian ? "Soal dan jawaban saat ini" : "Current questions and answers"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {questions.rows.length} {isIndonesian ? "soal" : "questions"} · {answers.rows.length} {isIndonesian ? "jawaban" : "answers"}. {isIndonesian ? "Menghasilkan 2 file CSV." : "Produces 2 CSV files."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportQuestionsAndAnswers}
            className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-brand bg-white px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Download size={16} aria-hidden="true" />
            {isIndonesian ? "Export Soal & Jawaban Saat Ini" : "Export Current Questions & Answers"}
          </button>
        </article>

        <article className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex min-w-0 gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
              <Network size={17} aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-sm font-medium text-navy-deep">
                {isIndonesian ? "Relasi miskonsepsi saat ini" : "Current misconception relations"}
              </h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {questionRelations.rows.length + answerRelations.rows.length + similarRelations.rows.length} {isIndonesian ? "relasi terlihat" : "visible relations"}. {isIndonesian ? "Menghasilkan 3 file CSV terpisah." : "Produces 3 separate CSV files."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={exportRelations}
            className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-brand bg-white px-4 py-2 text-sm font-medium text-brand hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Download size={16} aria-hidden="true" />
            {isIndonesian ? "Export Relasi Miskonsepsi Saat Ini" : "Export Current Misconception Relations"}
          </button>
        </article>
      </div>

      <p className="mt-4 text-xs leading-5 text-muted">
        {isIndonesian
          ? "Ekspor jawaban tidak menyertakan nama atau identitas pengguna mahasiswa."
          : "Answer exports do not include student names or user identifiers."}
      </p>
    </section>
  );
}
