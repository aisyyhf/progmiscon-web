import { useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ListChecks } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import type {
  MpQuestionNavigatorItem,
  MpQuestionWeek,
} from "../../utils/mpQuestionNavigator";
import {
  MP_QUESTION_NAVIGATOR_PAGE_SIZE,
  clampMpQuestionNavigatorPageIndex,
  getMpQuestionNavigatorPageCount,
  getMpQuestionNavigatorPageIndex,
  getMpQuestionNavigatorPageItems,
} from "../../utils/mpQuestionNavigator";
import { REVIEW_WEEK_UNASSIGNED } from "../../utils/reviewQuestionFilters";
import { cn } from "../../utils/cn";
import { Button } from "../common/Button";

function weekLabel(week: string, language: "id" | "en"): string {
  if (week === REVIEW_WEEK_UNASSIGNED) {
    return language === "id" ? "Tanpa minggu" : "No week";
  }

  const match = /^W(\d+)(?:-(\d+))?$/i.exec(week);
  if (!match) return week;
  const range = match[2]
    ? `${Number(match[1])}–${Number(match[2])}`
    : String(Number(match[1]));
  return `${language === "id" ? "Minggu" : "Week"} ${range}`;
}

function QuestionGrid({
  items,
  countsAvailable,
  countsLoading,
  onSelect,
}: {
  items: readonly MpQuestionNavigatorItem[];
  countsAvailable: boolean;
  countsLoading: boolean;
  onSelect: (questionId: string) => void;
}) {
  const { language } = useLanguage();

  return (
    <div
      className="grid grid-cols-4 gap-1 sm:grid-cols-5"
      aria-label={
        language === "id" ? "Nomor soal minggu aktif" : "Active week questions"
      }
    >
      {items.map((item) => {
        const countText = countsAvailable
          ? `${Math.min(item.reviewCount, 3)}/3`
          : countsLoading
            ? "…/3"
            : "—/3";
        const aggregateState = countsAvailable
          ? item.reviewStatus === "reviewed"
            ? language === "id"
              ? "selesai"
              : "complete"
            : item.reviewStatus === "under_review"
              ? language === "id"
                ? "sedang direview"
                : "under review"
              : language === "id"
                ? "belum direview"
                : "not reviewed"
          : countsLoading
            ? language === "id"
              ? "jumlah reviewer sedang dimuat"
              : "reviewer count is loading"
            : language === "id"
              ? "jumlah reviewer tidak tersedia"
              : "reviewer count is unavailable";
        const statusClass = item.active
          ? "border-brand bg-brand text-white ring-1 ring-brand"
          : !item.matchesFilters
            ? "cursor-not-allowed border-dashed border-border bg-neutral text-muted opacity-40"
            : item.reviewedByMe
              ? "border-brand/45 bg-brand-soft text-brand-deep"
              : !countsAvailable
                ? "border-border bg-white text-navy-deep"
                : item.reviewStatus === "reviewed"
                  ? "border-correct-border bg-correct-bg text-correct"
                  : item.reviewStatus === "under_review"
                    ? "border-brand/30 bg-brand-soft/70 text-brand-deep"
                    : "border-border bg-white text-navy-deep";
        const label = [
          `${language === "id" ? "Soal" : "Question"} ${item.displayNumber}`,
          item.active ? (language === "id" ? "aktif" : "active") : "",
          item.reviewedByMe
            ? language === "id"
              ? "sudah Anda review"
              : "reviewed by you"
            : "",
          aggregateState,
          countsAvailable
            ? `${item.reviewCount} ${language === "id" ? "dari" : "of"} 3 reviewer`
            : "",
          !item.matchesFilters
            ? language === "id"
              ? "tidak cocok dengan filter aktif"
              : "does not match the active filters"
            : "",
          `Question ID ${item.question.id}`,
        ]
          .filter(Boolean)
          .join(" — ");

        return (
          <button
            key={item.question.id}
            type="button"
            aria-label={label}
            aria-current={item.active ? "true" : undefined}
            disabled={!item.matchesFilters}
            title={label}
            onClick={() => onSelect(item.question.id)}
            className={cn(
              "relative flex min-h-[30px] cursor-pointer flex-col items-center justify-center rounded border px-0.5 py-0 text-center tabular-nums transition-[border-color,background-color,box-shadow,opacity,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              statusClass,
            )}
          >
            {item.reviewedByMe && (
              <Check
                size={10}
                strokeWidth={3}
                aria-hidden="true"
                className="absolute right-0.5 top-0.5"
              />
            )}
            <span className="text-[11px] font-extrabold leading-3">
              {item.displayNumber}
            </span>
            <span className="inline-flex items-center gap-px text-[8px] font-bold leading-3">
              {countsAvailable && item.reviewStatus === "reviewed" && (
                <Check size={8} strokeWidth={3} aria-hidden="true" />
              )}
              {countText}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function MpQuestionQuizNavigator({
  weeks,
  activeWeek,
  items,
  matchingCount,
  countsAvailable,
  countsLoading,
  countsError,
  weekComplete,
  weekGloballyComplete,
  nextWeek,
  onSelectWeek,
  onSelectQuestion,
}: {
  weeks: readonly MpQuestionWeek[];
  activeWeek: string | undefined;
  items: readonly MpQuestionNavigatorItem[];
  matchingCount: number;
  countsAvailable: boolean;
  countsLoading: boolean;
  countsError: string;
  weekComplete: boolean;
  weekGloballyComplete: boolean;
  nextWeek: string | undefined;
  onSelectWeek: (week: string) => void;
  onSelectQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();
  const activeItemIndex = items.findIndex((item) => item.active);
  const [pageIndex, setPageIndex] = useState(() =>
    getMpQuestionNavigatorPageIndex(activeItemIndex, items.length),
  );
  const pageCount = getMpQuestionNavigatorPageCount(items.length);
  const visiblePageIndex = clampMpQuestionNavigatorPageIndex(
    pageIndex,
    items.length,
  );
  const visibleItems = getMpQuestionNavigatorPageItems(
    items,
    visiblePageIndex,
  );
  const rangeStart =
    items.length === 0
      ? 0
      : visiblePageIndex * MP_QUESTION_NAVIGATOR_PAGE_SIZE + 1;
  const rangeEnd = Math.min(
    rangeStart + MP_QUESTION_NAVIGATOR_PAGE_SIZE - 1,
    items.length,
  );

  useEffect(() => {
    setPageIndex((current) =>
      activeItemIndex >= 0
        ? getMpQuestionNavigatorPageIndex(activeItemIndex, items.length)
        : clampMpQuestionNavigatorPageIndex(current, items.length),
    );
  }, [activeItemIndex, activeWeek, items.length]);

  const grid = (
    <QuestionGrid
      items={visibleItems}
      countsAvailable={countsAvailable}
      countsLoading={countsLoading}
      onSelect={onSelectQuestion}
    />
  );

  return (
    <nav
      aria-label={
        language === "id"
          ? "Navigator soal MP per minggu"
          : "Weekly MP question navigator"
      }
      className="rounded-lg border border-border bg-white p-2"
    >
      <div
        className="flex flex-wrap items-center gap-1"
        role="tablist"
        aria-label={language === "id" ? "Daftar minggu" : "Week list"}
      >
        <p className="mr-0.5 text-[10px] font-bold text-navy-deep">
          {language === "id" ? "Pilih minggu:" : "Choose a week:"}
        </p>
        {weeks.map((week) => (
          <button
            key={week.key}
            type="button"
            role="tab"
            aria-selected={activeWeek === week.key}
            onClick={() => onSelectWeek(week.key)}
            className={cn(
              "min-h-6 cursor-pointer rounded-full border px-1.5 py-0.5 text-[9px] font-semibold leading-3 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              activeWeek === week.key
                ? "border-brand bg-brand text-white"
                : "border-border bg-neutral/70 text-navy-deep hover:border-brand/35 hover:bg-brand-soft hover:text-brand-deep",
            )}
          >
            {weekLabel(week.key, language)}
          </button>
        ))}
      </div>

      <div className="mt-1 border-t border-border pt-1">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="shrink-0 text-[9px] font-semibold tabular-nums text-navy-deep" aria-live="polite">
              {rangeStart}–{rangeEnd} {language === "id" ? "dari" : "of"}{" "}
              {items.length}
            </p>
            {countsLoading ? (
              <span className="truncate text-[9px] text-muted" role="status">
                {language === "id" ? "Memuat reviewer…" : "Loading reviewers…"}
              </span>
            ) : countsError ? (
              <span className="truncate text-[9px] text-warning" role="status">
                {language === "id" ? "Reviewer tidak tersedia" : "Reviewers unavailable"}
              </span>
            ) : null}
          </div>

          {pageCount > 1 && (
            <div
              className="flex items-center gap-0.5"
              aria-label={
                language === "id"
                  ? "Halaman navigator soal"
                  : "Question navigator pages"
              }
            >
              <button
                type="button"
                disabled={visiblePageIndex === 0}
                onClick={() => setPageIndex((current) => current - 1)}
                aria-label={
                  language === "id"
                    ? "Halaman navigator sebelumnya"
                    : "Previous navigator page"
                }
                className="flex h-5 min-w-5 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-neutral hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronLeft size={11} aria-hidden="true" />
              </button>
              {Array.from({ length: pageCount }, (_, index) => (
                <button
                  key={index}
                  type="button"
                  aria-current={visiblePageIndex === index ? "page" : undefined}
                  aria-label={`${language === "id" ? "Halaman navigator" : "Navigator page"} ${index + 1}`}
                  onClick={() => setPageIndex(index)}
                  className={cn(
                    "flex h-5 min-w-5 cursor-pointer items-center justify-center rounded px-1 text-[9px] font-bold tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand",
                    visiblePageIndex === index
                      ? "bg-brand text-white"
                      : "bg-neutral text-muted hover:bg-brand-soft hover:text-brand-deep",
                  )}
                >
                  {index + 1}
                </button>
              ))}
              <button
                type="button"
                disabled={visiblePageIndex >= pageCount - 1}
                onClick={() => setPageIndex((current) => current + 1)}
                aria-label={
                  language === "id"
                    ? "Halaman navigator berikutnya"
                    : "Next navigator page"
                }
                className="flex h-5 min-w-5 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-neutral hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-30"
              >
                <ChevronRight size={11} aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div className="hidden md:block">{grid}</div>
        <details className="group rounded border border-border bg-neutral/45 md:hidden">
          <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-1.5 text-xs font-semibold text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <span className="flex items-center gap-1.5">
              <ListChecks size={14} aria-hidden="true" />
              {language === "id" ? "Daftar soal" : "Question list"}
            </span>
            <ChevronRight
              size={14}
              aria-hidden="true"
              className="transition-transform group-open:rotate-90"
            />
          </summary>
          <div className="border-t border-border bg-white p-2">{grid}</div>
        </details>

        {matchingCount === 0 && items.length > 0 && (
          <p className="mt-2 rounded bg-neutral px-2 py-1.5 text-[10px] leading-4 text-muted" role="status">
            {language === "id"
              ? "Tidak ada soal yang cocok. Kotak pudar tetap menunjukkan nomor aslinya; reset atau ubah filter untuk membukanya."
              : "No questions match. Muted boxes keep their original numbers; reset or change the filters to open them."}
          </p>
        )}

        <div className="mt-1 flex flex-wrap gap-x-1.5 gap-y-0.5 border-t border-border pt-1 text-[8px] font-medium leading-3 text-muted" aria-label={language === "id" ? "Legenda status soal" : "Question status legend"}>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-brand" aria-hidden="true" />
            {language === "id" ? "Aktif" : "Active"}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex h-2.5 w-2.5 items-center justify-center rounded-sm border border-brand/45 bg-brand-soft text-brand">
              <Check size={7} strokeWidth={3} aria-hidden="true" />
            </span>
            {language === "id" ? "Sudah Anda review" : "Reviewed by you"}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm border border-brand/30 bg-brand-soft" aria-hidden="true" />
            {language === "id" ? "Berjalan" : "In progress"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Check size={8} strokeWidth={3} className="text-correct" aria-hidden="true" />
            {language === "id" ? "Selesai" : "Complete"}
          </span>
          <span className="inline-flex items-center gap-1 opacity-50">
            <span className="h-2 w-2 rounded-sm border border-dashed border-muted" aria-hidden="true" />
            {language === "id" ? "Tidak cocok filter" : "Filtered out"}
          </span>
        </div>
      </div>

      {(weekComplete || weekGloballyComplete) && activeWeek && (
        <div className="mt-2 flex flex-col gap-1.5 rounded border border-correct-border bg-correct-bg px-2.5 py-2">
          <div>
            <p className="text-[11px] font-semibold leading-4 text-correct" role="status">
              {weekComplete
                ? language === "id"
                  ? `Semua soal MP pada ${weekLabel(activeWeek, language)} sudah Anda review.`
                  : `You have reviewed every MP question in ${weekLabel(activeWeek, language)}.`
                : language === "id"
                  ? `Semua soal MP pada ${weekLabel(activeWeek, language)} telah selesai oleh 3 reviewer.`
                  : `Every MP question in ${weekLabel(activeWeek, language)} is complete with 3 reviewers.`}
            </p>
          </div>
          {nextWeek && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onSelectWeek(nextWeek)}
              className="min-h-7 shrink-0 justify-center !gap-1 !px-2 !py-1 !text-[11px]"
            >
              {language === "id" ? "Lanjut ke" : "Continue to"} {weekLabel(nextWeek, language)}
              <ChevronRight size={15} aria-hidden="true" />
            </Button>
          )}
        </div>
      )}
    </nav>
  );
}
