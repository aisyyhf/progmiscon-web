import { useEffect, useMemo, useState } from "react";
import type { Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import {
  DEFAULT_MATERIAL_QUESTION_FILTERS,
  filterMaterialQuestions,
  getMaterialQuestionType,
  getMaterialWeekOptions,
  type MaterialQuestionTypeFilter,
  type MaterialWeekFilter,
} from "../../utils/materialQuestionFilters";
import { EmptyState } from "../common/EmptyState";
import { Button } from "../common/Button";
import { Chip } from "../common/Chip";
import { ArrowRight, Search } from "lucide-react";

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
  const hasActiveFilters =
    Boolean(searchQuery.trim()) || typeFilter !== "all" || weekFilter !== "all";

  const resetFilters = () => {
    setSearchQuery(DEFAULT_MATERIAL_QUESTION_FILTERS.searchQuery);
    setTypeFilter(DEFAULT_MATERIAL_QUESTION_FILTERS.type);
    setWeekFilter(DEFAULT_MATERIAL_QUESTION_FILTERS.week);
  };

  useEffect(resetFilters, [selectedCategoryId]);

  return (
    <div className="scroll-reveal grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-xl border border-border bg-white p-3.5 shadow-[0_1px_2px_rgba(33,29,27,0.04)] lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <h1 className="px-2 pb-3 pt-1 text-lg font-extrabold tracking-tight text-brand">
          {language === "id" ? "Materi Pemrograman" : "Programming Materials"}
        </h1>
        <nav
          aria-label={language === "id" ? "Daftar konsep" : "Concept list"}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1"
        >
          {categories.map((category) => {
            const active = category.id === selectedCategoryId;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                aria-current={active}
                className={cn(
                  "min-h-10 cursor-pointer rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  active
                    ? "bg-brand text-white shadow-[0_3px_10px_rgba(143,28,32,0.12)]"
                    : "bg-white text-navy-deep hover:bg-brand-soft hover:text-brand",
                )}
              >
                {t(category.name, language)}
              </button>
            );
          })}
        </nav>
      </aside>

      <section
        className="min-w-0"
        aria-labelledby={selectedCategory && !loading ? "selected-material-title" : undefined}
      >
        {selectedCategory && !loading && (
          <>
            <header className="pb-5">
              <h2 id="selected-material-title" className="text-2xl font-extrabold tracking-tight text-navy-deep">
                {filteredQuestions.length} {language === "id" ? "Contoh Soal" : "Example Questions"}
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                {language === "id"
                  ? "Pilih soal untuk melihat rincian, variasi jawaban, dan miskonsepsi yang terkait."
                  : "Choose a question to view its details, answer variations, and related misconceptions."}
              </p>
            </header>

            <div className="mb-5 rounded-xl border border-border bg-white p-4 shadow-[0_1px_2px_rgba(33,29,27,0.04)]">
              <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_minmax(10rem,12rem)_auto]">
                <label className="min-w-0">
                  <span className="mb-1.5 block text-xs font-semibold text-navy-deep">
                    {language === "id" ? "Pencarian" : "Search"}
                  </span>
                  <span className="relative block">
                    <Search
                      size={16}
                      strokeWidth={2}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                      aria-hidden="true"
                    />
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder={language === "id" ? "Cari soal..." : "Search questions..."}
                      className="academic-input min-w-0 py-2.5 pl-9 pr-3 text-sm placeholder:text-muted/65"
                    />
                  </span>
                </label>

                <fieldset className="min-w-0">
                  <legend className="mb-1.5 text-xs font-semibold text-navy-deep">
                    {language === "id" ? "Jenis soal" : "Question type"}
                  </legend>
                  <div className="flex flex-wrap gap-1.5">
                    {(["all", "ps", "mp"] as const).map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setTypeFilter(value)}
                        aria-pressed={typeFilter === value}
                        className={cn(
                          "min-h-10 cursor-pointer rounded-md border px-3 py-2 text-xs font-semibold transition-colors",
                          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                          typeFilter === value
                            ? "border-brand bg-brand text-white"
                            : "border-border bg-white text-muted hover:border-navy/35 hover:bg-neutral hover:text-navy-deep",
                        )}
                      >
                        {value === "all" ? (language === "id" ? "Semua" : "All") : value.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <label className="min-w-0">
                  <span className="mb-1.5 block text-xs font-semibold text-navy-deep">Week</span>
                  <select
                    value={weekFilter}
                    onChange={(event) => setWeekFilter(event.target.value)}
                    className="academic-input h-10 min-w-0 cursor-pointer px-3 text-sm"
                  >
                    <option value="all">{language === "id" ? "Semua week" : "All weeks"}</option>
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

                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={resetFilters}
                    disabled={!hasActiveFilters}
                    className="w-full justify-center sm:w-auto"
                  >
                    {language === "id" ? "Reset filter" : "Reset filters"}
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {loading ? (
          <div className="mt-6">
            <EmptyState loading message={language === "id" ? "Memuat soal..." : "Loading questions..."} />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              message={
                hasActiveFilters
                  ? language === "id"
                    ? "Tidak ada soal yang sesuai dengan filter"
                    : "No questions match the selected filters"
                  : language === "id"
                    ? "Belum ada contoh soal untuk materi ini. Pilih materi lain dari daftar."
                    : "No example questions are available for this material yet. Choose another material from the list."
              }
            />
          </div>
        ) : (
          <div>
            <ul className="grid gap-4 md:grid-cols-2">
              {filteredQuestions.map((question) => (
                <li
                  key={question.id}
                  className="flex h-full"
                >
                  <button
                    type="button"
                    data-question-id={question.id}
                    onClick={() => onSelectQuestion(question.id)}
                    className="group flex min-h-64 w-full cursor-pointer flex-col rounded-xl border border-border bg-white p-5 text-left shadow-[0_2px_8px_rgba(33,29,27,0.05)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_8px_24px_rgba(33,29,27,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap gap-2">
                        <Chip className="border-brand/15 bg-brand-soft px-2.5 py-1 text-brand-deep shadow-none">
                          {getMaterialQuestionType(question.type).toUpperCase()}
                        </Chip>
                        {question.week && (
                          <Chip className="px-2.5 py-1 shadow-none">{question.week}</Chip>
                        )}
                      </div>
                      <p className="whitespace-pre-line text-base font-normal leading-6 text-navy-deep transition-colors group-hover:text-brand">
                        {t(question.prompt, language)}
                      </p>
                    </div>

                    <div className="mt-auto pt-5">
                      <p className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-deep">
                        {question.questionMisconceptionIds.length}{" "}
                        {language === "id" ? "miskonsepsi terkait" : "related misconceptions"}
                      </p>

                      <span className="mt-7 flex w-fit items-center gap-2 rounded-md bg-brand px-3.5 py-2.5 text-xs font-semibold text-white transition-colors group-hover:bg-brand-deep">
                        {language === "id" ? "Lihat soal" : "View question"}
                        <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
