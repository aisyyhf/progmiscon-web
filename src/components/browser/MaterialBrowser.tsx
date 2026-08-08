import { useEffect, useMemo, useState } from "react";
import type { Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import {
  DEFAULT_MATERIAL_QUESTION_FILTERS,
  filterMaterialQuestions,
  getMaterialPaginationItems,
  getMaterialQuestionType,
  getMaterialWeekOptions,
  type MaterialQuestionTypeFilter,
  type MaterialWeekFilter,
} from "../../utils/materialQuestionFilters";
import { EmptyState } from "../common/EmptyState";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";

const PAGE_SIZE = 12;

export function MaterialBrowser({
  categories,
  selectedCategoryId,
  onSelectCategory,
  questions,
  loading = false,
  onSelectQuestion,
}: {
  categories: Category[];
  selectedCategoryId: string | undefined;
  onSelectCategory: (categoryId: string) => void;
  questions: Question[];
  loading?: boolean;
  onSelectQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);
  const [searchQuery, setSearchQuery] = useState<string>(
    DEFAULT_MATERIAL_QUESTION_FILTERS.searchQuery,
  );
  const [typeFilter, setTypeFilter] = useState<MaterialQuestionTypeFilter>(
    DEFAULT_MATERIAL_QUESTION_FILTERS.type,
  );
  const [weekFilter, setWeekFilter] = useState<MaterialWeekFilter>(
    DEFAULT_MATERIAL_QUESTION_FILTERS.week,
  );
  const [currentPage, setCurrentPage] = useState(1);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const weekOptions = useMemo(() => getMaterialWeekOptions(questions), [questions]);
  const hasUnassignedWeek = questions.some((question) => question.week === null);
  const filteredQuestions = useMemo(
    () =>
      filterMaterialQuestions(questions, {
        searchQuery,
        type: typeFilter,
        week: weekFilter,
      }),
    [questions, searchQuery, typeFilter, weekFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const rangeStart = filteredQuestions.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, filteredQuestions.length);
  const visibleQuestions = filteredQuestions.slice(rangeStart - 1, rangeEnd);
  const paginationItems = getMaterialPaginationItems(page, totalPages);
  const hasActiveFilters =
    Boolean(searchQuery.trim()) || typeFilter !== "all" || weekFilter !== "all";

  const resetFilters = () => {
    setSearchQuery(DEFAULT_MATERIAL_QUESTION_FILTERS.searchQuery);
    setTypeFilter(DEFAULT_MATERIAL_QUESTION_FILTERS.type);
    setWeekFilter(DEFAULT_MATERIAL_QUESTION_FILTERS.week);
    setCurrentPage(1);
  };

  useEffect(() => {
    resetFilters();
  }, [selectedCategoryId]);

  return (
    <div className="scroll-reveal">
      <button
        type="button"
        onClick={() => setFiltersOpen((open) => !open)}
        aria-expanded={filtersOpen}
        aria-controls="question-catalog-filters"
        className="mb-4 inline-flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-white px-4 text-sm font-bold text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
      >
        {language === "id" ? "Filter soal" : "Question filters"}
        <span className="text-xs font-semibold text-brand">
          {filtersOpen ? (language === "id" ? "Tutup" : "Close") : language === "id" ? "Buka" : "Open"}
        </span>
      </button>

      <div className="grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
        <aside
          id="question-catalog-filters"
          className={cn(
            "rounded-xl border border-border bg-neutral/70 p-4 lg:sticky lg:top-20",
            filtersOpen ? "block" : "hidden lg:block",
          )}
        >
          <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
            <h2 className="text-lg font-extrabold tracking-tight text-navy-deep">
              {language === "id" ? "Filter" : "Filters"}
            </h2>
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="cursor-pointer text-xs font-semibold text-brand underline decoration-brand/30 underline-offset-4 disabled:cursor-default disabled:text-muted disabled:no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {language === "id" ? "Reset semua" : "Reset all"}
            </button>
          </div>

          <div className="mt-4 space-y-5">
            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-navy-deep">
                {language === "id" ? "Cari soal" : "Search questions"}
              </span>
              <span className="relative block">
                <Search
                  size={15}
                  strokeWidth={2}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(event) => {
                    setSearchQuery(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder={language === "id" ? "ID atau nomor soal" : "Question ID or number"}
                  className="academic-input h-10 min-w-0 pl-9 pr-3 text-xs placeholder:text-muted/70"
                />
              </span>
            </label>

            <fieldset>
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-navy-deep">
                {language === "id" ? "KC / Konsep" : "KC / Concept"}
              </legend>
              <div className="grid gap-0.5">
                {categories.map((category) => {
                  const active = category.id === selectedCategoryId;
                  return (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => {
                        onSelectCategory(category.id);
                        setFiltersOpen(false);
                      }}
                      aria-pressed={active}
                      className={cn(
                        "group flex min-h-8 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-left text-xs font-medium transition-colors",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        active ? "bg-white text-brand" : "text-muted hover:bg-white hover:text-navy-deep",
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          "size-3 shrink-0 rounded-[3px] border",
                          active ? "border-brand bg-brand" : "border-border bg-white group-hover:border-brand/40",
                        )}
                      />
                      <span>{t(category.name, language)}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-2 block text-[11px] font-bold uppercase tracking-[0.08em] text-navy-deep">
                {language === "id" ? "Minggu" : "Week"}
              </span>
              <select
                value={weekFilter}
                onChange={(event) => {
                  setWeekFilter(event.target.value);
                  setCurrentPage(1);
                }}
                className="academic-input h-10 min-w-0 cursor-pointer px-3 text-xs"
              >
                <option value="all">{language === "id" ? "Semua minggu" : "All weeks"}</option>
                {weekOptions.map((week) => (
                  <option key={week} value={week}>
                    {week}
                  </option>
                ))}
                {hasUnassignedWeek && (
                  <option value="unassigned">
                    {language === "id" ? "Belum ditentukan" : "Unassigned"}
                  </option>
                )}
              </select>
            </label>

            <fieldset>
              <legend className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-navy-deep">
                {language === "id" ? "Jenis soal" : "Question type"}
              </legend>
              <div className="grid grid-cols-3 gap-1.5">
                {(["all", "ps", "mp"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      setTypeFilter(value);
                      setCurrentPage(1);
                    }}
                    aria-pressed={typeFilter === value}
                    className={cn(
                      "min-h-9 cursor-pointer rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      typeFilter === value
                        ? "border-brand bg-brand-soft text-brand-deep"
                        : "border-border bg-white text-muted hover:border-brand/30 hover:text-navy-deep",
                    )}
                  >
                    {value === "all" ? (language === "id" ? "Semua" : "All") : value.toUpperCase()}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        </aside>

        <section className="min-w-0" aria-labelledby="question-catalog-title">
          <header className="pb-5">
            <h1
              id="question-catalog-title"
              className="text-3xl font-extrabold tracking-[-0.035em] text-navy-deep sm:text-4xl"
            >
              {language === "id" ? "Soal" : "Questions"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              {language === "id"
                ? "Jelajahi soal berdasarkan konsep, minggu, dan pola miskonsepsi"
                : "Explore questions by concept, week, and misconception pattern"}
            </p>
            {selectedCategory && (
              <p className="mt-3 text-xs font-semibold text-brand">
                {t(selectedCategory.name, language)} · {filteredQuestions.length}{" "}
                {language === "id" ? "soal" : "questions"}
              </p>
            )}
          </header>

          {loading || (categories.length > 0 && !selectedCategory) ? (
            <EmptyState loading message={language === "id" ? "Memuat soal..." : "Loading questions..."} />
          ) : filteredQuestions.length === 0 ? (
            <EmptyState
              message={
                hasActiveFilters
                  ? language === "id"
                    ? "Tidak ada soal yang sesuai dengan filter"
                    : "No questions match the selected filters"
                  : language === "id"
                    ? "Belum ada soal untuk konsep ini. Pilih konsep lain dari daftar."
                    : "No questions are available for this concept yet. Choose another concept from the list."
              }
            />
          ) : (
            <>
              <ul className="grid gap-3.5 md:grid-cols-2">
                {visibleQuestions.map((question) => {
                  const prompt = t(question.prompt, language).trim();
                  const storedTitle = t(question.title, language).trim();
                  const title =
                    storedTitle && storedTitle !== prompt
                      ? storedTitle
                      : `${language === "id" ? "Soal" : "Question"} ${question.number || question.id}`;

                  return (
                    <li key={question.id} className="flex min-w-0">
                      <button
                        type="button"
                        data-question-id={question.id}
                        onClick={() => onSelectQuestion(question.id)}
                        className="group flex min-h-64 w-full cursor-pointer flex-col rounded-xl border border-border bg-white p-4 text-left transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_10px_24px_rgba(143,28,32,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="max-w-[65%] truncate rounded-md border border-border bg-neutral px-2 py-1 text-[10px] font-bold tabular-nums text-navy-deep">
                            {question.number || question.id}
                          </span>
                          <span className="rounded-md bg-brand-soft px-2 py-1 text-[10px] font-bold text-brand-deep">
                            {getMaterialQuestionType(question.type).toUpperCase()}
                          </span>
                        </div>

                        <h2 className="mt-4 line-clamp-2 text-base font-extrabold leading-5 text-navy-deep transition-colors group-hover:text-brand">
                          {title}
                        </h2>
                        <p className="mt-2 line-clamp-3 whitespace-pre-line text-xs leading-5 text-muted">
                          {prompt}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {question.week && (
                            <span className="rounded-md border border-border bg-neutral px-2 py-1 text-[10px] font-semibold text-navy-deep">
                              {question.week}
                            </span>
                          )}
                          {selectedCategory && (
                            <span className="max-w-full truncate rounded-md border border-border bg-neutral px-2 py-1 text-[10px] font-semibold text-navy-deep">
                              {t(selectedCategory.name, language)}
                            </span>
                          )}
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-[11px]">
                          <span className="font-semibold tabular-nums text-brand-deep">
                            {question.questionMisconceptionIds.length}{" "}
                            {language === "id" ? "miskonsepsi" : "misconceptions"}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1.5 font-bold text-brand transition-transform group-hover:translate-x-0.5">
                            {language === "id" ? "Lihat soal" : "View question"}
                            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-7 flex flex-col gap-4 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs tabular-nums text-muted" role="status" aria-live="polite">
                  {language === "id"
                    ? `Menampilkan ${rangeStart}-${rangeEnd} dari ${filteredQuestions.length} soal`
                    : `Showing ${rangeStart}-${rangeEnd} of ${filteredQuestions.length} questions`}
                </p>

                {totalPages > 1 && (
                  <nav
                    aria-label={language === "id" ? "Paginasi soal" : "Question pagination"}
                    className="flex items-center gap-1"
                  >
                    <button
                      type="button"
                      onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                      disabled={page === 1}
                      aria-label={language === "id" ? "Halaman sebelumnya" : "Previous page"}
                      className="grid size-9 cursor-pointer place-items-center rounded-md text-muted hover:bg-neutral hover:text-brand disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                    </button>

                    {paginationItems.map((item, index) =>
                      item === "ellipsis" ? (
                        <span key={`ellipsis-${index}`} className="grid size-9 place-items-center text-xs text-muted">
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          aria-current={item === page ? "page" : undefined}
                          aria-label={`${language === "id" ? "Halaman" : "Page"} ${item}`}
                          className={cn(
                            "grid size-9 cursor-pointer place-items-center rounded-md text-xs font-bold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                            item === page
                              ? "bg-brand text-white shadow-[0_4px_10px_rgba(143,28,32,0.18)]"
                              : "text-muted hover:bg-neutral hover:text-navy-deep",
                          )}
                        >
                          {item}
                        </button>
                      ),
                    )}

                    <button
                      type="button"
                      onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                      disabled={page === totalPages}
                      aria-label={language === "id" ? "Halaman berikutnya" : "Next page"}
                      className="grid size-9 cursor-pointer place-items-center rounded-md text-muted hover:bg-neutral hover:text-brand disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </nav>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
