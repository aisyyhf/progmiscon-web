import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { AdminFilterSelect } from "../components/admin/AdminFilterSelect";
import { AdminQuestionWordingEditor } from "../components/admin/AdminQuestionWordingEditor";
import { EmptyState } from "../components/common/EmptyState";
import { QuestionContent } from "../components/review/QuestionContent";
import { useAsyncData } from "../hooks/useAsyncData";
import { useLanguage } from "../hooks/useLanguage";
import { getMisconceptions } from "../services/misconceptionRepository";
import { getQuestions } from "../services/questionRepository";
import type {
  Misconception,
  Question,
  SaveQuestionWordingOverrideResult,
} from "../types";
import {
  filterMaterialQuestions,
  getMaterialPaginationItems,
  getMaterialWeekLabel,
  getMaterialWeekOptions,
  type MaterialQuestionTypeFilter,
} from "../utils/materialQuestionFilters";
import { t } from "../utils/translation";

const PAGE_SIZE = 10;
const emptyData: [Question[], Misconception[]] = [
  [],
  [],
];

function applySavedWording(
  question: Question,
  saved: SaveQuestionWordingOverrideResult | undefined,
): Question {
  if (!saved) return question;
  const id = saved.questionInd.trim() || saved.questionEn.trim();
  const en = saved.questionEn.trim() || id;
  const replaceTextBlock = (
    blocks: NonNullable<Question["contentBlocks"]>["id"],
    content: string,
  ) => blocks.length === 1 && blocks[0].type === "text"
    ? [{ ...blocks[0], content }]
    : blocks;

  return {
    ...question,
    questionInd: saved.questionInd,
    questionEn: saved.questionEn,
    prompt: { id, en },
    contentUpdatedAt: saved.updatedAt ?? undefined,
    contentBlocks: question.contentBlocks
      ? {
          id: replaceTextBlock(question.contentBlocks.id, saved.questionInd),
          en: replaceTextBlock(question.contentBlocks.en, saved.questionEn),
        }
      : question.contentBlocks,
  };
}

