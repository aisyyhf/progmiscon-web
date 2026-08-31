import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  Info,
  Pencil,
  Search,
  Trash2,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { EmptyState } from "../components/common/EmptyState";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { useMisconceptions } from "../hooks/useMisconceptions";
import {
  deleteQuestionReviewWorkflow,
  getQuestionReviewCounts,
  getReviewerHistory,
  getReviewProgress,
  getReviewWorkspaceSnapshot,
  isReviewPersistenceError,
  saveQuestionReview,
} from "../services/reviewPersistenceRepository";
import type {
  Language,
  Question,
  QuestionReviewHistoryItem,
  QuestionReviewValues,
  ReviewSourceVersions,
  StudentAnswer,
} from "../types";
import { cn } from "../utils/cn";
import { getMaterialQuestionIdentifier } from "../utils/materialQuestionFilters";
import {
  REVIEW_NAVIGATION_SESSION_KEY,
  buildReviewQueue,
  filterWeekReviewQuestions,
  getActiveCurrentQuestionReviewIds,
  getReviewWeekSummaries,
  getWeekReviewQuestionStatus,
  normalizeReviewNavigationState,
  parseReviewNavigationSearch,
  parseReviewNavigationSession,
  serializeReviewNavigationSearch,
  serializeReviewNavigationSession,
  type ReviewNavigationState,
  type ReviewQuestionType,
  type ReviewSessionMode,
  type ReviewWeekListStatus,
  type ReviewWeekSummary,
} from "../utils/reviewQueue";
import { QUESTION_REVIEWED_THRESHOLD } from "../utils/reviewQuestionFilters";
import { t } from "../utils/translation";
import { hasActiveReviewSession } from "../services/reviewSession";
import { supabase } from "../services/supabaseClient";
import {
  QuestionValidationWorkspace,
  ReviewSessionExpiredDialog,
} from "./LecturerReviewPage";

function readInitialNavigation(search: string): Partial<ReviewNavigationState> {
  const urlNavigation = parseReviewNavigationSearch(search);
  if (urlNavigation.hasParameters) return urlNavigation.state;
  if (typeof window === "undefined") return {};

  try {
    return parseReviewNavigationSession(
      window.sessionStorage.getItem(REVIEW_NAVIGATION_SESSION_KEY),
    );
  } catch {
    return {};
  }
}

function formatWeekLabel(week: string): string {
  return `Week ${week.replace(/^W/i, "")}`;
}

function ReviewBreadcrumb({
  week,
  question,
  language,
  onOverview,
  onWeek,
}: {
  week?: string;
  question?: string;
  language: Language;
  onOverview?: () => void;
  onWeek?: () => void;
}) {
  const rootLabel = language === "id" ? "Review Soal" : "Question Review";

  return (
    <nav aria-label="Breadcrumb" className="mb-4 overflow-x-auto text-[10px] leading-4 text-muted">
      <ol className="flex min-w-max items-center gap-1.5">
        <li>
          {onOverview ? (
            <button
              type="button"
              onClick={onOverview}
              className="cursor-pointer rounded-sm font-medium transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {rootLabel}
            </button>
          ) : (
            <span className="font-medium text-navy-deep">{rootLabel}</span>
          )}
        </li>
        {week && (
          <>
            <li aria-hidden="true" className="text-[#b09f85]">&gt;</li>
            <li>
              {onWeek ? (
                <button
                  type="button"
                  onClick={onWeek}
                  className="cursor-pointer rounded-sm font-medium transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {formatWeekLabel(week)}
                </button>
              ) : (
                <span className="font-medium text-navy-deep">{formatWeekLabel(week)}</span>
              )}
            </li>
          </>
        )}
        {question && (
          <>
            <li aria-hidden="true" className="text-[#b09f85]">&gt;</li>
            <li className="font-medium text-navy-deep">{question}</li>
          </>
        )}
      </ol>
    </nav>
  );
}

function ReviewCompletionDialog({
  week,
  language,
  onConfirm,
}: {
  week: string;
  language: Language;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="review-completion-title"
      aria-describedby="review-completion-description"
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 backdrop:bg-black/25"
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <section className="w-full max-w-sm rounded-xl border border-[#ccbab0] bg-[#fbfbfe] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.18)]">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-brand text-white">
            <Check size={18} strokeWidth={2.5} aria-hidden="true" />
          </div>
          <h2 id="review-completion-title" className="mt-4 text-lg font-semibold text-black">
            {language === "id" ? "Review selesai" : "Review complete"}
          </h2>
          <p id="review-completion-description" className="mt-2 text-sm leading-6 text-muted">
            {language === "id"
              ? "Review soal telah berhasil disimpan."
              : "The question review was saved successfully."}
          </p>
          <Button
            type="button"
            variant="primary"
            onClick={onConfirm}
            autoFocus
            className="mt-5 w-full justify-center"
          >
            {language === "id" ? "Kembali ke" : "Return to"}{" "}
            {formatWeekLabel(week)}
          </Button>
        </section>
      </div>
    </dialog>,
    document.body,
  );
}

