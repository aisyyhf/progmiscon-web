import { Check, ChevronRight, ListChecks } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import type {
  MpQuestionNavigatorItem,
  MpQuestionWeek,
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
      className="grid grid-cols-[repeat(auto-fit,minmax(2.5rem,1fr))] gap-1"
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
              "relative flex min-h-10 cursor-pointer flex-col items-center justify-center rounded border px-0.5 py-0.5 text-center tabular-nums transition-[border-color,background-color,box-shadow,opacity,transform] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              !countsAvailable
                ? "border-border bg-neutral text-navy-deep"
                : item.reviewStatus === "reviewed"
                  ? "border-correct-border bg-correct-bg text-correct"
                  : item.reviewStatus === "under_review"
                    ? "border-warning-border bg-warning-bg text-warning"
                    : "border-border bg-neutral text-navy-deep",
              item.reviewedByMe && "border-brand bg-brand-soft text-brand-deep",
              item.active &&
                "border-brand bg-white text-brand-deep ring-2 ring-brand",
              !item.matchesFilters &&
                "cursor-not-allowed border-dashed bg-neutral text-muted opacity-40",
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
            <span className="text-xs font-extrabold leading-3">
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
  const filtersReduceResults = matchingCount < items.length;
  const grid = (
    <QuestionGrid
      items={items}
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
      className="rounded-lg border border-border bg-white p-3"
    >
      <p className="text-xs font-bold text-navy-deep">
        {language === "id" ? "Pilih minggu" : "Choose a week"}
      </p>

      <div
        className="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(4.75rem,1fr))] gap-1"
        role="tablist"
        aria-label={language === "id" ? "Daftar minggu" : "Week list"}
      >
        {weeks.map((week) => (
          <button
            key={week.key}
            type="button"
            role="tab"
            aria-selected={activeWeek === week.key}
            onClick={() => onSelectWeek(week.key)}
            className={cn(
              "min-h-7 cursor-pointer rounded border px-1.5 py-1 text-[11px] font-semibold leading-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              activeWeek === week.key
                ? "border-brand bg-brand text-white"
                : "border-border bg-white text-muted hover:border-brand/35 hover:bg-brand-soft hover:text-brand-deep",
            )}
          >
            {weekLabel(week.key, language)}
          </button>
        ))}
      </div>

      <div className="mt-2 border-t border-border pt-2">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <p className="text-[11px] font-semibold tabular-nums text-navy-deep" aria-live="polite">
            {language === "id"
              ? filtersReduceResults
                ? `${matchingCount} soal cocok`
                : `${items.length} soal`
              : filtersReduceResults
                ? `${matchingCount} questions match`
                : `${items.length} questions`}
          </p>
          {countsLoading ? (
            <span className="text-[10px] text-muted" role="status">
              {language === "id"
                ? "Memuat jumlah reviewer…"
                : "Loading reviewer counts…"}
            </span>
          ) : countsError ? (
            <span className="text-[10px] text-warning" role="status">
              {language === "id"
                ? "Jumlah reviewer tidak tersedia"
                : "Reviewer counts unavailable"}
            </span>
          ) : null}
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

        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 border-t border-border pt-2 text-[9px] font-medium leading-3 text-muted" aria-label={language === "id" ? "Legenda status soal" : "Question status legend"}>
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm border-2 border-brand bg-white" aria-hidden="true" />
            {language === "id" ? "Aktif" : "Active"}
          </span>
          <span className="inline-flex items-center gap-1">
            <Check size={11} strokeWidth={3} className="text-brand" aria-hidden="true" />
            {language === "id" ? "Sudah Anda review" : "Reviewed by you"}
          </span>
          <span>0/3 · {language === "id" ? "Belum" : "Not started"}</span>
          <span>1/3–2/3 · {language === "id" ? "Berjalan" : "In progress"}</span>
          <span className="inline-flex items-center gap-0.5">
            <Check size={9} strokeWidth={3} className="text-correct" aria-hidden="true" />
            3/3 · {language === "id" ? "Selesai" : "Complete"}
          </span>
          <span className="opacity-50">□ · {language === "id" ? "Tidak cocok filter" : "Filtered out"}</span>
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
