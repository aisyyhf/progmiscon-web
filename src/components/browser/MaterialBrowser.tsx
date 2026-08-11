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
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  HelpCircle,
  List,
  Search,
} from "lucide-react";

const PAGE_SIZE = 12;

export function MaterialBrowser({
  categories,
  selectedCategoryIds,
  onToggleCategory,
  onResetCategories,
  questions,
  loading = false,
  onSelectQuestion,
}: {
  categories: Category[];
  selectedCategoryIds: string[];
  onToggleCategory: (categoryId: string) => void;
  onResetCategories: () => void;
  questions: Question[];
  loading?: boolean;
  onSelectQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();
  const selectedCategories = categories.filter((category) =>
    selectedCategoryIds.includes(category.id),
  );
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

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
    Boolean(searchQuery.trim()) ||
    typeFilter !== "all" ||
    weekFilter !== "all" ||
    selectedCategoryIds.length !== 1 ||
    selectedCategoryIds[0] !== categories[0]?.id;

  const resetFilters = () => {
    setSearchQuery(DEFAULT_MATERIAL_QUESTION_FILTERS.searchQuery);
    setTypeFilter(DEFAULT_MATERIAL_QUESTION_FILTERS.type);
    setWeekFilter(DEFAULT_MATERIAL_QUESTION_FILTERS.week);
    setCurrentPage(1);
    onResetCategories();
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategoryIds]);

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

      <div className="grid gap-4 lg:grid-cols-[13.75rem_minmax(0,1fr)] lg:items-start">
        <aside
          id="question-catalog-filters"
          className={cn(
            "lg:sticky lg:top-20",
            filtersOpen ? "block" : "hidden lg:block",
          )}
        >
          <div className="rounded-xl border border-border bg-neutral/65 p-3.5">
            <div className="flex items-center justify-between gap-3 border-b border-border pb-2.5">
              <h2 className="text-base font-extrabold tracking-tight text-navy-deep">
                {language === "id" ? "Filter" : "Filters"}
              </h2>
              <button
                type="button"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                className="cursor-pointer text-[10px] font-bold text-brand disabled:cursor-default disabled:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {language === "id" ? "Reset semua" : "Reset all"}
              </button>
            </div>

            <div className="mt-3 space-y-3.5">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-navy-deep">
                  {language === "id" ? "Cari soal" : "Search questions"}
                </span>
                <span className="relative block">
                  <Search
                    size={14}
                    strokeWidth={2}
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
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
                    className="academic-input h-9 min-w-0 pl-8 pr-2.5 text-[11px] placeholder:text-muted/70"
                  />
                </span>
              </label>

              <fieldset>
                <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-navy-deep">
                  {language === "id" ? "KC / Konsep" : "KC / Concept"}
                </legend>
                <div className="grid gap-0.5">
                  {categories.map((category) => {
                    const active = selectedCategoryIds.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => onToggleCategory(category.id)}
                        aria-pressed={active}
                        className={cn(
                          "group flex min-h-7 cursor-pointer items-center gap-2 rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors active:translate-y-0",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                          active ? "bg-white text-brand" : "text-muted hover:bg-white hover:text-navy-deep",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-3.5 shrink-0 place-items-center rounded-[3px] border transition-colors",
                            active
                              ? "border-brand bg-brand text-white"
                              : "border-border bg-white group-hover:border-brand/40",
                          )}
                        >
                          {active && <Check size={10} strokeWidth={3} />}
                        </span>
                        <span className="truncate">{t(category.name, language)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-navy-deep">
                  {language === "id" ? "Minggu" : "Week"}
                </span>
                <select
                  value={weekFilter}
                  onChange={(event) => {
                    setWeekFilter(event.target.value);
                    setCurrentPage(1);
                  }}
                  className="academic-input h-9 min-w-0 cursor-pointer px-2.5 text-[11px]"
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
                <legend className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-navy-deep">
                  {language === "id" ? "Jenis soal" : "Question type"}
                </legend>
                <div className="grid grid-cols-3 gap-1">
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
                        "min-h-8 cursor-pointer rounded-md border px-1 py-1 text-[10px] font-semibold transition-colors active:translate-y-0",
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
          </div>

          <div className="relative mt-3 overflow-hidden rounded-xl bg-brand-deep p-3.5 text-white shadow-[0_8px_20px_rgba(143,28,32,0.14)]">
            <HelpCircle
              size={62}
              strokeWidth={1.5}
              aria-hidden="true"
              className="absolute -bottom-3 -right-2 text-white/10"
            />
            <p className="relative text-[9px] font-bold uppercase tracking-[0.08em]">
              {language === "id" ? "Katalog soal" : "Question catalog"}
            </p>
            <p className="relative mt-1 text-2xl font-extrabold tabular-nums">
              {filteredQuestions.length}
            </p>
            <p className="relative mt-0.5 text-[9px] text-white/80">
              {language === "id" ? "Soal sesuai filter." : "Questions matching filters."}
            </p>
          </div>
        </aside>

        <section className="min-w-0" aria-labelledby="question-catalog-title">
          <header className="flex items-start justify-between gap-4 pb-4">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.13em] text-brand">
                {language === "id" ? "Repositori pembelajaran" : "Learning repository"}
              </p>
              <h1
                id="question-catalog-title"
                className="text-3xl font-extrabold tracking-[-0.035em] text-navy-deep sm:text-[2rem]"
              >
                {language === "id" ? "Katalog Soal" : "Question Catalog"}
              </h1>
              <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted">
                {language === "id"
                  ? "Jelajahi soal berdasarkan konsep, minggu, dan pola miskonsepsi"
                  : "Explore questions by concept, week, and misconception pattern"}
              </p>
              <p className="mt-2 text-[11px] font-semibold text-brand">
                {selectedCategories.length === 1
                  ? t(selectedCategories[0].name, language)
                  : language === "id"
                    ? `${selectedCategories.length} konsep dipilih`
                    : `${selectedCategories.length} concepts selected`}
                {" · "}
                {filteredQuestions.length} {language === "id" ? "soal" : "questions"}
              </p>
            </div>

            <div
              className="mt-1 flex shrink-0 rounded-md border border-border bg-white p-0.5"
              role="group"
              aria-label={language === "id" ? "Tampilan katalog" : "Catalog view"}
            >
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-pressed={viewMode === "grid"}
                aria-label={language === "id" ? "Tampilan kisi" : "Grid view"}
                className={cn(
                  "grid size-8 cursor-pointer place-items-center rounded-[4px] transition-colors active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  viewMode === "grid" ? "bg-brand-soft text-brand" : "text-muted hover:text-navy-deep",
                )}
              >
                <Grid2X2 size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                aria-pressed={viewMode === "list"}
                aria-label={language === "id" ? "Tampilan daftar" : "List view"}
                className={cn(
                  "grid size-8 cursor-pointer place-items-center rounded-[4px] transition-colors active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  viewMode === "list" ? "bg-brand-soft text-brand" : "text-muted hover:text-navy-deep",
                )}
              >
                <List size={15} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </header>

          {loading ? (
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
              <ul
                className={cn(
                  "grid gap-3",
                  viewMode === "grid" && "md:grid-cols-2",
                )}
              >
                {visibleQuestions.map((question) => {
                  const prompt = t(question.prompt, language).trim();
                  const storedTitle = t(question.title, language).trim();
                  const title =
                    storedTitle && storedTitle !== prompt
                      ? storedTitle
                      : `${language === "id" ? "Soal" : "Question"} ${question.number || question.id}`;
                  const questionCategory =
                    categories.find((category) => category.id === question.categoryId) ??
                    selectedCategories[0];

                  return (
                    <li key={question.id} className="flex min-w-0">
                      <button
                        type="button"
                        data-question-id={question.id}
                        onClick={() => onSelectQuestion(question.id)}
                        className={cn(
                          "group flex w-full cursor-pointer flex-col rounded-xl border border-border bg-white p-3.5 text-left transition-[border-color,box-shadow] active:translate-y-0 hover:border-brand/35 hover:shadow-[0_9px_22px_rgba(143,28,32,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                          viewMode === "grid" ? "min-h-[13rem]" : "min-h-[10.5rem]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="max-w-[65%] truncate rounded border border-border bg-neutral px-2 py-0.5 text-[9px] font-bold tabular-nums text-navy-deep">
                            {question.number || question.id}
                          </span>
                          <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-bold text-brand-deep">
                            {getMaterialQuestionType(question.type).toUpperCase()}
                          </span>
                        </div>

                        <h2 className="mt-3 line-clamp-2 text-[15px] font-extrabold leading-[1.25] text-navy-deep transition-colors group-hover:text-brand">
                          {title}
                        </h2>
                        <p
                          className={cn(
                            "mt-1.5 whitespace-pre-line text-[11px] leading-[1.55] text-muted",
                            viewMode === "grid" ? "line-clamp-2" : "line-clamp-3",
                          )}
                        >
                          {prompt}
                        </p>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {question.week && (
                            <span className="rounded border border-border bg-neutral px-2 py-0.5 text-[9px] font-semibold text-navy-deep">
                              {question.week}
                            </span>
                          )}
                          {questionCategory && (
                            <span className="max-w-full truncate rounded border border-border bg-neutral px-2 py-0.5 text-[9px] font-semibold text-navy-deep">
                              {t(questionCategory.name, language)}
                            </span>
                          )}
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-[10px]">
                          <span className="font-semibold tabular-nums text-brand-deep">
                            {question.questionMisconceptionIds.length}{" "}
                            {language === "id" ? "miskonsepsi" : "misconceptions"}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 font-bold text-brand">
                            {language === "id" ? "Lihat soal" : "View question"}
                            <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
                          </span>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-6 flex min-h-14 flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
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
                      style={{ transform: "none" }}
                      className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-neutral hover:text-brand disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                    </button>

                    {paginationItems.map((item, index) =>
                      item === "ellipsis" ? (
                        <span key={`ellipsis-${index}`} className="grid size-8 place-items-center text-xs text-muted">
                          ...
                        </span>
                      ) : (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          aria-current={item === page ? "page" : undefined}
                          aria-label={`${language === "id" ? "Halaman" : "Page"} ${item}`}
                          style={{ transform: "none" }}
                          className={cn(
                            "grid size-8 cursor-pointer place-items-center rounded-md text-[11px] font-bold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
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
                      style={{ transform: "none" }}
                      className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-neutral hover:text-brand disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
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