function WeekOverview({
  summaries,
  language,
  loading,
  onSelectWeek,
}: {
  summaries: ReviewWeekSummary[];
  language: Language;
  loading: boolean;
  onSelectWeek: (week: string) => void;
}) {
  return (
    <>
      <div className="pb-2 text-center">
        <h1 className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-black sm:text-[1.75rem] sm:leading-9">
          {language === "id" ? "REVIEW SOAL PER MINGGU" : "REVIEW QUESTIONS BY WEEK"}
        </h1>
      </div>

      {loading ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label={language === "id" ? "Memuat minggu" : "Loading weeks"}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl bg-[var(--review-secondary-soft)]" />
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <div className="mt-5 rounded-xl border border-border bg-[var(--review-card)]">
          <EmptyState message={language === "id" ? "Belum ada minggu yang tersedia untuk direview." : "No weeks are available for review yet."} />
        </div>
      ) : (
        <section aria-label={language === "id" ? "Daftar minggu" : "Week list"} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summaries.map((summary) => (
            <button
              key={summary.week}
              type="button"
              onClick={() => onSelectWeek(summary.week)}
              className="group relative min-h-32 cursor-pointer rounded-xl border border-border bg-[var(--review-card)] p-4 text-left transition-[border-color,background-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-[#b09f85] hover:bg-[var(--review-row-hover)] hover:shadow-[0_10px_28px_rgba(176,159,133,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-0 active:shadow-none motion-reduce:translate-none sm:min-h-36 sm:p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-black">{formatWeekLabel(summary.week)}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {summary.total} {language === "id" ? "soal" : summary.total === 1 ? "question" : "questions"}
                  </p>
                </div>
                <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 text-[#b09f85] transition-[color,transform] duration-150 ease-out group-hover:translate-x-0.5 group-hover:text-brand motion-reduce:translate-none" />
              </div>
              <p className="mt-5 text-xs font-medium tabular-nums text-muted">
                {language === "id" ? "Tuntas" : "Complete"} {summary.completed}/{summary.total}
              </p>
              {summary.isComplete && (
                <span className="absolute bottom-4 right-4 inline-flex h-6 w-6 items-center justify-center rounded-full border border-brand/35 bg-[var(--review-page)] text-brand" aria-label={language === "id" ? "Semua soal sudah tuntas" : "All questions complete"}>
                  <Check size={14} strokeWidth={2.4} aria-hidden="true" />
                </span>
              )}
            </button>
          ))}
        </section>
      )}
    </>
  );
}

