import { useEffect, useMemo, useState } from "react";
import type { Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import {
  DEFAULT_MATERIAL_QUESTION_FILTERS,
  filterMaterialQuestions,
  getMaterialPaginationItems,
  getMaterialQuestionConcepts,
  getMaterialQuestionIdentifier,
  getMaterialQuestionType,
  getMaterialWeekLabel,
  getMaterialWeekOptions,
  type MaterialQuestionTypeFilter,
  type MaterialWeekFilter,
} from "../../utils/materialQuestionFilters";
import { EmptyState } from "../common/EmptyState";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  List,
  MessageSquareText,
  Search,
} from "lucide-react";

const GRID_PAGE_SIZE = 4;
const LIST_PAGE_SIZE = 6;

export function MaterialBrowser({
  categories,
  selectedCategoryIds,
  onToggleCategory,
  onResetCategories,
  questions,
  totalQuestionCount,
  loading = false,
  answerCountByQuestionId,
  answersLoading = false,
  onSelectQuestion,
}: {
  categories: Category[];
  selectedCategoryIds: string[];
  onToggleCategory: (categoryId: string) => void;
  onResetCategories: () => void;
  questions: Question[];
  totalQuestionCount: number;
  loading?: boolean;
  answerCountByQuestionId: ReadonlyMap<string, number>;
  answersLoading?: boolean;
  onSelectQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();
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
  const pageSize = viewMode === "grid" ? GRID_PAGE_SIZE : LIST_PAGE_SIZE;

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
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const rangeStart = filteredQuestions.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, filteredQuestions.length);
  const visibleQuestions = filteredQuestions.slice(rangeStart - 1, rangeEnd);
  const paginationItems = getMaterialPaginationItems(page, totalPages);
  const firstPaginationPage = paginationItems[0] ?? 1;
  const lastPaginationPage = paginationItems.at(-1) ?? totalPages;
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    typeFilter !== "all" ||
    weekFilter !== "all" ||
    selectedCategoryIds.length > 0;

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
        className="mb-4 inline-flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-white px-4 text-sm font-medium text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
      >
        {language === "id" ? "Filter soal" : "Question filters"}
        <span className="text-xs font-semibold text-brand">
          {filtersOpen ? (language === "id" ? "Tutup" : "Close") : language === "id" ? "Buka" : "Open"}
        </span>
      </button>

      <div className="grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <aside
          id="question-catalog-filters"
          className={filtersOpen ? "block" : "hidden lg:block"}
        >
          <div className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold tracking-[-0.01em] text-navy-deep">
                {language === "id" ? "Filter" : "Filters"}
              </h2>
              <button
                type="button"
                onClick={resetFilters}
                disabled={!hasActiveFilters}
                className="cursor-pointer text-[11px] font-medium text-brand disabled:cursor-default disabled:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {language === "id" ? "Reset semua" : "Reset all"}
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-navy-deep">
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
                    className="academic-input h-9 min-w-0 pl-8 pr-2.5 text-xs placeholder:text-muted/70"
                  />
                </span>
              </label>

              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-navy-deep">
                  {language === "id" ? "KC / Konsep" : "KC / Concept"}
                </legend>
                <div className="grid gap-1">
                  {categories.map((category) => {
                    const active = selectedCategoryIds.includes(category.id);
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => onToggleCategory(category.id)}
                        aria-pressed={active}
                        className={cn(
                          "group flex min-h-7 cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[11px] font-normal transition-colors active:translate-y-0",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                          active ? "text-brand" : "text-muted hover:bg-white hover:text-navy-deep",
                        )}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            "grid size-3 shrink-0 place-items-center rounded-[3px] border transition-colors",
                            active
                              ? "border-brand bg-brand text-white"
                              : "border-border bg-white group-hover:border-brand/40",
                          )}
                        >
                          {active && <Check size={9} strokeWidth={3} />}
                        </span>
                        <span className="truncate">{t(category.name, language)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-navy-deep">
                  {language === "id" ? "Minggu" : "Week"}
                </span>
                <span className="relative block">
                  <select
                    value={weekFilter}
                    onChange={(event) => {
                      setWeekFilter(event.target.value);
                      setCurrentPage(1);
                    }}
                    className="academic-input h-9 min-w-0 cursor-pointer appearance-none rounded-md pl-2.5 pr-8 text-xs leading-none"
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
                  <ChevronDown
                    size={13}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted"
                  />
                </span>
              </label>

              <fieldset>
                <legend className="mb-1.5 text-xs font-medium text-navy-deep">
                  {language === "id" ? "Jenis soal" : "Question type"}
                </legend>
                <div className="grid grid-cols-2 gap-1.5">
                  {(["ps", "mp"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setTypeFilter((current) => (current === value ? "all" : value));
                        setCurrentPage(1);
                      }}
                      aria-pressed={typeFilter === value}
                      className={cn(
                        "min-h-8 cursor-pointer rounded-md border px-2 py-1 text-[11px] font-medium transition-colors active:translate-y-0",
                        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        typeFilter === value
                          ? "border-brand bg-brand-soft text-brand-deep"
                          : "border-border bg-white text-muted hover:border-brand/30 hover:text-navy-deep",
                      )}
                    >
                      {value === "ps"
                        ? language === "id"
                          ? "Esai"
                          : "Essay"
                        : language === "id"
                          ? "Pilihan Ganda"
                          : "Multiple Choice"}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>

        </aside>

        <section
          className="flex min-w-0 flex-col lg:min-h-[34rem] lg:pt-1.5"
          aria-labelledby="question-catalog-title"
        >
          <header className="flex items-end justify-between gap-4 border-b border-border pb-4">
            <div className="min-w-0">
              <h1
                id="question-catalog-title"
                className="text-[1.75rem] font-semibold leading-tight tracking-[-0.025em] text-navy-deep sm:text-[1.875rem]"
              >
                {language === "id" ? "Katalog Soal" : "Question Catalog"}
              </h1>
              <p className="mt-1 text-xs leading-5 text-muted" role="status">
                {filteredQuestions.length === totalQuestionCount
                  ? language === "id"
                    ? `${totalQuestionCount} soal tersedia`
                    : `${totalQuestionCount} questions available`
                  : language === "id"
                    ? `${filteredQuestions.length} dari ${totalQuestionCount} soal`
                    : `${filteredQuestions.length} of ${totalQuestionCount} questions`}
              </p>
            </div>

            <div
              className="flex shrink-0 rounded-md border border-border bg-white p-0.5"
              role="group"
              aria-label={language === "id" ? "Tampilan katalog" : "Catalog view"}
            >
              <button
                type="button"
                onClick={() => {
                  setViewMode("grid");
                  setCurrentPage(1);
                }}
                aria-pressed={viewMode === "grid"}
                aria-label={language === "id" ? "Tampilan kisi" : "Grid view"}
                style={{ transform: "none" }}
                className={cn(
                  "grid size-8 cursor-pointer place-items-center rounded-[4px] transition-colors active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  viewMode === "grid" ? "bg-brand-soft text-brand" : "text-muted hover:text-navy-deep",
                )}
              >
                <Grid2X2 size={14} strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("list");
                  setCurrentPage(1);
                }}
                aria-pressed={viewMode === "list"}
                aria-label={language === "id" ? "Tampilan daftar" : "List view"}
                style={{ transform: "none" }}
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
                    ? "Belum ada soal yang tersedia."
                    : "No questions are available yet."
              }
            />
          ) : (
            <>
              <ul
                className={cn(
                  "mt-4 grid",
                  viewMode === "grid" ? "gap-3 md:grid-cols-2" : "gap-2.5",
                )}
              >
                {visibleQuestions.map((question) => {
                  const shortDescription = question.shortDescription
                    ? t(question.shortDescription, language).trim()
                    : "";
                  const storedTitle = t(question.title, language).trim();
                  const title = storedTitle || `${language === "id" ? "Soal" : "Question"} ${question.number || question.id}`;
                  const questionConcepts = getMaterialQuestionConcepts(question);
                  const visibleConcepts = questionConcepts.slice(0, 2);
                  const hiddenConceptCount = questionConcepts.length - visibleConcepts.length;
                  const questionIdentifier = getMaterialQuestionIdentifier(question);
                  const questionType = getMaterialQuestionType(question.type);
                  const questionTypeLabel =
                    questionType === "ps"
                      ? language === "id"
                        ? "Esai"
                        : "Essay"
                      : language === "id"
                        ? "Pilihan Ganda"
                        : "Multiple Choice";
                  const misconceptionCount = question.questionMisconceptionIds.length;
                  const answerCount = answerCountByQuestionId.get(question.id) ?? 0;

                  return (
                    <li key={question.id} className="flex min-w-0">
                      <button
                        type="button"
                        data-question-id={question.id}
                        onClick={() => onSelectQuestion(question.id)}
                        className={cn(
                          "group w-full cursor-pointer rounded-lg border border-border bg-white text-left transition-[border-color,box-shadow] active:translate-y-0 hover:border-brand/35 hover:shadow-[0_9px_22px_rgba(143,28,32,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                          viewMode === "grid"
                            ? "flex min-h-[10.75rem] flex-col gap-3 px-4 py-3.5"
                            : "min-h-[8rem] p-3 sm:min-h-[6.5rem] md:min-h-16",
                        )}
                      >
                        {viewMode === "grid" ? (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <span className="max-w-[65%] truncate font-mono text-[11px] font-medium tabular-nums text-muted md:text-[10px]">
                                {questionIdentifier}
                              </span>
                              <span
                                className={cn(
                                  "shrink-0 rounded px-2 py-0.5 text-[10px] font-medium md:text-[9px]",
                                  questionType === "ps"
                                    ? "bg-brand-soft text-brand-deep"
                                    : "bg-[#f2eee7] text-[#76502f]",
                                )}
                              >
                                {questionTypeLabel}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <h2 className="line-clamp-2 text-sm font-semibold leading-5 text-navy-deep transition-colors group-hover:text-brand">
                                {title}
                              </h2>
                              {shortDescription && (
                                <p className="mt-1 line-clamp-2 whitespace-pre-line text-[11px] leading-[1.55] text-muted">
                                  {shortDescription}
                                </p>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1">
                              {question.week && (
                                <span className="rounded border border-border bg-neutral/70 px-1.5 py-0.5 text-[10px] font-medium text-muted md:text-[9px]">
                                  {getMaterialWeekLabel(question.week)}
                                </span>
                              )}
                              {visibleConcepts.map((concept, conceptIndex) => (
                                <span
                                  key={`${t(concept, language)}-${conceptIndex}`}
                                  className="rounded border border-border bg-neutral/70 px-1.5 py-0.5 text-[10px] font-medium text-muted md:text-[9px]"
                                >
                                  {t(concept, language)}
                                </span>
                              ))}
                              {hiddenConceptCount > 0 && (
                                <span className="px-1 py-0.5 text-[10px] text-muted md:text-[9px]">
                                  +{hiddenConceptCount}
                                </span>
                              )}
                            </div>

                            <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-2.5 text-[11px] md:text-[10px]">
                              <span className="inline-flex items-center gap-3 text-muted">
                                <span className="tabular-nums">
                                  {misconceptionCount} {language === "id" ? "miskonsepsi" : "misconceptions"}
                                </span>
                                <span className="inline-flex items-center gap-1.5 tabular-nums">
                                <MessageSquareText size={12} strokeWidth={2} aria-hidden="true" />
                                {answersLoading ? "..." : answerCount}{" "}
                                {language === "id" ? "jawaban" : "answers"}
                                </span>
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-1 font-medium text-brand">
                                {language === "id" ? "Lihat soal" : "View question"}
                                <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="grid w-full min-w-0 gap-3 sm:grid-cols-[5rem_minmax(0,1fr)] sm:items-center md:grid-cols-[5rem_minmax(0,1fr)_auto] md:gap-4">
                            <div className="flex min-w-0 items-center gap-2 sm:flex-col sm:items-start sm:gap-1">
                              <span className="max-w-full truncate font-mono text-[11px] font-medium tabular-nums text-muted md:text-[10px]">
                                {questionIdentifier}
                              </span>
                              <span
                                className={cn(
                                  "max-w-full truncate rounded px-2 py-0.5 text-[10px] font-medium md:text-[9px]",
                                  questionType === "ps"
                                    ? "bg-brand-soft text-brand-deep"
                                    : "bg-[#f2eee7] text-[#76502f]",
                                )}
                              >
                                {questionTypeLabel}
                              </span>
                            </div>

                            <div className="min-w-0">
                              <h2 className="line-clamp-1 text-[13px] font-semibold leading-5 text-navy-deep transition-colors group-hover:text-brand">
                                {title}
                              </h2>
                              <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-1 text-[10px] font-medium text-muted md:text-[9px]">
                                {question.week && (
                                  <span className="rounded border border-border bg-neutral/70 px-1.5 py-0.5">
                                    {getMaterialWeekLabel(question.week)}
                                  </span>
                                )}
                                {visibleConcepts.map((concept, conceptIndex) => (
                                  <span
                                    key={`${t(concept, language)}-${conceptIndex}`}
                                    className="rounded border border-border bg-neutral/70 px-1.5 py-0.5"
                                  >
                                    {t(concept, language)}
                                  </span>
                                ))}
                                {hiddenConceptCount > 0 && <span>+{hiddenConceptCount}</span>}
                                <span className="ml-1 tabular-nums">
                                  {misconceptionCount} {language === "id" ? "miskonsepsi" : "misconceptions"}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-4 sm:col-span-2 md:col-span-1 md:min-w-[16.5rem] md:justify-end">
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-normal tabular-nums text-muted md:text-[10px]">
                                <MessageSquareText size={13} strokeWidth={2} aria-hidden="true" />
                                {answersLoading ? "..." : answerCount}{" "}
                                {language === "id" ? "jawaban" : "answers"}
                              </span>
                              <span className="inline-flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-brand md:text-[10px]">
                                {language === "id" ? "Lihat" : "View"}
                                <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
                              </span>
                            </div>
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-5 flex min-h-11 flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs tabular-nums text-muted" role="status" aria-live="polite">
                  {language === "id"
                    ? `Menampilkan ${rangeStart}-${rangeEnd} dari ${filteredQuestions.length} soal`
                    : `Showing ${rangeStart}-${rangeEnd} of ${filteredQuestions.length} questions`}
                </p>

                {totalPages > 1 && (
                  <nav
                    aria-label={language === "id" ? "Paginasi soal" : "Question pagination"}
                    className="grid w-[13.25rem] max-w-full grid-cols-6 items-center gap-1"
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

                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-8 place-items-center text-xs text-muted",
                        firstPaginationPage === 1 && "invisible",
                      )}
                    >
                      ...
                    </span>

                    {paginationItems.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        aria-current={item === page ? "page" : undefined}
                        aria-label={`${language === "id" ? "Halaman" : "Page"} ${item}`}
                        style={{ transform: "none" }}
                        className={cn(
                          "grid size-8 cursor-pointer place-items-center rounded-md text-[11px] font-medium tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                          item === page
                            ? "bg-brand text-white"
                            : "text-muted hover:bg-neutral hover:text-navy-deep",
                        )}
                      >
                        {item}
                      </button>
                    ))}

                    {paginationItems.length < 2 && <span aria-hidden="true" className="size-8" />}

                    <span
                      aria-hidden="true"
                      className={cn(
                        "grid size-8 place-items-center text-xs text-muted",
                        lastPaginationPage === totalPages && "invisible",
                      )}
                    >
                      ...
                    </span>

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
