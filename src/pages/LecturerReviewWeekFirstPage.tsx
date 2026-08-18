import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Eye,
  History,
  Info,
  Pencil,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useReviewTasks } from "../hooks/useReviewTasks";
import {
  deleteAnswerReview,
  deleteQuestionReview,
  getAnswerReviewCounts,
  getQuestionReviewCounts,
  getReviewerHistory,
  getReviewProgress,
  getReviewWorkspaceSnapshot,
  isReviewPersistenceError,
  saveAnswerReview,
  saveQuestionReview,
} from "../services/reviewPersistenceRepository";
import type {
  AnswerReviewHistoryItem,
  AnswerReviewValues,
  Language,
  Question,
  QuestionReviewHistoryItem,
  QuestionReviewValues,
  ReviewSourceVersions,
  ReviewTask,
  StudentAnswer,
} from "../types";
import { cn } from "../utils/cn";
import {
  getMaterialQuestionIdentifier,
  getMaterialWeekOptions,
} from "../utils/materialQuestionFilters";
import { sortReviewTasks } from "../utils/reviewPriority";
import {
  REVIEW_NAVIGATION_SESSION_KEY,
  buildReviewQueue,
  filterWeekReviewQuestions,
  getActiveCurrentAnswerReviewIds,
  getActiveCurrentQuestionReviewIds,
  getNavigationAfterWithdraw,
  getReviewWeekSummaries,
  getWeekReviewQuestionStatus,
  normalizeReviewNavigationState,
  parseReviewNavigationSearch,
  parseReviewNavigationSession,
  resolveAnswerDeepLink,
  serializeReviewNavigationSearch,
  serializeReviewNavigationSession,
  type ReviewNavigationState,
  type ReviewPersonalStatus,
  type ReviewQuestionType,
  type ReviewSessionMode,
  type ReviewTaskKind,
  type ReviewWeekListStatus,
  type ReviewWeekSummary,
} from "../utils/reviewQueue";
import { QUESTION_REVIEWED_THRESHOLD } from "../utils/reviewQuestionFilters";
import { getEvidenceAnswersForQuestion } from "../utils/reviewLinking";
import {
  filterEligibleAnswerReviewCounts,
  filterEligibleAnswerReviewIds,
  getActionableAnswerReviewSequence,
  getCompositeReviewedQuestionIds,
  getNextUnreviewedAnswerId,
  getReachableAnswerReviewSequence,
  resolveAnswerSelection,
  stripSelectedOptionPrefix,
} from "../utils/reviewWorkspace";
import { t } from "../utils/translation";
import {
  AnswerValidationWorkspace,
  QuestionValidationWorkspace,
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

function orderAnswersByTaskPriority(
  answers: readonly StudentAnswer[],
  tasks: readonly ReviewTask[],
): StudentAnswer[] {
  const rank = new Map(
    sortReviewTasks([...tasks]).map((task, index) => [task.answerCaseId, index]),
  );
  return [...answers].sort(
    (left, right) =>
      (rank.get(left.id) ?? rank.size) - (rank.get(right.id) ?? rank.size),
  );
}

function formatWeekLabel(week: string): string {
  return `Week ${week.replace(/^W/i, "")}`;
}

function getAnswerStepLabel(
  question: Question,
  answer: StudentAnswer,
  index: number,
  language: Language,
): string {
  const optionLabel = resolveAnswerSelection(question, answer).option?.label.trim();
  return `${language === "id" ? "Jawaban" : "Answer"} ${optionLabel || index + 1}`;
}

function isQuestionDetailTask(task: ReviewTaskKind): boolean {
  return task === "question";
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
  kind,
  week,
  language,
  onConfirm,
}: {
  kind: "question" | "workflow";
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
            {kind === "question"
              ? language === "id"
                ? "Review soal telah berhasil disimpan."
                : "The question review was saved successfully."
              : language === "id"
                ? "Review soal dan seluruh jawaban yang tersedia telah selesai."
                : "The question and all available answers have been reviewed."}
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
        <h1 className="text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] text-black">
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
              className="group relative min-h-36 cursor-pointer rounded-xl border border-border bg-[var(--review-card)] p-5 text-left transition-[border-color,background-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-px hover:border-[#b09f85] hover:bg-[var(--review-row-hover)] hover:shadow-[0_10px_28px_rgba(176,159,133,0.16)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-0 active:shadow-none motion-reduce:translate-none"
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
  const handleWithdraw = async (question: Question) => {
    if (
      !window.confirm(
        language === "id"
          ? "Hapus review soal ini? Review akan dinonaktifkan dan soal kembali ke daftar tugas jika kuota masih tersedia."
          : "Delete this question review? It will be deactivated and returned to the task list if quota remains available.",
      )
    ) {
      return;
    }

    setWithdrawingId(question.id);
    try {
      await onDeleteReview(question);
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
        <h1 className="text-[1.75rem] font-semibold leading-9 tracking-[-0.02em] text-black">
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
                  "min-h-6 cursor-pointer rounded-full border px-2 py-0.5 text-[10px] font-medium leading-4 transition-[background-color,border-color,color,transform] duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.99] motion-reduce:scale-none",
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
                className="flex min-h-7 w-[9.75rem] cursor-pointer list-none items-center gap-1.5 rounded-md border border-[#ccbab0] bg-[var(--review-page)] py-1 pl-2.5 pr-2 text-[11px] leading-4 text-black outline-none transition-[border-color,background-color,box-shadow] duration-150 ease-out marker:hidden hover:border-[#b09f85] focus-visible:border-brand/55 focus-visible:ring-2 focus-visible:ring-brand/10 group-open/type:border-brand/55 group-open/type:ring-2 group-open/type:ring-brand/10 active:bg-[var(--review-secondary-soft)] [&::-webkit-details-marker]:hidden"
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
                      "flex min-h-7 w-full cursor-pointer items-center gap-2 rounded px-2 py-1 text-left text-[11px] leading-4 transition-colors duration-150 ease-out focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
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
                className="min-h-7 w-full rounded-md border border-[#ccbab0] bg-[var(--review-page)] py-1 pl-7 pr-2.5 text-[11px] font-normal leading-4 text-black outline-none transition-[border-color,box-shadow] duration-150 ease-out placeholder:text-muted/75 hover:border-[#b09f85] focus:border-[#b09f85] focus:ring-2 focus:ring-brand/10"
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
                      <span className="block truncate text-xs font-normal leading-4 text-black">{title}</span>
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
                            className="group/action relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#B6252A] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[var(--review-secondary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.98] motion-reduce:scale-none"
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
                                className="group/action relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#B6252A] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[var(--review-secondary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.98] motion-reduce:scale-none"
                              >
                                <Pencil size={14} strokeWidth={1.9} aria-hidden="true" />
                                <ReviewActionTooltip id={editTooltipId} label="Edit" />
                              </button>
                              <button
                                type="button"
                                aria-labelledby={deleteTooltipId}
                                disabled={withdrawingId === question.id}
                                onClick={() => void handleWithdraw(question)}
                                className="group/action relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[#B6252A] transition-[background-color,color,transform] duration-150 ease-out hover:bg-[var(--review-primary-soft)] disabled:cursor-wait disabled:opacity-45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand active:scale-[0.98] motion-reduce:scale-none"
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
    </>
  );
}

function QueuePanel({
  items,
  selectedItemId,
  task,
  language,
  questionById,
  questionCounts,
  answerCounts,
  reviewedQuestionIds,
  reviewedAnswerIds,
  onSelect,
}: {
  items: Array<Question | StudentAnswer>;
  selectedItemId?: string;
  task: ReviewTaskKind;
  language: Language;
  questionById: ReadonlyMap<string, Question>;
  questionCounts: ReadonlyMap<string, number>;
  answerCounts: ReadonlyMap<string, number>;
  reviewedQuestionIds: readonly string[];
  reviewedAnswerIds: readonly string[];
  onSelect: (itemId: string) => void;
}) {
  const reviewed = new Set(
    task === "question" ? reviewedQuestionIds : reviewedAnswerIds,
  );

  return (
    <aside className="min-w-0 overflow-hidden rounded-lg border border-border bg-white xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)]">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-sm font-bold text-navy-deep">
          {language === "id" ? "Antrian" : "Queue"}
        </h2>
        <span className="text-xs font-semibold tabular-nums text-muted">
          {items.length} {task === "question" ? (language === "id" ? "soal" : "questions") : language === "id" ? "jawaban" : "answers"}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState
          message={
            language === "id"
              ? "Tidak ada item dalam konteks ini."
              : "There are no items in this context."
          }
        />
      ) : (
        <div className="max-h-[28rem] overflow-y-auto xl:max-h-[calc(100dvh-10rem)]">
          {items.map((item) => {
            const selected = item.id === selectedItemId;
            const personallyReviewed = reviewed.has(item.id);
            const question =
              task === "question"
                ? (item as Question)
                : questionById.get((item as StudentAnswer).questionId);
            if (!question) return null;

            const identifier = getMaterialQuestionIdentifier(question);
            const reviewCount = Math.min(
              task === "question"
                ? (questionCounts.get(item.id) ?? 0)
                : (answerCounts.get(item.id) ?? 0),
              QUESTION_REVIEWED_THRESHOLD,
            );
            let supportingText = question.expectedConcepts
              .slice(0, 2)
              .map((concept) => t(concept, language))
              .join(", ");
            let answerLabel = "";

            if (task === "answer") {
              const answer = item as StudentAnswer;
              const { option, fallbackText } = resolveAnswerSelection(
                question,
                answer,
              );
              const answerText = option
                ? t(option.text, language)
                : stripSelectedOptionPrefix(fallbackText);
              answerLabel = option?.label
                ? `${language === "id" ? "Opsi" : "Option"} ${option.label}`
                : answer.sourceKey?.trim() || answer.id;
              supportingText = answerText.trim() || answer.id;
            }

            return (
              <button
                key={item.id}
                type="button"
                aria-current={selected ? "true" : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "group flex w-full cursor-pointer items-start gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-neutral/70 focus-visible:relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand active:bg-brand-soft/55",
                  selected && "bg-brand-soft/70",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-extrabold text-brand">
                      {identifier}
                    </span>
                    <span className="rounded border border-border bg-neutral px-1.5 py-0.5 text-[9px] font-bold text-muted">
                      {question.type === "multiple_choice" ? "MP" : "PS"}
                    </span>
                    {answerLabel && (
                      <span className="text-[10px] font-bold text-navy-deep">
                        {answerLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted">
                    {task === "question" && supportingText ? "KC: " : ""}
                    {supportingText || (language === "id" ? "Topik belum tersedia" : "Topic unavailable")}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] font-semibold text-muted">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Users size={12} strokeWidth={2} aria-hidden="true" />
                      {reviewCount}/{QUESTION_REVIEWED_THRESHOLD}
                    </span>
                    {personallyReviewed && (
                      <span className="inline-flex items-center gap-1 text-brand">
                        <Check size={12} strokeWidth={2.5} aria-hidden="true" />
                        {language === "id" ? "Review Anda aktif" : "Your review is active"}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight
                  size={15}
                  strokeWidth={2}
                  aria-hidden="true"
                  className={cn(
                    "mt-1 shrink-0 text-muted transition-transform group-hover:translate-x-0.5",
                    selected && "text-brand",
                  )}
                />
              </button>
            );
          })}
        </div>
      )}
    </aside>
  );
}

export function LecturerReviewPage({
  initialAnswerId,
}: {
  initialAnswerId?: string;
} = {}) {
  const { language } = useLanguage();
  const { user } = useLecturerAuth();
  const { misconceptions, loading: misconceptionsLoading } = useMisconceptions();
  const { tasks: answerTasks, loading: reviewTasksLoading } = useReviewTasks();
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
  const [answerHistory, setAnswerHistory] = useState<AnswerReviewHistoryItem[]>([]);
  const [questionCounts, setQuestionCounts] = useState<Map<string, number>>(
    new Map(),
  );
  const [answerCounts, setAnswerCounts] = useState<Map<string, number>>(
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
  const [loadError, setLoadError] = useState("");
  const [reviewDataRevision, setReviewDataRevision] = useState(0);
  const [handledInitialAnswerId, setHandledInitialAnswerId] = useState("");
  const [questionDirty, setQuestionDirty] = useState(false);
  const [answerDirty, setAnswerDirty] = useState(false);
  const [completionDialog, setCompletionDialog] = useState<
    "question" | "workflow" | null
  >(null);
  const [confirmedQuestionReviewIds, setConfirmedQuestionReviewIds] = useState<
    string[]
  >([]);
  const [confirmedAnswerReviewIds, setConfirmedAnswerReviewIds] = useState<
    string[]
  >([]);

  useEffect(() => {
    let active = true;
    if (!user) {
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
        setLoadError(
          error instanceof Error
            ? error.message
            : "Workspace review belum dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setSnapshotLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

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
      getAnswerReviewCounts(),
      getReviewerHistory(user.id),
    ])
      .then(([, nextQuestionCounts, nextAnswerCounts, history]) => {
        if (!active) return;
        setQuestionCounts(
          new Map(
            nextQuestionCounts.map(({ questionId, reviewCount }) => [
              questionId,
              reviewCount,
            ]),
          ),
        );
        setAnswerCounts(
          new Map(
            nextAnswerCounts.map(({ answerId, reviewCount }) => [
              answerId,
              reviewCount,
            ]),
          ),
        );
        setQuestionHistory(history.questionReviews);
        setAnswerHistory(history.answerReviews);
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
    if ((!questionDirty && !answerDirty) || typeof window === "undefined") {
      return;
    }
    const preventUnsavedExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnsavedExit);
    return () => window.removeEventListener("beforeunload", preventUnsavedExit);
  }, [answerDirty, questionDirty]);

  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const orderedAnswers = useMemo(
    () => orderAnswersByTaskPriority(answers, answerTasks),
    [answerTasks, answers],
  );
  const persistedReviewedQuestionIds = useMemo(
    () => getActiveCurrentQuestionReviewIds(questionHistory, sourceVersions.questions),
    [questionHistory, sourceVersions.questions],
  );
  const reviewedQuestionStepIds = useMemo(
    () => [
      ...new Set([
        ...persistedReviewedQuestionIds,
        ...confirmedQuestionReviewIds,
      ]),
    ],
    [confirmedQuestionReviewIds, persistedReviewedQuestionIds],
  );
  const savedReviewedAnswerIds = useMemo(
    () => getActiveCurrentAnswerReviewIds(answerHistory, sourceVersions.answers),
    [answerHistory, sourceVersions.answers],
  );
  const persistedReviewedAnswerIds = useMemo(
    () =>
      filterEligibleAnswerReviewIds(
        savedReviewedAnswerIds,
        orderedAnswers,
        questionById,
      ),
    [orderedAnswers, questionById, savedReviewedAnswerIds],
  );
  const reviewedAnswerIds = useMemo(
    () => [
      ...new Set([
        ...persistedReviewedAnswerIds,
        ...confirmedAnswerReviewIds,
      ]),
    ],
    [confirmedAnswerReviewIds, persistedReviewedAnswerIds],
  );
  const eligibleAnswerCounts = useMemo(
    () =>
      filterEligibleAnswerReviewCounts(
        answerCounts,
        orderedAnswers,
        questionById,
      ),
    [answerCounts, orderedAnswers, questionById],
  );
  const reviewedQuestionIds = useMemo(
    () =>
      getCompositeReviewedQuestionIds(
        questions,
        orderedAnswers,
        reviewedQuestionStepIds,
        reviewedAnswerIds,
        eligibleAnswerCounts,
        QUESTION_REVIEWED_THRESHOLD,
      ),
    [
      eligibleAnswerCounts,
      orderedAnswers,
      questions,
      reviewedAnswerIds,
      reviewedQuestionStepIds,
    ],
  );
  const navigationReady = snapshotLoaded && metadataLoaded;
  const urlNavigation = useMemo(
    () => parseReviewNavigationSearch(location.search),
    [location.search],
  );
  const reviewStage = useMemo<"overview" | "list" | "detail">(() => {
    if (initialAnswerId || new URLSearchParams(location.search).has("item")) {
      return "detail";
    }
    return new URLSearchParams(location.search).has("week")
      ? "list"
      : "overview";
  }, [initialAnswerId, location.search]);
  const navigation = useMemo(
    () =>
      normalizeReviewNavigationState(
        pendingNavigation ??
          (location.pathname === "/review" && urlNavigation.hasParameters
            ? urlNavigation.state
            : reviewNavigationInput),
        {
        questions,
        answers: orderedAnswers,
        reviewedQuestionIds,
        reviewedAnswerIds,
        },
      ),
    [
      location.pathname,
      orderedAnswers,
      pendingNavigation,
      questions,
      reviewNavigationInput,
      reviewedAnswerIds,
      reviewedQuestionIds,
      urlNavigation,
    ],
  );
  const activeQueue = useMemo(
    () =>
      buildReviewQueue({
        questions,
        answers: orderedAnswers,
        ...navigation,
        reviewedQuestionIds,
        reviewedAnswerIds,
      }),
    [navigation, orderedAnswers, questions, reviewedAnswerIds, reviewedQuestionIds],
  );
  const commitNavigation = useCallback(
    (
      next: ReviewNavigationState,
      options: { replace?: boolean } = {},
    ) => {
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
    if (
      location.pathname === "/review" &&
      location.search === pendingSearch
    ) {
      setPendingNavigation(undefined);
    }
  }, [location.pathname, location.search, pendingNavigation]);

  useEffect(() => {
    if (
      !navigationReady ||
      reviewStage !== "detail" ||
      pendingNavigation ||
      (initialAnswerId && handledInitialAnswerId !== initialAnswerId)
    ) {
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
    handledInitialAnswerId,
    initialAnswerId,
    location.pathname,
    location.search,
    navigate,
    navigation,
    navigationReady,
    pendingNavigation,
    reviewStage,
  ]);

  useEffect(() => {
    if (
      !initialAnswerId ||
      handledInitialAnswerId === initialAnswerId ||
      !navigationReady
    ) {
      return;
    }
    setHandledInitialAnswerId(initialAnswerId);
    const target = resolveAnswerDeepLink(
      initialAnswerId,
      questions,
      orderedAnswers,
      reviewedAnswerIds,
    );
    if (!target) {
      navigate("/review", { replace: true });
      return;
    }
    commitNavigation(target);
  }, [
    handledInitialAnswerId,
    initialAnswerId,
    commitNavigation,
    navigate,
    navigationReady,
    orderedAnswers,
    questions,
    reviewedAnswerIds,
  ]);

  const activeIndex = activeQueue.findIndex(({ id }) => id === navigation.item);
  const activeQuestion =
    navigation.task === "question"
      ? (activeQueue[activeIndex] as Question | undefined)
      : undefined;
  const activeAnswer =
    navigation.task === "answer"
      ? (activeQueue[activeIndex] as StudentAnswer | undefined)
      : undefined;
  const answerQuestion = activeAnswer
    ? questionById.get(activeAnswer.questionId)
    : undefined;
  const answerReviewSequence = useMemo(
    () =>
      getActionableAnswerReviewSequence(
        answerQuestion,
        orderedAnswers,
        reviewedAnswerIds,
        eligibleAnswerCounts,
        QUESTION_REVIEWED_THRESHOLD,
      ),
    [answerQuestion, eligibleAnswerCounts, orderedAnswers, reviewedAnswerIds],
  );
  const questionAnswerReviewSequence = useMemo(
    () =>
      getActionableAnswerReviewSequence(
        activeQuestion,
        orderedAnswers,
        reviewedAnswerIds,
        eligibleAnswerCounts,
        QUESTION_REVIEWED_THRESHOLD,
      ),
    [activeQuestion, eligibleAnswerCounts, orderedAnswers, reviewedAnswerIds],
  );
  const answerStepSequence = useMemo(() => {
    if (navigation.mode === "review") return answerReviewSequence;
    const reviewed = new Set(reviewedAnswerIds);
    return answerReviewSequence.filter(({ id }) => reviewed.has(id));
  }, [answerReviewSequence, navigation.mode, reviewedAnswerIds]);
  const answerSequenceIndex = Math.max(
    0,
    answerStepSequence.findIndex(({ id }) => id === activeAnswer?.id),
  );
  const nextAnswerId = activeAnswer
    ? getNextUnreviewedAnswerId(
        answerReviewSequence,
        [...reviewedAnswerIds, activeAnswer.id],
        activeAnswer.id,
      )
    : undefined;
  const displayedAnswerSequence =
    answerStepSequence.length > 0
      ? answerStepSequence
      : activeAnswer
        ? [activeAnswer]
        : [];
  const answerTaskById = useMemo(
    () => new Map(answerTasks.map((task) => [task.answerCaseId, task])),
    [answerTasks],
  );
  const activeQuestionReviewedByMe = activeQuestion
    ? reviewedQuestionStepIds.includes(activeQuestion.id)
    : false;
  const activeAnswerReviewedByMe = activeAnswer
    ? reviewedAnswerIds.includes(activeAnswer.id)
    : false;
  const activeQuestionCount = activeQuestion
    ? (questionCounts.get(activeQuestion.id) ?? 0)
    : 0;
  const activeAnswerCount = activeAnswer
    ? (eligibleAnswerCounts.get(activeAnswer.id) ?? 0)
    : 0;
  const activeQuestionLocked =
    activeQuestionCount >= QUESTION_REVIEWED_THRESHOLD &&
    !activeQuestionReviewedByMe;
  const activeAnswerLocked =
    activeAnswerCount >= QUESTION_REVIEWED_THRESHOLD && !activeAnswerReviewedByMe;
  const activeQuestionReview = activeQuestion
    ? questionHistory.find(
        (review) =>
          review.questionId === activeQuestion.id &&
          review.sourceVersion === activeQuestion.sourceVersion &&
          review.isActive,
      )
    : undefined;
  const activeAnswerReview = activeAnswer
    ? answerHistory.find(
        (review) =>
          review.answerId === activeAnswer.id &&
          review.questionId === activeAnswer.questionId &&
          review.sourceVersion === activeAnswer.sourceVersion &&
          review.isActive,
      )
    : undefined;
  const weekOptions = getMaterialWeekOptions(questions);
  const weekSummaries = useMemo(
    () =>
      getReviewWeekSummaries(
        questions,
        reviewedQuestionIds,
        questionCounts,
        QUESTION_REVIEWED_THRESHOLD,
        reviewedQuestionStepIds,
      ),
    [
      questionCounts,
      questions,
      reviewedQuestionIds,
      reviewedQuestionStepIds,
    ],
  );
  const contextQueues = useMemo(
    () =>
      (["unreviewed", "reviewed"] as const).map((status) =>
        buildReviewQueue({
          questions,
          answers: orderedAnswers,
          ...navigation,
          status,
          reviewedQuestionIds,
          reviewedAnswerIds,
        }),
      ),
    [navigation, orderedAnswers, questions, reviewedAnswerIds, reviewedQuestionIds],
  );
  const reviewedTotal = contextQueues[1].length;
  const contextTotal = contextQueues[0].length + reviewedTotal;
  const loading =
    snapshotLoading ||
    metadataLoading ||
    misconceptionsLoading ||
    reviewTasksLoading;

  const confirmNavigation = useCallback(
    (next: ReviewNavigationState) => {
      const dirty = navigation.task === "answer" ? answerDirty : questionDirty;
      if (!dirty || (next.task === navigation.task && next.item === navigation.item)) {
        return true;
      }
      return window.confirm(
        language === "id"
          ? "Review ini belum disimpan. Tetap pindah?"
          : "This review has not been saved. Continue?",
      );
    },
    [answerDirty, language, navigation.item, navigation.task, questionDirty],
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
          answers: orderedAnswers,
          reviewedQuestionIds,
          reviewedAnswerIds,
        },
      );
      if (!confirmNavigation(next)) return false;
      setQuestionDirty(false);
      setAnswerDirty(false);
      commitNavigation(next, {
        replace: options.replace,
      });
      return true;
    },
    [
      confirmNavigation,
      commitNavigation,
      navigation,
      orderedAnswers,
      questions,
      reviewedAnswerIds,
      reviewedQuestionIds,
    ],
  );

  const viewHistory = () => navigate("/review/riwayat");
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
    setAnswerDirty(false);
    navigate("/review");
  }, [confirmNavigation, navigate, navigation, reviewStage]);
  const navigateToWeek = useCallback(
    (week: string) => {
      if (
        reviewStage === "detail" &&
        !confirmNavigation({ ...navigation, week, task: "question", item: undefined })
      ) {
        return;
      }
      setQuestionDirty(false);
      setAnswerDirty(false);
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
    setCompletionDialog(null);
    setQuestionDirty(false);
    setAnswerDirty(false);
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
      changeNavigation(
        {
          week: question.week ?? navigation.week,
          task: "question",
          status,
          type: navigation.type,
          mode,
          item: question.id,
          returnAnswer: undefined,
        },
        { replace: false },
      );
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
  const withdrawQuestionReview = useCallback(async (question: Question) => {
    if (!question.sourceVersion) {
      throw new Error("Versi sumber soal belum tersedia.");
    }
    await deleteQuestionReview(question.id, question.sourceVersion);
    setQuestionHistory((current) =>
      current.map((review) =>
        review.questionId === question.id &&
        review.sourceVersion === question.sourceVersion &&
        review.isActive
          ? {
              ...review,
              isActive: false,
              inactiveReason: "deleted",
              inactiveAt: new Date().toISOString(),
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
  }, []);

  const handleQuestionSubmit = async (values: QuestionReviewValues) => {
    if (
      !activeQuestion?.sourceVersion ||
      activeQuestionLocked ||
      navigation.mode === "view"
    ) {
      return;
    }
    const alreadyReviewed = reviewedQuestionStepIds.includes(activeQuestion.id);
    await saveQuestionReview(activeQuestion.id, activeQuestion.sourceVersion, values);
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

    if (activeQuestion.type !== "multiple_choice") {
      commitNavigation({
        ...navigation,
        status: "reviewed",
        item: activeQuestion.id,
        returnAnswer: undefined,
      });
      setCompletionDialog("question");
      return;
    }

    const returnAnswerId = questionAnswerReviewSequence.some(
      ({ id }) => id === navigation.returnAnswer,
    )
      ? navigation.returnAnswer
      : undefined;
    const firstAnswerId =
      returnAnswerId ??
      getNextUnreviewedAnswerId(questionAnswerReviewSequence, reviewedAnswerIds);
    const target = firstAnswerId
      ? resolveAnswerDeepLink(
          firstAnswerId,
          questions,
          orderedAnswers,
          reviewedAnswerIds,
        )
      : undefined;
    if (target) {
      commitNavigation({
        ...target,
        type: navigation.type,
        mode: "review",
        returnAnswer: undefined,
      });
    } else {
      commitNavigation({
        ...navigation,
        status: "reviewed",
        item: activeQuestion.id,
        returnAnswer: undefined,
      });
      setCompletionDialog("workflow");
    }
  };

  const handleAnswerDelete = async () => {
    if (!activeAnswer?.sourceVersion) {
      throw new Error("Versi sumber jawaban belum tersedia.");
    }
    await deleteAnswerReview(activeAnswer.id, activeAnswer.sourceVersion);
    setAnswerHistory((current) =>
      current.map((review) =>
        review.answerId === activeAnswer.id &&
        review.sourceVersion === activeAnswer.sourceVersion &&
        review.isActive
          ? {
              ...review,
              isActive: false,
              inactiveReason: "deleted",
              inactiveAt: new Date().toISOString(),
            }
          : review,
      ),
    );
    setAnswerCounts((current) => {
      const next = new Map(current);
      next.set(activeAnswer.id, Math.max(0, (next.get(activeAnswer.id) ?? 1) - 1));
      return next;
    });
    setConfirmedAnswerReviewIds((current) =>
      current.filter((answerId) => answerId !== activeAnswer.id),
    );
    commitNavigation(
      getNavigationAfterWithdraw(navigation, activeAnswer.id),
    );
    setReviewDataRevision((current) => current + 1);
  };

  const handleAnswerSubmit = async (values: AnswerReviewValues) => {
    if (
      !activeAnswer?.sourceVersion ||
      !answerQuestion ||
      activeAnswerLocked ||
      navigation.mode === "view"
    ) {
      return;
    }
    const alreadyReviewed = reviewedAnswerIds.includes(activeAnswer.id);
    await saveAnswerReview(
      activeAnswer.id,
      answerQuestion.id,
      activeAnswer.sourceVersion,
      values,
    );
    if (!alreadyReviewed) {
      setConfirmedAnswerReviewIds((current) => [
        ...new Set([...current, activeAnswer.id]),
      ]);
      setAnswerCounts((current) => {
        const next = new Map(current);
        next.set(activeAnswer.id, (next.get(activeAnswer.id) ?? 0) + 1);
        return next;
      });
    }
    setAnswerDirty(false);
    setReviewDataRevision((current) => current + 1);
    if (navigation.mode === "edit") return;

    if (nextAnswerId) {
      const target = resolveAnswerDeepLink(
        nextAnswerId,
        questions,
        orderedAnswers,
        reviewedAnswerIds,
      );
      if (target) {
        commitNavigation({
          ...target,
          status: "unreviewed",
          type: navigation.type,
          mode: "review",
          returnAnswer: undefined,
        });
        return;
      }
    }

    commitNavigation({
      week: navigation.week,
      task: "question",
      status: "reviewed",
      type: navigation.type,
      mode: "review",
      item: answerQuestion.id,
      returnAnswer: undefined,
    });
    setCompletionDialog("workflow");
  };

  const navigateToAnswerStep = (
    answer: StudentAnswer,
    returnAnswer?: string,
  ) =>
    changeNavigation({
      task: "answer",
      status: reviewedAnswerIds.includes(answer.id) ? "reviewed" : "unreviewed",
      type: navigation.type,
      mode: navigation.mode,
      item: answer.id,
      returnAnswer,
    });

  const navigateToQuestionStep = (
    question: Question,
    returnAnswer?: string,
  ) =>
    changeNavigation({
      task: "question",
      status: getWeekReviewQuestionStatus(
        question.id,
        new Set(reviewedQuestionIds),
        questionCounts,
        QUESTION_REVIEWED_THRESHOLD,
        new Set(reviewedQuestionStepIds),
      ),
      type: navigation.type,
      mode: navigation.mode,
      item: question.id,
      returnAnswer,
    });

  const questionStepSequence =
    navigation.mode === "review"
      ? getReachableAnswerReviewSequence(
          questionAnswerReviewSequence,
          reviewedAnswerIds,
          navigation.returnAnswer,
        )
      : questionAnswerReviewSequence.filter(({ id }) =>
          reviewedAnswerIds.includes(id),
        );
  const questionNextAnswer =
    activeQuestion?.type === "multiple_choice"
      ? navigation.mode === "review"
        ? activeQuestionReviewedByMe
          ? questionStepSequence[0]
          : undefined
        : questionStepSequence[0]
      : undefined;
  const questionNextStep =
    activeQuestion && questionNextAnswer
      ? {
          label: getAnswerStepLabel(
            activeQuestion,
            questionNextAnswer,
            questionStepSequence.findIndex(({ id }) => id === questionNextAnswer.id),
            language,
          ),
          onClick: () =>
            navigateToAnswerStep(
              questionNextAnswer,
              navigation.mode === "review"
                ? navigation.returnAnswer
                : undefined,
            ),
        }
      : undefined;

  const returnAnswerForPreviousStep =
    navigation.mode === "review"
      ? navigation.returnAnswer ?? activeAnswer?.id
      : undefined;
  const previousAnswer =
    answerSequenceIndex > 0
      ? displayedAnswerSequence[answerSequenceIndex - 1]
      : undefined;
  const nextAnswer = displayedAnswerSequence[answerSequenceIndex + 1];
  const answerPreviousStep =
    activeAnswer && answerQuestion
      ? previousAnswer
        ? {
            label: getAnswerStepLabel(
              answerQuestion,
              previousAnswer,
              answerSequenceIndex - 1,
              language,
            ),
            onClick: () =>
              navigateToAnswerStep(previousAnswer, returnAnswerForPreviousStep),
          }
        : {
            label: language === "id" ? "Kembali ke soal" : "Back to question",
            onClick: () =>
              navigateToQuestionStep(answerQuestion, returnAnswerForPreviousStep),
          }
      : undefined;
  const reachableAnswerStepIds = new Set(
    getReachableAnswerReviewSequence(
      answerReviewSequence,
      reviewedAnswerIds,
      navigation.returnAnswer ?? activeAnswer?.id,
    ).map(({ id }) => id),
  );
  const answerNextIsReachable = Boolean(
    nextAnswer &&
      (navigation.mode !== "review" ||
        reachableAnswerStepIds.has(nextAnswer.id)),
  );
  const answerNextStep =
    activeAnswer && answerQuestion && nextAnswer && answerNextIsReachable
      ? {
          label: getAnswerStepLabel(
            answerQuestion,
            nextAnswer,
            answerSequenceIndex + 1,
            language,
          ),
          onClick: () => navigateToAnswerStep(nextAnswer),
        }
      : undefined;

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

  const detailQuestion = activeQuestion ?? answerQuestion;
  const detailLabel = detailQuestion
    ? t(detailQuestion.title, language).trim() ||
      getMaterialQuestionIdentifier(detailQuestion)
    : navigation.item;

  if (isQuestionDetailTask(navigation.task)) {
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
            nextStep={questionNextStep}
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
            kind={completionDialog}
            week={navigation.week}
            language={language}
            onConfirm={returnToWeekList}
          />
        )}
      </div>
    );
  }

  if (navigation.task === "answer") {
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
            aria-label={language === "id" ? "Memuat review jawaban" : "Loading answer review"}
            className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_390px]"
          >
            <div className="h-[32rem] animate-pulse rounded-lg bg-[var(--review-secondary-soft)]" />
            <div className="h-[32rem] animate-pulse rounded-lg border border-[#ccbab0] bg-white" />
          </div>
        ) : activeAnswer && answerQuestion ? (
          <AnswerValidationWorkspace
            key={activeAnswer.id}
            task={answerTaskById.get(activeAnswer.id)}
            question={answerQuestion}
            answer={activeAnswer}
            evidenceAnswers={getEvidenceAnswersForQuestion(answerQuestion.id, answers)}
            misconceptions={misconceptions}
            locked={activeAnswerLocked}
            progressUnavailable={!navigationReady || !activeAnswer.sourceVersion}
            reviewedByMe={activeAnswerReviewedByMe}
            mode={navigation.mode}
            previousStep={answerPreviousStep}
            nextStep={answerNextStep}
            isFinalAnswer={!nextAnswerId}
            submittedReview={activeAnswerReview}
            onDirtyChange={setAnswerDirty}
            onDelete={handleAnswerDelete}
            onSubmit={handleAnswerSubmit}
          />
        ) : (
          <EmptyState
            message={
              language === "id"
                ? "Jawaban ini tidak tersedia untuk direview."
                : "This answer is not available for review."
            }
          />
        )}
        {completionDialog && (
          <ReviewCompletionDialog
            kind={completionDialog}
            week={navigation.week}
            language={language}
            onConfirm={returnToWeekList}
          />
        )}
      </div>
    );
  }

  return (
    <div className="lecturer-ui mx-auto max-w-[1440px] text-black">
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

      <section className="rounded-lg border border-border bg-white p-4 sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(12rem,0.8fr)_minmax(18rem,1.4fr)_minmax(18rem,1.4fr)_auto] xl:items-end">
          <label className="grid gap-1.5 text-xs font-bold text-navy-deep">
            <span>{language === "id" ? "Minggu" : "Week"}</span>
            <select
              value={navigation.week}
              disabled={loading || weekOptions.length === 0}
              onChange={(event) => changeNavigation({ week: event.target.value })}
              className="min-h-10 cursor-pointer rounded-md border border-border bg-white px-3 text-sm font-semibold text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-60"
            >
              {weekOptions.map((week) => (
                <option key={week} value={week}>
                  {week}
                </option>
              ))}
            </select>
          </label>

          <div>
            <p className="mb-1.5 text-xs font-bold text-navy-deep">
              {language === "id" ? "Tugas" : "Task"}
            </p>
            <div className="segmented-control" role="tablist" aria-label={language === "id" ? "Tugas review" : "Review task"}>
              {(["question", "answer"] as ReviewTaskKind[]).map((task) => (
                <button
                  key={task}
                  type="button"
                  role="tab"
                  aria-selected={navigation.task === task}
                  onClick={() => changeNavigation({ task, type: "all" })}
                  className="segmented-tab"
                >
                  {task === "question" ? (language === "id" ? "Soal" : "Questions") : language === "id" ? "Jawaban" : "Answers"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold text-navy-deep">
              {language === "id" ? "Status pribadi" : "Personal status"}
            </p>
            <div className="segmented-control" role="tablist" aria-label={language === "id" ? "Status review pribadi" : "Personal review status"}>
              {(["unreviewed", "reviewed"] as ReviewPersonalStatus[]).map((status) => (
                <button
                  key={status}
                  type="button"
                  role="tab"
                  aria-selected={navigation.status === status}
                  onClick={() => changeNavigation({ status })}
                  className="segmented-tab"
                >
                  {status === "unreviewed" ? (language === "id" ? "Belum direview" : "Not reviewed") : language === "id" ? "Sudah direview" : "Reviewed"}
                </button>
              ))}
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={viewHistory}
            className="min-h-10 justify-center xl:self-end"
          >
            <History size={15} strokeWidth={2} aria-hidden="true" />
            {language === "id" ? "Riwayat" : "History"}
          </Button>
        </div>

        {navigation.task === "question" && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <p className="text-xs font-bold text-navy-deep">
              {language === "id" ? "Jenis soal" : "Question type"}
            </p>
            <div className="segmented-control" role="tablist" aria-label={language === "id" ? "Jenis soal" : "Question type"}>
              {(["all", "ps", "mp"] as ReviewQuestionType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  role="tab"
                  aria-selected={navigation.type === type}
                  onClick={() => changeNavigation({ type })}
                  className="segmented-tab !min-h-8 !px-3 !py-1.5 !text-xs"
                >
                  {type === "all" ? (language === "id" ? "Semua" : "All") : type.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        )}

        <p className="mt-4 text-sm font-semibold tabular-nums text-muted" aria-live="polite">
          {loading
            ? language === "id"
              ? "Memuat ringkasan..."
              : "Loading summary..."
            : language === "id"
              ? `${reviewedTotal} dari ${contextTotal} ${navigation.task === "question" ? "soal" : "jawaban"} sudah Anda review`
              : `You have reviewed ${reviewedTotal} of ${contextTotal} ${navigation.task === "question" ? "questions" : "answers"}`}
        </p>
      </section>

      {loading ? (
        <div className="mt-5 rounded-lg border border-border bg-white">
          <EmptyState loading message={language === "id" ? "Memuat tugas validasi..." : "Loading validation tasks..."} />
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-[310px_minmax(0,1fr)] xl:items-start">
          <QueuePanel
            items={activeQueue}
            selectedItemId={navigation.item}
            task={navigation.task}
            language={language}
            questionById={questionById}
            questionCounts={questionCounts}
            answerCounts={eligibleAnswerCounts}
            reviewedQuestionIds={reviewedQuestionIds}
            reviewedAnswerIds={reviewedAnswerIds}
            onSelect={(itemId) => changeNavigation({ item: itemId })}
          />

          <main className="min-w-0">
            {activeQuestion ? (
              <QuestionValidationWorkspace
                key={activeQuestion.id}
                question={activeQuestion}
                answers={answers}
                misconceptions={misconceptions}
                locked={activeQuestionLocked}
                progressUnavailable={!navigationReady || !activeQuestion.sourceVersion}
                submittedReview={activeQuestionReview}
                mode={navigation.mode}
                nextStep={questionNextStep}
                onDirtyChange={setQuestionDirty}
                onSelectMisconception={(misconceptionId) =>
                  navigate(`/miskonsepsi/${misconceptionId}`)
                }
                onSubmit={handleQuestionSubmit}
              />
            ) : activeAnswer && answerQuestion ? (
              <AnswerValidationWorkspace
                key={activeAnswer.id}
                task={answerTaskById.get(activeAnswer.id)}
                question={answerQuestion}
                answer={activeAnswer}
                evidenceAnswers={getEvidenceAnswersForQuestion(answerQuestion.id, answers)}
                misconceptions={misconceptions}
                locked={activeAnswerLocked}
                progressUnavailable={!navigationReady || !activeAnswer.sourceVersion}
                reviewedByMe={activeAnswerReviewedByMe}
                mode={navigation.mode}
                previousStep={answerPreviousStep}
                nextStep={answerNextStep}
                isFinalAnswer={!nextAnswerId}
                submittedReview={activeAnswerReview}
                onDirtyChange={setAnswerDirty}
                onDelete={handleAnswerDelete}
                onSubmit={handleAnswerSubmit}
              />
            ) : (
              <div className="rounded-lg border border-border bg-white">
                <EmptyState
                  message={
                    language === "id"
                      ? `Tidak ada ${navigation.task === "question" ? "soal" : "jawaban"} ${navigation.status === "reviewed" ? "yang sudah Anda review" : "yang belum Anda review"} untuk ${navigation.week}.`
                      : `There are no ${navigation.status === "reviewed" ? "reviewed" : "unreviewed"} ${navigation.task === "question" ? "questions" : "answers"} for ${navigation.week}.`
                  }
                />
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  );
}