function QuestionTypeTooltipLabel({
  label,
  explanation,
  tooltipId,
  focusable = true,
  className,
}: {
  label: string;
  explanation: string;
  tooltipId: string;
  focusable?: boolean;
  className?: string;
}) {
  return (
    <span
      tabIndex={focusable ? 0 : undefined}
      aria-describedby={tooltipId}
      className={cn("group/type-label relative", className)}
    >
      {label}
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none invisible absolute left-0 top-full z-30 mt-1 w-max max-w-64 translate-y-0.5 rounded-md bg-black px-2.5 py-1.5 text-[10px] font-normal leading-4 text-[#fbfbfe] opacity-0 shadow-[0_6px_18px_rgba(176,159,133,0.2)] transition-[opacity,transform,visibility] duration-150 ease-out group-hover/type-label:visible group-hover/type-label:translate-y-0 group-hover/type-label:opacity-100 group-focus/type-label:visible group-focus/type-label:translate-y-0 group-focus/type-label:opacity-100 group-focus-visible/row:visible group-focus-visible/row:translate-y-0 group-focus-visible/row:opacity-100 motion-reduce:translate-y-0"
      >
        {explanation}
      </span>
    </span>
  );
}

function ReviewActionTooltip({ id, label }: { id: string; label: string }) {
  return (
    <span
      id={id}
      role="tooltip"
      className="pointer-events-none invisible absolute bottom-full right-0 z-30 mb-1 w-max max-w-48 translate-y-0.5 rounded-md bg-black px-2 py-1 text-[10px] font-normal leading-4 text-[#fbfbfe] opacity-0 shadow-[0_6px_18px_rgba(176,159,133,0.2)] transition-[opacity,transform,visibility] duration-150 ease-out group-hover/action:visible group-hover/action:translate-y-0 group-hover/action:opacity-100 group-focus-visible/action:visible group-focus-visible/action:translate-y-0 group-focus-visible/action:opacity-100 motion-reduce:translate-y-0"
    >
      {label}
    </span>
  );
}

function WeekQuestionList({
  week,
  questions,
  language,
  questionCounts,
  reviewedQuestionIds,
  startedQuestionIds,
  type,
  status,
  onBack,
  onTypeChange,
  onStatusChange,
  onOpenQuestion,
  onDeleteReview,
}: {
  week: string;
  questions: readonly Question[];
  language: Language;
  questionCounts: ReadonlyMap<string, number>;
  reviewedQuestionIds: readonly string[];
  startedQuestionIds: readonly string[];
  type: ReviewQuestionType;
  status: ReviewWeekListStatus;
  onBack: () => void;
  onTypeChange: (type: ReviewQuestionType) => void;
  onStatusChange: (status: ReviewWeekListStatus) => void;
  onOpenQuestion: (question: Question, mode: ReviewSessionMode) => void;
  onDeleteReview: (question: Question) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [withdrawingId, setWithdrawingId] = useState("");
  const [pendingWithdraw, setPendingWithdraw] = useState<Question | null>(null);
  const reviewed = useMemo(() => new Set(reviewedQuestionIds), [reviewedQuestionIds]);
  const started = useMemo(() => new Set(startedQuestionIds), [startedQuestionIds]);
  const typeOptions = [
    {
      value: "all",
      label: language === "id" ? "Semua tipe soal" : "All question types",
      explanation: undefined,
    },
    {
      value: "ps",
      label: language === "id" ? "Esai" : "Essay",
      explanation:
        language === "id"
          ? "Esai adalah tipe PS"
          : "Essay is type PS",
    },
    {
      value: "mp",
      label: language === "id" ? "Pilihan Ganda" : "Multiple Choice",
      explanation:
        language === "id"
          ? "Pilihan Ganda adalah tipe MP"
          : "Multiple Choice is type MP",
    },
  ] as const;
  const selectedType =
    typeOptions.find((option) => option.value === type) ?? typeOptions[0];
  const filteredQuestions = useMemo(
    () =>
      filterWeekReviewQuestions(questions, {
        week,
        query,
        type,
        status,
        reviewedQuestionIds,
        startedQuestionIds,
        questionCounts,
        reviewerThreshold: QUESTION_REVIEWED_THRESHOLD,
      }),
    [
      questionCounts,
      questions,
      query,
      reviewedQuestionIds,
      startedQuestionIds,
      status,
      type,
      week,
    ],
  );
  const tableGridClass =
    status === "unreviewed"
      ? "lg:grid-cols-[3rem_minmax(0,1fr)_8.5rem_6.5rem_1.5rem]"
      : "lg:grid-cols-[3rem_minmax(0,1fr)_8.5rem_6.5rem_7rem]";
  const questionColumnHeading = {
    unreviewed: { id: "Soal yang belum direview", en: "Questions not yet reviewed" },
    reviewed: { id: "Soal yang sudah direview", en: "Reviewed questions" },
    full: { id: "Soal dengan jumlah reviewer terpenuhi", en: "Questions with reviewer limit reached" },
  }[status][language];
  const withdrawDialogBody = pendingWithdraw
    ? language === "id"
      ? "Review soal yang Anda buat untuk soal ini akan dihapus dari review aktif. Riwayat review tetap tersimpan."
      : "Your question review for this question will be removed from the active review. Review history is kept."
    : "";

  const handleWithdraw = async (question: Question) => {
    if (withdrawingId) return;

    setWithdrawingId(question.id);
    try {
      await onDeleteReview(question);
      setPendingWithdraw(null);
    } catch (error) {
      console.error("[Progmiscon] Review soal gagal dihapus", error);
      if (isReviewPersistenceError(error, "DATA_VERSION_CHANGED")) {
        window.alert(
          error instanceof Error
            ? error.message
            : "Data sumber telah diperbarui. Muat ulang data lalu review kembali.",
        );
        window.location.reload();
        return;
      }
      window.alert(
        error instanceof Error
          ? error.message
          : language === "id"
            ? "Review soal belum dapat dihapus."
            : "The question review could not be deleted.",
      );
    } finally {
      setWithdrawingId("");
    }
  };

  return (
    <>
      <ReviewBreadcrumb week={week} language={language} onOverview={onBack} />
      <div className="py-1">
        <h1 className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-black sm:text-[1.75rem] sm:leading-9">
          {formatWeekLabel(week).toLocaleUpperCase(language)}
        </h1>
      </div>

      <section className="mt-4" aria-label={language === "id" ? "Soal minggu terpilih" : "Selected week questions"}>
        <div className="flex flex-col gap-2 border-y border-border/80 py-1.5 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex w-fit flex-wrap items-center gap-1.5"
            role="group"
            aria-label={language === "id" ? "Status review pribadi" : "Personal review status"}
          >
            {([
              ["unreviewed", language === "id" ? "Belum direview" : "Not reviewed"],
              ["reviewed", language === "id" ? "Sudah direview" : "Reviewed"],
              ["full", language === "id" ? "Jumlah reviewer terpenuhi" : "Reviewer limit reached"],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={status === value}
                onClick={() => onStatusChange(value)}
                className={cn(
                  "min-h-9 cursor-pointer rounded-full border px-2.5 py-1 text-[10px] font-medium leading-4 transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.99] motion-reduce:scale-none lg:min-h-6 lg:px-2 lg:py-0.5",
                  status === value
                    ? "border-brand bg-brand text-white"
                    : "border-[#ccbab0] bg-[var(--review-page)] text-black hover:border-[#b09f85] hover:bg-[var(--review-secondary-soft)]",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex w-full items-center gap-1.5 sm:w-auto">
            <details
              className="group/type relative shrink-0"
              onKeyDown={(event) => {
                if (event.key === "Escape") event.currentTarget.removeAttribute("open");
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  event.currentTarget.removeAttribute("open");
                }
              }}
            >
              <summary
                aria-label={`${language === "id" ? "Tipe soal" : "Question type"}: ${selectedType.label}`}
                className="flex min-h-9 w-[9.75rem] cursor-pointer list-none items-center gap-1.5 rounded-md border border-[#ccbab0] bg-[var(--review-page)] py-1 pl-2.5 pr-2 text-[11px] leading-4 text-black outline-none transition-[border-color,background-color,box-shadow] duration-150 ease-out marker:hidden hover:border-[#b09f85] focus-visible:border-brand/55 focus-visible:ring-2 focus-visible:ring-brand/10 group-open/type:border-brand/55 group-open/type:ring-2 group-open/type:ring-brand/10 active:bg-[var(--review-secondary-soft)] lg:min-h-7 [&::-webkit-details-marker]:hidden"
              >
                <span className="min-w-0 truncate font-medium">{selectedType.label}</span>
                {selectedType.explanation && (
                  <span
                    tabIndex={0}
                    aria-label={language === "id" ? "Penjelasan tipe soal" : "Question type explanation"}
                    aria-describedby="review-question-type-selected-help"
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation();
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                      }
                    }}
                    className="group/type-help relative inline-flex shrink-0 cursor-help rounded text-[#b09f85] transition-colors duration-150 ease-out hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                  >
                    <Info size={13} strokeWidth={1.8} aria-hidden="true" />
                    <span
                      id="review-question-type-selected-help"
                      role="tooltip"
                      className="pointer-events-none invisible absolute left-1/2 top-full z-30 mt-1 w-max max-w-64 -translate-x-1/2 translate-y-0.5 rounded-md bg-black px-2.5 py-1.5 text-[10px] font-normal leading-4 text-[#fbfbfe] opacity-0 shadow-[0_6px_18px_rgba(176,159,133,0.2)] transition-[opacity,transform,visibility] duration-150 ease-out group-hover/type-help:visible group-hover/type-help:translate-y-0 group-hover/type-help:opacity-100 group-focus/type-help:visible group-focus/type-help:translate-y-0 group-focus/type-help:opacity-100 motion-reduce:translate-y-0"
                    >
                      {selectedType.explanation}
                    </span>
                  </span>
                )}
                <ChevronDown size={12} strokeWidth={2} aria-hidden="true" className="ml-auto shrink-0 text-[#b09f85] transition-transform duration-150 ease-out group-open/type:rotate-180 motion-reduce:rotate-none" />
              </summary>
              <div
                role="menu"
                className="review-type-popover absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-md border border-border bg-[var(--review-card)] p-1 shadow-[0_8px_24px_rgba(176,159,133,0.18)]"
              >
                {typeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={type === option.value}
                    onClick={(event) => {
                      onTypeChange(option.value);
                      event.currentTarget.closest("details")?.removeAttribute("open");
                    }}
                    className={cn(
                      "flex min-h-9 w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-[11px] leading-4 transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand lg:min-h-7",
                      type === option.value
                        ? "bg-[var(--review-filter-option-selected)] text-black active:bg-[var(--review-filter-option-selected)]"
                        : "bg-white text-black hover:bg-[var(--review-filter-option-hover)] active:bg-[var(--review-filter-option-hover)]",
                    )}
                  >
                    <span className="min-w-0 flex-1 font-normal">{option.label}</span>
                  </button>
                ))}
              </div>
            </details>

            <label className="group/search relative block min-w-0 flex-1 sm:w-48 sm:flex-none">
              <span className="sr-only">{language === "id" ? "Cari soal" : "Search questions"}</span>
              <Search size={13} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[#b09f85] transition-colors duration-150 ease-out group-hover/search:text-brand group-focus-within/search:text-brand" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search"
                className="min-h-9 w-full rounded-md border border-[#ccbab0] bg-[var(--review-page)] py-1 pl-7 pr-2.5 text-[11px] font-normal leading-4 text-black outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted/75 hover:border-[#b09f85] focus:border-[#b09f85] focus:ring-2 focus:ring-brand/10 lg:min-h-7"
              />
            </label>
          </div>
        </div>

        {filteredQuestions.length === 0 ? (
          <div className="mt-2 rounded-lg border border-border bg-[var(--review-card)]">
            <EmptyState message={language === "id" ? "Tidak ada soal yang cocok dengan pencarian atau filter ini." : "No questions match these filters."} />
          </div>
        ) : (
          <div className="mt-2 overflow-visible rounded-lg border border-border bg-white shadow-[0_1px_2px_rgba(176,159,133,0.12)]">
            <div aria-hidden="true" className={cn("hidden rounded-t-lg gap-3 border-b border-border bg-[var(--review-header)] px-3 py-2.5 text-[13px] font-semibold text-black lg:grid", tableGridClass)}>
              <span className="text-center">No</span>
              <span>{questionColumnHeading}</span>
              <span>{language === "id" ? "Tipe" : "Type"}</span>
              <span>{language === "id" ? "Reviewer" : "Reviewers"}</span>
              <span className="text-center">{status === "unreviewed" ? "" : language === "id" ? "Aksi" : "Actions"}</span>
            </div>
            <ul>
              {filteredQuestions.map((question, index) => {
                const identifier = getMaterialQuestionIdentifier(question);
                const title = t(question.title, language).trim() || identifier;
                const questionType =
                  question.type === "multiple_choice" ? typeOptions[2] : typeOptions[1];
                const typeExplanation = questionType.explanation;
                const reviewCount = Math.min(
                  questionCounts.get(question.id) ?? 0,
                  QUESTION_REVIEWED_THRESHOLD,
                );
                const questionStatus = getWeekReviewQuestionStatus(
                  question.id,
                  reviewed,
                  questionCounts,
                  QUESTION_REVIEWED_THRESHOLD,
                  started,
                );
                const viewActionLabel =
                  questionStatus === "reviewed"
                    ? language === "id" ? "Lihat" : "View"
                    : language === "id" ? "Lihat soal" : "View question";
                const deleteActionLabel = language === "id" ? "Hapus review" : "Delete review";
                const viewTooltipId = `review-question-action-view-${question.id}`;
                const editTooltipId = `review-question-action-edit-${question.id}`;
                const deleteTooltipId = `review-question-action-delete-${question.id}`;
                const rowCells = (
                  <>
                    <span className="hidden text-center text-xs font-normal tabular-nums text-black/60 lg:block">{index + 1}</span>
                    <span className="min-w-0">
                      <span className="block line-clamp-2 break-words text-xs font-normal leading-4 text-black lg:line-clamp-1">{title}</span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 lg:hidden">
                        <QuestionTypeTooltipLabel
                          label={questionType.label}
                          explanation={typeExplanation}
                          tooltipId={`review-question-type-${question.id}-mobile`}
                          focusable={questionStatus !== "unreviewed"}
                          className={cn(
                            "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-normal leading-4 transition-colors duration-150 ease-out",
                            question.type === "multiple_choice"
                              ? "border-[var(--review-type-choice-border)] bg-[var(--review-type-choice-bg)] text-[var(--review-type-choice-text)] hover:bg-[var(--review-type-choice-hover)] hover:border-[var(--review-type-choice-hover-border)]"
                              : "border-[var(--review-type-essay-border)] bg-[var(--review-type-essay-bg)] text-[var(--review-type-essay-text)] hover:bg-[var(--review-type-essay-hover)] hover:border-[var(--review-type-essay-hover-border)]",
                          )}
                        />
                        <span className="text-[10px] font-normal tabular-nums text-black/60">{reviewCount}/{QUESTION_REVIEWED_THRESHOLD} reviewer</span>
                      </span>
                    </span>
                    <QuestionTypeTooltipLabel
                      label={questionType.label}
                      explanation={typeExplanation}
                      tooltipId={`review-question-type-${question.id}-desktop`}
                      focusable={questionStatus !== "unreviewed"}
                      className={cn(
                        "hidden w-fit items-center rounded-md border px-1.5 py-0.5 text-[10px] font-normal leading-4 transition-colors duration-150 ease-out lg:inline-flex",
                        question.type === "multiple_choice"
                          ? "border-[var(--review-type-choice-border)] bg-[var(--review-type-choice-bg)] text-[var(--review-type-choice-text)] hover:bg-[var(--review-type-choice-hover)] hover:border-[var(--review-type-choice-hover-border)]"
                          : "border-[var(--review-type-essay-border)] bg-[var(--review-type-essay-bg)] text-[var(--review-type-essay-text)] hover:bg-[var(--review-type-essay-hover)] hover:border-[var(--review-type-essay-hover-border)]",
                      )}
                    />
                    <span className="hidden text-xs font-normal tabular-nums text-black/60 lg:block">{reviewCount}/{QUESTION_REVIEWED_THRESHOLD}</span>
                  </>
                );

                return (
                  <li key={question.id} className="border-b border-border last:border-b-0">
                    {questionStatus === "unreviewed" ? (
                      <button
                        type="button"
                        aria-describedby={`review-question-type-${question.id}-desktop`}
                        onClick={() => onOpenQuestion(question, "review")}
                        className={cn("group group/row grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-left transition-colors duration-150 ease-out hover:bg-[var(--review-row-hover)] focus-visible:relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand active:bg-[var(--review-secondary-soft)]", tableGridClass)}
                      >
                        {rowCells}
                        <ChevronRight size={15} strokeWidth={1.8} aria-hidden="true" className="text-[#b09f85] transition-[color,transform] duration-150 ease-out group-hover/row:translate-x-0.5 group-hover/row:text-brand motion-reduce:translate-none" />
                      </button>
                    ) : (
                      <div className={cn("group/row grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition-colors duration-150 ease-out hover:bg-[var(--review-row-hover)]", tableGridClass)}>
                        {rowCells}
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            aria-labelledby={viewTooltipId}
                            onClick={() => onOpenQuestion(question, "view")}
                            className="group/action relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-[#B6252A] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[var(--review-secondary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.98] motion-reduce:scale-none lg:h-7 lg:w-7"
                          >
                            <Eye size={14} strokeWidth={1.9} aria-hidden="true" />
                            <ReviewActionTooltip id={viewTooltipId} label={viewActionLabel} />
                          </button>
                          {questionStatus === "reviewed" && (
                            <>
                              <button
                                type="button"
                                aria-labelledby={editTooltipId}
                                onClick={() => onOpenQuestion(question, "edit")}
                                className="group/action relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-[#B6252A] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[var(--review-secondary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.98] motion-reduce:scale-none lg:h-7 lg:w-7"
                              >
                                <Pencil size={14} strokeWidth={1.9} aria-hidden="true" />
                                <ReviewActionTooltip id={editTooltipId} label="Edit" />
                              </button>
                              <button
                                type="button"
                                aria-labelledby={deleteTooltipId}
                                disabled={withdrawingId === question.id}
                                onClick={() => setPendingWithdraw(question)}
                                className="group/action relative inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md text-[#B6252A] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[var(--review-primary-soft)] disabled:cursor-wait disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.98] motion-reduce:scale-none lg:h-7 lg:w-7"
                              >
                                <Trash2 size={14} strokeWidth={1.9} aria-hidden="true" />
                                <ReviewActionTooltip id={deleteTooltipId} label={deleteActionLabel} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
      <ConfirmDialog
        open={pendingWithdraw !== null}
        title={language === "id" ? "Hapus review?" : "Delete review?"}
        description={withdrawDialogBody}
        cancelLabel={language === "id" ? "Batal" : "Cancel"}
        confirmLabel={language === "id" ? "Hapus review" : "Delete review"}
        confirmIcon={<Trash2 size={16} strokeWidth={1.9} aria-hidden="true" />}
        destructive
        confirming={withdrawingId !== ""}
        onCancel={() => {
          if (withdrawingId === "") setPendingWithdraw(null);
        }}
        onConfirm={() => {
          if (pendingWithdraw) void handleWithdraw(pendingWithdraw);
        }}
      />
    </>
  );
}


export function LecturerReviewPage() {
  const { language } = useLanguage();
  const { user } = useLecturerAuth();
  const { misconceptions, loading: misconceptionsLoading } = useMisconceptions();
  const navigate = useNavigate();
  const location = useLocation();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const [sourceVersions, setSourceVersions] = useState<ReviewSourceVersions>({
    questions: new Map(),
    answers: new Map(),
  });
  const [questionHistory, setQuestionHistory] = useState<
    QuestionReviewHistoryItem[]
  >([]);
  const [questionCounts, setQuestionCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [reviewNavigationInput, setReviewNavigationInput] = useState<
    Partial<ReviewNavigationState>
  >(() => readInitialNavigation(location.search));
  const [pendingNavigation, setPendingNavigation] = useState<
    ReviewNavigationState | undefined
  >();
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  // Gate protected Review-source loading on a genuinely valid session. When the
  // route is restored (browser Back / bfcache) without one, we must show the
  // blocking reauth dialog instead of letting protected RPCs return raw
  // permission-denied errors.
  const [reviewSessionState, setReviewSessionState] = useState<
    "checking" | "valid" | "expired"
  >("checking");
  const [loadError, setLoadError] = useState("");
  const [reviewDataRevision, setReviewDataRevision] = useState(0);
  const [questionDirty, setQuestionDirty] = useState(false);
  const [completionDialog, setCompletionDialog] = useState(false);
  const [confirmedQuestionReviewIds, setConfirmedQuestionReviewIds] = useState<
    string[]
  >([]);

  useEffect(() => {
    let active = true;

    const verifySession = () => {
      void hasActiveReviewSession(supabase.auth).then((valid) => {
        if (active) setReviewSessionState(valid ? "valid" : "expired");
      });
    };

    verifySession();

    // A history restore (browser Back, bfcache) can revive this route without a
    // fresh mount; re-verify before any protected Review load runs again.
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        setReviewSessionState("checking");
        verifySession();
      }
    };
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      active = false;
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user || reviewSessionState !== "valid") {
      setSnapshotLoading(false);
      setSnapshotLoaded(false);
      return () => {
        active = false;
      };
    }

    setSnapshotLoading(true);
    setSnapshotLoaded(false);
    setLoadError("");
    void getReviewWorkspaceSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setQuestions(snapshot.questions);
        setAnswers(snapshot.answers);
        setSourceVersions(snapshot.sourceVersions);
        setSnapshotLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        console.error("[Progmiscon] Workspace review gagal dimuat", error);
        // If the load failed only because the session is no longer valid, show
        // the blocking reauth dialog rather than a raw permission error.
        void hasActiveReviewSession(supabase.auth).then((valid) => {
          if (!active) return;
          if (!valid) {
            setReviewSessionState("expired");
            return;
          }
          setLoadError(
            error instanceof Error
              ? error.message
              : "Workspace review belum dapat dimuat.",
          );
        });
      })
      .finally(() => {
        if (active) setSnapshotLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user, reviewSessionState]);

  useEffect(() => {
    let active = true;
    if (!user || !snapshotLoaded) {
      setMetadataLoading(false);
      setMetadataLoaded(false);
      return () => {
        active = false;
      };
    }

    setMetadataLoading(true);
    setMetadataLoaded(false);
    setLoadError("");
    void Promise.all([
      getReviewProgress(),
      getQuestionReviewCounts(),
      getReviewerHistory(user.id),
    ])
      .then(([, nextQuestionCounts, history]) => {
        if (!active) return;
        setQuestionCounts(
          new Map(
            nextQuestionCounts.map(({ questionId, reviewCount }) => [
              questionId,
              reviewCount,
            ]),
          ),
        );
        setQuestionHistory(history.questionReviews);
        setMetadataLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        console.error("[Progmiscon] Status review gagal dimuat", error);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Status review belum dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setMetadataLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reviewDataRevision, snapshotLoaded, user]);

  useEffect(() => {
    if (!questionDirty || typeof window === "undefined") {
      return;
    }
    const preventUnsavedExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnsavedExit);
    return () => window.removeEventListener("beforeunload", preventUnsavedExit);
  }, [questionDirty]);

  const persistedReviewedQuestionIds = useMemo(
    () =>
      getActiveCurrentQuestionReviewIds(
        questionHistory,
        sourceVersions.questions,
      ),
    [questionHistory, sourceVersions.questions],
  );
  // A question is reviewed for this lecturer once an active current-version
  // Question Review exists. MP and PS behave identically now that the A/B/C/D
  // Answer Review workflow is retired; there is no composite completion.
  const reviewedQuestionStepIds = useMemo(
    () => [
      ...new Set([
        ...persistedReviewedQuestionIds,
        ...confirmedQuestionReviewIds,
      ]),
    ],
    [confirmedQuestionReviewIds, persistedReviewedQuestionIds],
  );
  const reviewedQuestionIds = reviewedQuestionStepIds;
  const navigationReady = snapshotLoaded && metadataLoaded;
  const urlNavigation = useMemo(
    () => parseReviewNavigationSearch(location.search),
    [location.search],
  );
  const reviewStage = useMemo<"overview" | "list" | "detail">(() => {
    if (new URLSearchParams(location.search).has("item")) {
      return "detail";
    }
    return new URLSearchParams(location.search).has("week")
      ? "list"
      : "overview";
  }, [location.search]);
  const navigation = useMemo(
    () =>
      normalizeReviewNavigationState(
        pendingNavigation ??
          (location.pathname === "/review" && urlNavigation.hasParameters
            ? urlNavigation.state
            : reviewNavigationInput),
        {
          questions,
          reviewedQuestionIds,
        },
      ),
    [
      location.pathname,
      pendingNavigation,
      questions,
      reviewNavigationInput,
      reviewedQuestionIds,
      urlNavigation,
    ],
  );
  const activeQueue = useMemo(
    () =>
      buildReviewQueue({
        questions,
        ...navigation,
        reviewedQuestionIds,
      }),
    [navigation, questions, reviewedQuestionIds],
  );
  const commitNavigation = useCallback(
    (next: ReviewNavigationState, options: { replace?: boolean } = {}) => {
      setPendingNavigation(next);
      setReviewNavigationInput(next);
      const search = serializeReviewNavigationSearch(next);
      navigate(
        { pathname: "/review", search },
        { replace: options.replace ?? true },
      );
    },
    [navigate],
  );

  useEffect(() => {
    if (!pendingNavigation) return;
    const pendingSearch = serializeReviewNavigationSearch(pendingNavigation);
    if (location.pathname === "/review" && location.search === pendingSearch) {
      setPendingNavigation(undefined);
    }
  }, [location.pathname, location.search, pendingNavigation]);

  useEffect(() => {
    if (!navigationReady || reviewStage !== "detail" || pendingNavigation) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        REVIEW_NAVIGATION_SESSION_KEY,
        serializeReviewNavigationSession(navigation),
      );
    } catch {
      // sessionStorage can be unavailable in restricted browser contexts.
    }

    const search = serializeReviewNavigationSearch(navigation);
    if (location.pathname !== "/review" || location.search !== search) {
      navigate({ pathname: "/review", search }, { replace: true });
    }
  }, [
    location.pathname,
    location.search,
    navigate,
    navigation,
    navigationReady,
    pendingNavigation,
    reviewStage,
  ]);

  const activeIndex = activeQueue.findIndex(({ id }) => id === navigation.item);
  const activeQuestion = activeQueue[activeIndex] as Question | undefined;
  const activeQuestionReviewedByMe = activeQuestion
    ? reviewedQuestionStepIds.includes(activeQuestion.id)
    : false;
  const activeQuestionCount = activeQuestion
    ? (questionCounts.get(activeQuestion.id) ?? 0)
    : 0;
  const activeQuestionLocked =
    activeQuestionCount >= QUESTION_REVIEWED_THRESHOLD &&
    !activeQuestionReviewedByMe;
  const activeQuestionReview = activeQuestion
    ? questionHistory.find(
        (review) =>
          review.questionId === activeQuestion.id &&
          review.sourceVersion === activeQuestion.sourceVersion &&
          review.isActive,
      )
    : undefined;
  const weekSummaries = useMemo(
    () =>
      getReviewWeekSummaries(
        questions,
        reviewedQuestionIds,
        questionCounts,
        QUESTION_REVIEWED_THRESHOLD,
        reviewedQuestionStepIds,
      ),
    [questionCounts, questions, reviewedQuestionIds, reviewedQuestionStepIds],
  );
  const loading =
    reviewSessionState === "checking" ||
    snapshotLoading ||
    metadataLoading ||
    misconceptionsLoading;

  const confirmNavigation = useCallback(
    (next: ReviewNavigationState) => {
      if (
        !questionDirty ||
        (next.task === navigation.task && next.item === navigation.item)
      ) {
        return true;
      }
      return window.confirm(
        language === "id"
          ? "Review ini belum disimpan. Tetap pindah?"
          : "This review has not been saved. Continue?",
      );
    },
    [language, navigation.item, navigation.task, questionDirty],
  );

  const changeNavigation = useCallback(
    (
      patch: Partial<ReviewNavigationState>,
      options: { replace?: boolean } = {},
    ) => {
      const next = normalizeReviewNavigationState(
        { ...navigation, ...patch },
        {
          questions,
          reviewedQuestionIds,
        },
      );
      if (!confirmNavigation(next)) return false;
      setQuestionDirty(false);
      commitNavigation(next, {
        replace: options.replace,
      });
      return true;
    },
    [
      confirmNavigation,
      commitNavigation,
      navigation,
      questions,
      reviewedQuestionIds,
    ],
  );

  const navigateToWeekList = useCallback(
    (
      week: string,
      status: ReviewWeekListStatus,
      type: ReviewQuestionType,
      replace = false,
    ) => {
      const next: ReviewNavigationState = {
        week,
        task: "question",
        status,
        type,
        mode: "review",
      };
      setPendingNavigation(undefined);
      setReviewNavigationInput(next);
      navigate(
        { pathname: "/review", search: serializeReviewNavigationSearch(next) },
        { replace },
      );
    },
    [navigate],
  );
  const navigateToOverview = useCallback(() => {
    if (
      reviewStage === "detail" &&
      !confirmNavigation({ ...navigation, item: undefined })
    ) {
      return;
    }
    setQuestionDirty(false);
    navigate("/review");
  }, [confirmNavigation, navigate, navigation, reviewStage]);
  const navigateToWeek = useCallback(
    (week: string) => {
      if (
        reviewStage === "detail" &&
        !confirmNavigation({
          ...navigation,
          week,
          task: "question",
          item: undefined,
        })
      ) {
        return;
      }
      setQuestionDirty(false);
      navigateToWeekList(
        week,
        reviewStage === "detail" && navigation.mode !== "review"
          ? navigation.status
          : "unreviewed",
        reviewStage === "detail" ? navigation.type : "all",
      );
    },
    [confirmNavigation, navigateToWeekList, navigation, reviewStage],
  );
  const returnToWeekList = useCallback(() => {
    setCompletionDialog(false);
    setQuestionDirty(false);
    navigateToWeekList(navigation.week, "unreviewed", navigation.type, true);
  }, [navigateToWeekList, navigation.type, navigation.week]);
  const openQuestion = useCallback(
    (question: Question, mode: ReviewSessionMode) => {
      const status = getWeekReviewQuestionStatus(
        question.id,
        new Set(reviewedQuestionIds),
        questionCounts,
        QUESTION_REVIEWED_THRESHOLD,
        new Set(reviewedQuestionStepIds),
      );
      const opened = changeNavigation(
        {
          week: question.week ?? navigation.week,
          task: "question",
          status,
          type: navigation.type,
          mode,
          item: question.id,
        },
        { replace: false },
      );
      if (opened) window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    },
    [
      changeNavigation,
      navigation.type,
      navigation.week,
      questionCounts,
      reviewedQuestionIds,
      reviewedQuestionStepIds,
    ],
  );
  const withdrawQuestionReview = useCallback(
    async (question: Question) => {
      if (!question.sourceVersion) {
        throw new Error("Versi sumber soal belum tersedia.");
      }
      // Deactivates ONLY the caller's active current-version Question Review and
      // recomputes question consensus. Legacy Answer Reviews and answer
      // misconception overrides are deliberately left untouched (see
      // delete_question_review_workflow_v3). The revision bump reloads the
      // authoritative state.
      await deleteQuestionReviewWorkflow(question.id, question.sourceVersion);

      const nowIso = new Date().toISOString();
      setQuestionHistory((current) =>
        current.map((review) =>
          review.questionId === question.id &&
          review.sourceVersion === question.sourceVersion &&
          review.isActive
            ? {
                ...review,
                isActive: false,
                inactiveReason: "deleted",
                inactiveAt: nowIso,
              }
            : review,
        ),
      );
      setQuestionCounts((current) => {
        const next = new Map(current);
        next.set(question.id, Math.max(0, (next.get(question.id) ?? 1) - 1));
        return next;
      });
      setConfirmedQuestionReviewIds((current) =>
        current.filter((questionId) => questionId !== question.id),
      );
      setReviewDataRevision((current) => current + 1);
    },
    [],
  );

  const handleQuestionSubmit = async (values: QuestionReviewValues) => {
    if (
      !activeQuestion?.sourceVersion ||
      activeQuestionLocked ||
      navigation.mode === "view"
    ) {
      return;
    }
    const alreadyReviewed = reviewedQuestionStepIds.includes(activeQuestion.id);
    await saveQuestionReview(
      activeQuestion.id,
      activeQuestion.sourceVersion,
      values,
    );
    if (!alreadyReviewed) {
      setConfirmedQuestionReviewIds((current) => [
        ...new Set([...current, activeQuestion.id]),
      ]);
      setQuestionCounts((current) => {
        const next = new Map(current);
        next.set(activeQuestion.id, (next.get(activeQuestion.id) ?? 0) + 1);
        return next;
      });
    }
    setQuestionDirty(false);
    setReviewDataRevision((current) => current + 1);
    if (navigation.mode === "edit") return;

    // One-page flow for every question type: save, then return to the week
    // list. MP has no A/B/C/D follow-up.
    commitNavigation({
      ...navigation,
      status: "reviewed",
      item: activeQuestion.id,
    });
    setCompletionDialog(true);
  };

  if (reviewSessionState === "expired") {
    // The session is gone. Keep whatever local/restored state is on screen but
    // block interaction and never run protected Review loads; reauthentication
    // uses the same safe same-tab flow, and a confirmed session unblocks.
    return (
      <div className="lecturer-ui review-week-pages review-stage-enter mx-auto max-w-[1240px] text-black">
        <ReviewSessionExpiredDialog
          language={language}
          onReauthReturn={() => setReviewSessionState("valid")}
        />
      </div>
    );
  }

  if (reviewStage === "overview") {
    return (
      <div className="lecturer-ui review-week-pages review-stage-enter mx-auto max-w-[1240px] text-black">
        {loadError && (
          <p role="alert" className="mb-5 rounded-lg border border-brand/25 bg-[var(--review-primary-soft)] px-4 py-3 text-sm text-brand">
            {loadError}
          </p>
        )}
        <WeekOverview
          summaries={weekSummaries}
          language={language}
          loading={loading}
          onSelectWeek={navigateToWeek}
        />
      </div>
    );
  }

  if (reviewStage === "list") {
    const requestedWeek = new URLSearchParams(location.search).get("week") ?? "";
    const selectedWeek = navigation.week || requestedWeek;

    return (
      <div className="lecturer-ui review-week-pages review-stage-enter mx-auto max-w-[1240px] text-black">
        {loadError && (
          <p role="alert" className="mb-5 rounded-lg border border-brand/25 bg-[var(--review-primary-soft)] px-4 py-3 text-sm text-brand">
            {loadError}
          </p>
        )}
        {loading ? (
          <div role="status" aria-label={language === "id" ? "Memuat daftar soal" : "Loading question list"}>
            <ReviewBreadcrumb week={requestedWeek || undefined} language={language} onOverview={navigateToOverview} />
            <div className="h-10 w-56 animate-pulse rounded-lg bg-[var(--review-secondary-soft)]" />
            <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded bg-[var(--review-secondary-soft)]" />
            <div className="mt-8 h-28 animate-pulse rounded-xl bg-[var(--review-secondary-soft)]" />
            <div className="mt-5 h-72 animate-pulse rounded-xl bg-[var(--review-secondary-soft)]" />
          </div>
        ) : (
          <WeekQuestionList
            key={selectedWeek}
            week={selectedWeek}
            questions={questions}
            language={language}
            questionCounts={questionCounts}
            reviewedQuestionIds={reviewedQuestionIds}
            startedQuestionIds={reviewedQuestionStepIds}
            type={navigation.type}
            status={navigation.status}
            onBack={navigateToOverview}
            onTypeChange={(type) =>
              navigateToWeekList(selectedWeek, navigation.status, type, true)
            }
            onStatusChange={(status) =>
              navigateToWeekList(selectedWeek, status, navigation.type, true)
            }
            onOpenQuestion={openQuestion}
            onDeleteReview={withdrawQuestionReview}
          />
        )}
      </div>
    );
  }

  const detailLabel = activeQuestion
    ? t(activeQuestion.title, language).trim() ||
      getMaterialQuestionIdentifier(activeQuestion)
    : navigation.item;

  return (
    <div className="lecturer-ui review-week-pages review-stage-enter mx-auto max-w-[1320px] text-black">
      <ReviewBreadcrumb
        week={navigation.week || undefined}
        question={detailLabel}
        language={language}
        onOverview={navigateToOverview}
        onWeek={() => navigateToWeek(navigation.week)}
      />
      {loadError && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
        >
          {loadError}
        </p>
      )}

      {loading ? (
        <div
          role="status"
          aria-label={language === "id" ? "Memuat detail soal" : "Loading question detail"}
          className="grid gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(22rem,1fr)] xl:gap-14"
        >
          <div>
            <div className="h-9 w-3/4 animate-pulse rounded bg-[var(--review-secondary-soft)]" />
            <div className="mt-3 h-5 w-2/5 animate-pulse rounded bg-[var(--review-secondary-soft)]" />
            <div className="mt-10 h-44 animate-pulse rounded-lg bg-[var(--review-secondary-soft)]" />
          </div>
          <div className="h-[32rem] animate-pulse rounded-xl border border-[#ccbab0] bg-white" />
        </div>
      ) : activeQuestion ? (
        <QuestionValidationWorkspace
          key={activeQuestion.id}
          question={activeQuestion}
          answers={answers}
          misconceptions={misconceptions}
          locked={activeQuestionLocked}
          progressUnavailable={!navigationReady || !activeQuestion.sourceVersion}
          submittedReview={activeQuestionReview}
          mode={navigation.mode}
          onDirtyChange={setQuestionDirty}
          onSelectMisconception={(misconceptionId) =>
            navigate(`/miskonsepsi/${misconceptionId}`)
          }
          onSubmit={handleQuestionSubmit}
        />
      ) : (
        <EmptyState
          message={
            language === "id"
              ? "Soal ini tidak tersedia dalam daftar review minggu ini."
              : "This question is not available in this week's review list."
          }
        />
      )}
      {completionDialog && (
        <ReviewCompletionDialog
          week={navigation.week}
          language={language}
          onConfirm={returnToWeekList}
        />
      )}
    </div>
  );
}
