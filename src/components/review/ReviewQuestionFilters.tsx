import type { Category, Misconception, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { getMaterialWeekOptions } from "../../utils/materialQuestionFilters";
import { misconceptionLabel } from "../../utils/misconceptionLabel";
import {
  DEFAULT_REVIEW_QUESTION_FILTERS,
  REVIEW_FILTER_ALL,
  REVIEW_MISCONCEPTION_NONE,
  REVIEW_WEEK_UNASSIGNED,
  type ReviewQuestionFilters as ReviewQuestionFilterValues,
} from "../../utils/reviewQuestionFilters";
import { t } from "../../utils/translation";
import { Button } from "../common/Button";

export function ReviewQuestionFilters({
  questions,
  categories,
  misconceptions,
  filters,
  panelId,
  statusAvailable,
  statusLoading,
  statusError,
  showWeek = true,
  onChange,
}: {
  questions: readonly Question[];
  categories: readonly Category[];
  misconceptions: readonly Misconception[];
  filters: ReviewQuestionFilterValues;
  panelId: string;
  statusAvailable: boolean;
  statusLoading: boolean;
  statusError: string;
  showWeek?: boolean;
  onChange: (filters: ReviewQuestionFilterValues) => void;
}) {
  const { language } = useLanguage();
  const weekOptions = getMaterialWeekOptions([...questions]);
  const statusDisabled = statusLoading || !statusAvailable;
  const statusHelper = statusLoading
    ? language === "id"
      ? "Status agregat sedang dimuat."
      : "Aggregate review status is loading."
    : statusError
      ? language === "id"
        ? statusError
        : "Aggregate review status could not be loaded."
      : !statusAvailable
        ? language === "id"
          ? "Status agregat belum tersedia."
          : "Aggregate review status is unavailable."
        : "";
  const controlClass =
    "academic-input min-h-10 px-3 py-2 text-sm text-navy-deep disabled:cursor-not-allowed disabled:bg-neutral disabled:text-muted";
  const missingWeek =
    filters.week !== REVIEW_FILTER_ALL &&
    filters.week !== REVIEW_WEEK_UNASSIGNED &&
    !weekOptions.includes(filters.week);
  const missingCategory =
    filters.categoryId !== REVIEW_FILTER_ALL &&
    !categories.some((category) => category.id === filters.categoryId);
  const missingMisconception =
    filters.misconceptionId !== REVIEW_FILTER_ALL &&
    filters.misconceptionId !== REVIEW_MISCONCEPTION_NONE &&
    !misconceptions.some(
      (misconception) => misconception.id === filters.misconceptionId,
    );
  const setFilter = <Key extends keyof ReviewQuestionFilterValues>(
    key: Key,
    value: ReviewQuestionFilterValues[Key],
  ) => onChange({ ...filters, [key]: value });

  return (
    <section
      id={panelId}
      aria-label={language === "id" ? "Filter soal" : "Question filters"}
      className="review-filter-panel mb-4 rounded-lg border border-border bg-white p-3 sm:p-4"
    >
      <div
        className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${showWeek ? "lg:grid-cols-6" : "lg:grid-cols-5"}`}
      >
        <label className="sm:col-span-2 lg:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold text-navy-deep">
            {language === "id" ? "Cari Question ID" : "Search Question ID"}
          </span>
          <input
            type="search"
            value={filters.query}
            onChange={(event) => setFilter("query", event.target.value)}
            placeholder={
              language === "id" ? "ID atau nomor soal" : "Question ID or number"
            }
            className={controlClass}
          />
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-semibold text-navy-deep">
            {language === "id" ? "Status" : "Status"}
          </span>
          <select
            value={statusAvailable ? filters.status : REVIEW_FILTER_ALL}
            disabled={statusDisabled}
            aria-disabled={statusDisabled}
            aria-describedby={
              statusHelper ? "review-question-status-help" : undefined
            }
            onChange={(event) =>
              setFilter(
                "status",
                event.target.value as ReviewQuestionFilterValues["status"],
              )
            }
            className={controlClass}
          >
            <option value={REVIEW_FILTER_ALL}>
              {language === "id" ? "Semua status" : "All statuses"}
            </option>
            <option value="unreviewed">
              {language === "id" ? "Belum direview" : "Not reviewed"}
            </option>
            <option value="under_review">
              {language === "id" ? "Sedang direview" : "Under review"}
            </option>
            <option value="reviewed">
              {language === "id" ? "Selesai direview" : "Reviewed"}
            </option>
          </select>
          {statusHelper && (
            <span
              id="review-question-status-help"
              className="mt-1.5 block text-xs leading-5 text-muted"
              aria-live="polite"
            >
              {statusHelper}
            </span>
          )}
        </label>

        {showWeek && <label>
          <span className="mb-1.5 block text-xs font-semibold text-navy-deep">
            Week
          </span>
          <select
            value={filters.week}
            onChange={(event) => setFilter("week", event.target.value)}
            className={controlClass}
          >
            <option value={REVIEW_FILTER_ALL}>
              {language === "id" ? "Semua week" : "All weeks"}
            </option>
            <option value={REVIEW_WEEK_UNASSIGNED}>
              {language === "id" ? "Belum ditentukan" : "Unassigned"}
            </option>
            {missingWeek && (
              <option value={filters.week} disabled>
                {language === "id" ? "Tidak tersedia" : "Unavailable"}: {filters.week}
              </option>
            )}
            {weekOptions.map((week) => (
              <option key={week} value={week}>
                {week}
              </option>
            ))}
          </select>
        </label>}

        <label>
          <span className="mb-1.5 block text-xs font-semibold text-navy-deep">
            KC / {language === "id" ? "Materi" : "Material"}
          </span>
          <select
            value={filters.categoryId}
            onChange={(event) => setFilter("categoryId", event.target.value)}
            className={controlClass}
          >
            <option value={REVIEW_FILTER_ALL}>
              {language === "id" ? "Semua KC" : "All categories"}
            </option>
            {missingCategory && (
              <option value={filters.categoryId} disabled>
                {language === "id" ? "Tidak tersedia" : "Unavailable"}: {filters.categoryId}
              </option>
            )}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.id} - {t(category.name, language)}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1.5 block text-xs font-semibold text-navy-deep">
            {language === "id" ? "Miskonsepsi" : "Misconception"}
          </span>
          <select
            value={filters.misconceptionId}
            onChange={(event) =>
              setFilter("misconceptionId", event.target.value)
            }
            className={controlClass}
          >
            <option value={REVIEW_FILTER_ALL}>
              {language === "id"
                ? "Semua miskonsepsi"
                : "All misconceptions"}
            </option>
            <option value={REVIEW_MISCONCEPTION_NONE}>
              {language === "id"
                ? "Tanpa miskonsepsi"
                : "No misconception"}
            </option>
            {missingMisconception && (
              <option value={filters.misconceptionId} disabled>
                {language === "id" ? "Tidak tersedia" : "Unavailable"}: {filters.misconceptionId}
              </option>
            )}
            {misconceptions.map((misconception) => (
              <option key={misconception.id} value={misconception.id}>
                {misconceptionLabel(misconception, language)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 flex justify-end border-t border-border pt-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            onChange({
              ...DEFAULT_REVIEW_QUESTION_FILTERS,
              week: showWeek
                ? DEFAULT_REVIEW_QUESTION_FILTERS.week
                : filters.week,
            })
          }
          className="w-full justify-center sm:w-auto"
        >
          {language === "id" ? "Reset filter" : "Reset filters"}
        </Button>
      </div>
    </section>
  );
}