export function AdminQuestionsPage() {
  const { language } = useLanguage();
  const isIndonesian = language === "id";
  const { data, loading, error } = useAsyncData(
    async () => {
      const [questions, misconceptions] = await Promise.all([
        getQuestions(),
        getMisconceptions(),
      ]);
      return [questions, misconceptions] as const;
    },
    [],
    emptyData,
  );
  const [questions, misconceptions] = data;
  const [searchQuery, setSearchQuery] = useState("");
  const [week, setWeek] = useState("all");
  const [type, setType] = useState<MaterialQuestionTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedQuestionId, setSavedQuestionId] = useState<string | null>(null);
  const [savedWording, setSavedWording] = useState(
    () => new Map<string, SaveQuestionWordingOverrideResult>(),
  );

  const effectiveQuestions = useMemo(
    () => questions.map((question) =>
      applySavedWording(question, savedWording.get(question.id))),
    [questions, savedWording],
  );

  const weekOptions = useMemo(
    () => getMaterialWeekOptions(effectiveQuestions),
    [effectiveQuestions],
  );
  const filteredQuestions = useMemo(
    () => filterMaterialQuestions(effectiveQuestions, { searchQuery, week, type }),
    [effectiveQuestions, searchQuery, type, week],
  );
  const pageCount = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleQuestions = filteredQuestions.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const misconceptionById = useMemo(
    () => new Map(misconceptions.map((item) => [item.id, item])),
    [misconceptions],
  );
  const handleSaved = (result: SaveQuestionWordingOverrideResult) => {
    setSavedWording((current) => {
      const next = new Map(current);
      next.set(result.questionId, result);
      return next;
    });
    setSavedQuestionId(result.questionId);
  };

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [searchQuery, type, week]);

  if (loading) {
    return (
      <EmptyState
        loading
        message={isIndonesian ? "Memuat soal saat ini..." : "Loading current questions..."}
      />
    );
  }

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm leading-6 text-incorrect"
      >
        {isIndonesian
          ? "Soal saat ini belum dapat dimuat. Silakan coba lagi."
          : "Current questions could not be loaded. Please try again."}
      </p>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1180px]" aria-labelledby="admin-questions-title">
      <header className="border-b border-border pb-5">
        <h1 id="admin-questions-title" className="text-2xl font-semibold tracking-tight text-navy-deep">
          {isIndonesian ? "Kelola Soal" : "Manage Questions"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {isIndonesian
            ? "Lihat wording saat ini dan edit soal Esai yang aman. Tipe, struktur jawaban, dan relasi tetap terkunci."
            : "View current wording and edit supported Essay questions. Types, answer structure, and relations stay locked."}
        </p>
      </header>

      {savedQuestionId && (
        <p role="status" className="mt-4 rounded-md bg-correct-bg px-3 py-2 text-xs leading-5 text-correct">
          {isIndonesian
            ? `Wording ${savedQuestionId} berhasil disimpan.`
            : `${savedQuestionId} wording was saved.`}
        </p>
      )}

      <div className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">{isIndonesian ? "Cari soal" : "Search questions"}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={isIndonesian ? "Cari kode atau judul soal" : "Search question code or title"}
            className="h-10 w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-navy-deep outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <AdminFilterSelect
          label={isIndonesian ? "Filter minggu" : "Filter by week"}
          value={week}
          onChange={(event) => setWeek(event.target.value)}
        >
          <option value="all">{isIndonesian ? "Semua minggu" : "All weeks"}</option>
          <option value="unassigned">{isIndonesian ? "Tanpa minggu" : "Unassigned"}</option>
          {weekOptions.map((item) => (
            <option key={item} value={item}>{getMaterialWeekLabel(item)}</option>
          ))}
        </AdminFilterSelect>
        <AdminFilterSelect
          label={isIndonesian ? "Filter tipe" : "Filter by type"}
          value={type}
          onChange={(event) => setType(event.target.value as MaterialQuestionTypeFilter)}
        >
          <option value="all">{isIndonesian ? "Semua tipe" : "All types"}</option>
          <option value="ps">{isIndonesian ? "Esai (PS)" : "Essay (PS)"}</option>
          <option value="mp">{isIndonesian ? "Pilihan Ganda (MP)" : "Multiple Choice (MP)"}</option>
        </AdminFilterSelect>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted">
        <p>{filteredQuestions.length} {isIndonesian ? "soal" : "questions"}</p>
        {pageCount > 1 && <p>{isIndonesian ? "Halaman" : "Page"} {safePage} / {pageCount}</p>}
      </div>

      {visibleQuestions.length === 0 ? (
        <EmptyState message={isIndonesian ? "Tidak ada soal yang sesuai dengan filter ini." : "No questions match these filters."} />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
          {visibleQuestions.map((question) => {
            const expanded = expandedId === question.id;
            const misconceptionItems = question.questionMisconceptionIds
              .map((id) => misconceptionById.get(id))
              .filter((item): item is Misconception => item !== undefined);

            return (
              <article key={question.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : question.id)}
                  aria-expanded={expanded}
                  className="flex min-h-16 w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-neutral/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="text-brand">{question.displayCode?.trim() || `${isIndonesian ? "Soal" : "Question"} ${question.number}`}</span>
                      <span>{question.type === "multiple_choice" ? (isIndonesian ? "Pilihan Ganda" : "Multiple Choice") : (isIndonesian ? "Esai" : "Essay")}</span>
                      <span>{question.week ? getMaterialWeekLabel(question.week) : isIndonesian ? "Tanpa minggu" : "Unassigned"}</span>
                    </div>
                    <h2 className="mt-1 text-sm font-medium leading-5 text-navy-deep">
                      {t(question.title, language)}
                    </h2>
                    {question.shortDescription && (
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted">
                        {t(question.shortDescription, language)}
                      </p>
                    )}
                  </div>
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-brand">
                    {expanded ? (isIndonesian ? "Tutup" : "Close") : (isIndonesian ? "Lihat" : "View")}
                    {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-border bg-[var(--progmiscon-background)]/60 px-4 py-5 sm:px-5">
                    <QuestionContent question={question} />

                    {question.type === "multiple_choice" && question.options && question.options.length > 0 && (
                      <section className="mt-5" aria-label={isIndonesian ? "Pilihan jawaban" : "Answer options"}>
                        <h3 className="text-xs font-semibold text-navy-deep">{isIndonesian ? "Pilihan jawaban" : "Answer options"}</h3>
                        <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                          {question.options.map((option) => (
                            <li key={option.id} className="flex gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs leading-5 text-navy-deep">
                              <span className="font-semibold">{option.label}.</span>
                              <span className="min-w-0 flex-1">{t(option.text, language)}</span>
                              {option.isCorrect && (
                                <span className="shrink-0 text-correct">{isIndonesian ? "Benar" : "Correct"}</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </section>
                    )}

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <section>
                        <h3 className="text-xs font-semibold text-navy-deep">{isIndonesian ? "Konsep yang diharapkan" : "Expected concepts"}</h3>
                        {question.expectedConcepts.length > 0 ? (
                          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-navy-deep">
                            {question.expectedConcepts.map((concept, index) => <li key={`${t(concept, language)}-${index}`}>{t(concept, language)}</li>)}
                          </ul>
                        ) : <p className="mt-2 text-xs text-muted">{isIndonesian ? "Belum tersedia." : "Not available."}</p>}
                      </section>
                      <section>
                        <h3 className="text-xs font-semibold text-navy-deep">{isIndonesian ? "Miskonsepsi terkait" : "Related misconceptions"}</h3>
                        {misconceptionItems.length > 0 ? (
                          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-navy-deep">
                            {misconceptionItems.map((item) => <li key={item.id}>{t(item.title, language)}</li>)}
                          </ul>
                        ) : <p className="mt-2 text-xs text-muted">{isIndonesian ? "Belum tersedia." : "Not available."}</p>}
                      </section>
                    </div>

                    <AdminQuestionWordingEditor
                      question={question}
                      language={language}
                      onSaved={handleSaved}
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-5 flex justify-end gap-2" aria-label={isIndonesian ? "Halaman soal" : "Question pages"}>
          {getMaterialPaginationItems(safePage, pageCount).map((item) => (
            <button
              key={item}
              type="button"
              aria-current={item === safePage ? "page" : undefined}
              onClick={() => setPage(item)}
              className={`h-10 min-w-10 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${item === safePage ? "border-brand bg-brand text-white" : "border-border bg-white text-navy-deep hover:bg-neutral"}`}
            >
              {item}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}
