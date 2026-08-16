import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, ChevronRight, History, Search, Users } from "lucide-react";
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
  getNavigationAfterReviewSave,
  getNavigationAfterWithdraw,
  getReviewWeekSummaries,
  normalizeReviewNavigationState,
  parseReviewNavigationSearch,
  parseReviewNavigationSession,
  resolveAnswerDeepLink,
  serializeReviewNavigationSearch,
  serializeReviewNavigationSession,
  type ReviewNavigationState,
  type ReviewPersonalStatus,
  type ReviewQuestionType,
  type ReviewTaskKind,
  type ReviewWeekSummary,
} from "../utils/reviewQueue";
import { QUESTION_REVIEWED_THRESHOLD } from "../utils/reviewQuestionFilters";
import {
  filterEligibleAnswerReviewCounts,
  filterEligibleAnswerReviewIds,
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
    <nav aria-label="Breadcrumb" className="mb-4 overflow-x-auto text-xs text-muted">
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

function WeekOverview({
  summaries,
  language,
  loading,
  onSelectWeek,
  onViewHistory,
}: {
  summaries: ReviewWeekSummary[];
  language: Language;
  loading: boolean;
  onSelectWeek: (week: string) => void;
  onViewHistory: () => void;
}) {
  return (
    <>
      <ReviewBreadcrumb language={language} />
      <div className="flex flex-col gap-4 border-b border-[#ccbab0]/55 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[1.875rem] font-semibold leading-10 tracking-[-0.02em] text-black">
            {language === "id" ? "Review soal per minggu" : "Review questions by week"}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {language === "id"
              ? "Pilih minggu untuk melihat soal yang perlu ditinjau."
              : "Choose a week to see the questions that need review."}
          </p>
        </div>
        <Button type="button" variant="secondary" onClick={onViewHistory} className="w-fit">
          <History size={15} strokeWidth={2} aria-hidden="true" />
          {language === "id" ? "Riwayat" : "History"}
        </Button>
      </div>

      {loading ? (
        <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" role="status" aria-label={language === "id" ? "Memuat minggu" : "Loading weeks"}>
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-xl bg-[#ccbab0]/20" />
          ))}
        </div>
      ) : summaries.length === 0 ? (
        <div className="mt-7 rounded-xl border border-border bg-white">
          <EmptyState message={language === "id" ? "Belum ada minggu yang tersedia untuk direview." : "No weeks are available for review yet."} />
        </div>
      ) : (
        <section aria-label={language === "id" ? "Daftar minggu" : "Week list"} className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {summaries.map((summary) => (
            <button
              key={summary.week}
              type="button"
              onClick={() => onSelectWeek(summary.week)}
              className="group relative min-h-36 cursor-pointer rounded-xl border border-[#ccbab0]/55 bg-white p-5 text-left transition-[border-color,background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-brand/45 hover:bg-[#fbfbfe] hover:shadow-[0_10px_28px_rgba(95,71,59,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-0"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-black">{formatWeekLabel(summary.week)}</h2>
                  <p className="mt-2 text-sm text-muted">
                    {summary.total} {language === "id" ? "soal" : summary.total === 1 ? "question" : "questions"}
                  </p>
                </div>
                <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" className="mt-0.5 text-[#b09f85] transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
              </div>
              <p className="mt-5 text-xs font-medium tabular-nums text-muted">
                {language === "id" ? "Tuntas" : "Complete"} {summary.completed}/{summary.total}
              </p>
              {summary.isComplete && (
                <span className="absolute bottom-4 right-4 inline-flex h-6 w-6 items-center justify-center rounded-full bg-correct-bg text-correct" aria-label={language === "id" ? "Semua soal sudah tuntas" : "All questions complete"}>
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

function WeekQuestionList({
  week,
  questions,
  language,
  questionCounts,
  reviewedQuestionIds,
  onBack,
  onSelectQuestion,
}: {
  week: string;
  questions: readonly Question[];
  language: Language;
  questionCounts: ReadonlyMap<string, number>;
  reviewedQuestionIds: readonly string[];
  onBack: () => void;
  onSelectQuestion: (question: Question) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<ReviewQuestionType>("all");
  const [status, setStatus] = useState<"all" | ReviewPersonalStatus>("all");
  const reviewed = useMemo(() => new Set(reviewedQuestionIds), [reviewedQuestionIds]);
  const weekTotal = useMemo(
    () => new Set(questions.filter((question) => question.week === week).map(({ id }) => id)).size,
    [questions, week],
  );
  const filteredQuestions = useMemo(
    () =>
      filterWeekReviewQuestions(questions, {
        week,
        query,
        type,
        status,
        reviewedQuestionIds,
      }),
    [questions, query, reviewedQuestionIds, status, type, week],
  );

  return (
    <>
      <ReviewBreadcrumb week={week} language={language} onOverview={onBack} />
      <button
        type="button"
        onClick={onBack}
        className="mb-4 inline-flex cursor-pointer items-center gap-2 rounded-md text-sm font-medium text-muted transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
        {language === "id" ? "Semua minggu" : "All weeks"}
      </button>
      <div className="border-b border-[#ccbab0]/55 pb-6">
        <h1 className="text-[1.875rem] font-semibold leading-10 tracking-[-0.02em] text-black">
          {formatWeekLabel(week)}
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          {language === "id"
            ? `${weekTotal} soal tersedia. Pilih soal untuk membuka workspace review.`
            : `${weekTotal} questions available. Choose a question to open the review workspace.`}
        </p>
      </div>

      <section className="mt-6" aria-label={language === "id" ? "Soal minggu terpilih" : "Selected week questions"}>
        <div className="grid gap-3 rounded-xl border border-[#ccbab0]/55 bg-white p-3 lg:grid-cols-[minmax(15rem,1fr)_10rem_12rem] lg:items-end">
          <label className="grid gap-1.5 text-xs font-medium text-navy-deep">
            <span>{language === "id" ? "Cari soal" : "Search questions"}</span>
            <span className="relative block">
              <Search size={16} strokeWidth={1.8} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b09f85]" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={language === "id" ? "Judul, kode, atau KC" : "Title, code, or concept"}
                className="min-h-10 w-full rounded-lg border border-border bg-[#fbfbfe] py-2 pl-9 pr-3 text-sm font-normal text-black outline-none transition-[border-color,box-shadow] placeholder:text-muted/75 focus:border-brand focus:ring-2 focus:ring-brand/10"
              />
            </span>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-navy-deep">
            <span>{language === "id" ? "Jenis soal" : "Question type"}</span>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ReviewQuestionType)}
              className="min-h-10 cursor-pointer rounded-lg border border-border bg-[#fbfbfe] px-3 text-sm font-normal text-black outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-2 focus:ring-brand/10"
            >
              <option value="all">{language === "id" ? "Semua jenis" : "All types"}</option>
              <option value="ps">PS</option>
              <option value="mp">MP</option>
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-navy-deep">
            <span>{language === "id" ? "Status pribadi" : "Personal status"}</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | ReviewPersonalStatus)}
              className="min-h-10 cursor-pointer rounded-lg border border-border bg-[#fbfbfe] px-3 text-sm font-normal text-black outline-none transition-[border-color,box-shadow] focus:border-brand focus:ring-2 focus:ring-brand/10"
            >
              <option value="all">{language === "id" ? "Semua status" : "All statuses"}</option>
              <option value="unreviewed">{language === "id" ? "Belum direview" : "Not reviewed"}</option>
              <option value="reviewed">{language === "id" ? "Sudah direview" : "Reviewed"}</option>
            </select>
          </label>
        </div>

        <p className="mt-4 text-xs font-medium tabular-nums text-muted" aria-live="polite">
          {language === "id"
            ? `${filteredQuestions.length} dari ${weekTotal} soal`
            : `${filteredQuestions.length} of ${weekTotal} questions`}
        </p>

        {filteredQuestions.length === 0 ? (
          <div className="mt-3 rounded-xl border border-border bg-white">
            <EmptyState message={language === "id" ? "Tidak ada soal yang cocok dengan pencarian atau filter ini." : "No questions match these filters."} />
          </div>
        ) : (
          <div className="mt-3 overflow-hidden rounded-xl border border-[#ccbab0]/55 bg-white">
            <div aria-hidden="true" className="hidden grid-cols-[3.5rem_minmax(0,1fr)_5rem_10rem_8rem_2rem] gap-3 border-b border-border bg-[#fbfbfe] px-4 py-3 text-xs font-medium text-muted lg:grid">
              <span>No.</span>
              <span>{language === "id" ? "Soal" : "Question"}</span>
              <span>{language === "id" ? "Tipe" : "Type"}</span>
              <span>{language === "id" ? "Status pribadi" : "Personal status"}</span>
              <span>{language === "id" ? "Reviewer" : "Reviewers"}</span>
              <span />
            </div>
            <ul>
              {filteredQuestions.map((question, index) => {
                const personallyReviewed = reviewed.has(question.id);
                const identifier = getMaterialQuestionIdentifier(question);
                const title = t(question.title, language).trim() || identifier;
                const concepts = question.expectedConcepts
                  .slice(0, 2)
                  .map((concept) => t(concept, language))
                  .filter(Boolean)
                  .join(", ");
                const reviewCount = Math.min(
                  questionCounts.get(question.id) ?? 0,
                  QUESTION_REVIEWED_THRESHOLD,
                );

                return (
                  <li key={question.id} className="border-b border-border last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onSelectQuestion(question)}
                      className="group grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-4 text-left transition-colors hover:bg-[#fbfbfe] focus-visible:relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand active:bg-brand-soft/45 lg:grid-cols-[3.5rem_minmax(0,1fr)_5rem_10rem_8rem_2rem]"
                    >
                      <span className="hidden text-sm tabular-nums text-muted lg:block">{index + 1}</span>
                      <span className="min-w-0">
                        <span className="block text-xs font-medium text-brand">{identifier}</span>
                        <span className="mt-1 block truncate text-sm font-semibold text-black">{title}</span>
                        {concepts && <span className="mt-1 block truncate text-xs font-normal text-muted">KC: {concepts}</span>}
                        <span className="mt-2 flex flex-wrap items-center gap-2 lg:hidden">
                          <span className="rounded-md border border-border bg-neutral px-2 py-1 text-[11px] font-medium text-muted">{question.type === "multiple_choice" ? "MP" : "PS"}</span>
                          <span className={cn("rounded-md px-2 py-1 text-[11px] font-medium", personallyReviewed ? "bg-correct-bg text-correct" : "bg-[#ccbab0]/20 text-muted")}>
                            {personallyReviewed ? (language === "id" ? "Sudah direview" : "Reviewed") : language === "id" ? "Belum direview" : "Not reviewed"}
                          </span>
                          <span className="text-[11px] font-medium tabular-nums text-muted">{reviewCount}/{QUESTION_REVIEWED_THRESHOLD} reviewer</span>
                        </span>
                      </span>
                      <span className="hidden text-sm font-medium text-muted lg:block">{question.type === "multiple_choice" ? "MP" : "PS"}</span>
                      <span className={cn("hidden w-fit rounded-md px-2 py-1 text-xs font-medium lg:block", personallyReviewed ? "bg-correct-bg text-correct" : "bg-[#ccbab0]/20 text-muted")}>
                        {personallyReviewed ? (language === "id" ? "Sudah direview" : "Reviewed") : language === "id" ? "Belum direview" : "Not reviewed"}
                      </span>
                      <span className="hidden text-sm font-medium tabular-nums text-muted lg:block">{reviewCount}/{QUESTION_REVIEWED_THRESHOLD}</span>
                      <ChevronRight size={17} strokeWidth={1.8} aria-hidden="true" className="text-[#b09f85] transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
                    </button>
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
  const { user, isAdmin } = useLecturerAuth();
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
  const [snapshotLoading, setSnapshotLoading] = useState(true);
  const [metadataLoading, setMetadataLoading] = useState(true);
  const [snapshotLoaded, setSnapshotLoaded] = useState(false);
  const [metadataLoaded, setMetadataLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [reviewDataRevision, setReviewDataRevision] = useState(0);
  const [handledInitialAnswerId, setHandledInitialAnswerId] = useState("");
  const [questionDirty, setQuestionDirty] = useState(false);
  const [answerDirty, setAnswerDirty] = useState(false);

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
  const reviewedQuestionIds = useMemo(
    () => getActiveCurrentQuestionReviewIds(questionHistory, sourceVersions.questions),
    [questionHistory, sourceVersions.questions],
  );
  const savedReviewedAnswerIds = useMemo(
    () => getActiveCurrentAnswerReviewIds(answerHistory, sourceVersions.answers),
    [answerHistory, sourceVersions.answers],
  );
  const reviewedAnswerIds = useMemo(
    () =>
      filterEligibleAnswerReviewIds(
        savedReviewedAnswerIds,
        orderedAnswers,
        questionById,
      ),
    [orderedAnswers, questionById, savedReviewedAnswerIds],
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
        location.pathname === "/review" && urlNavigation.hasParameters
          ? urlNavigation.state
          : reviewNavigationInput,
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
    (next: ReviewNavigationState) => {
      setReviewNavigationInput(next);
      navigate(
        { pathname: "/review", search: serializeReviewNavigationSearch(next) },
        { replace: true },
      );
    },
    [navigate],
  );

  useEffect(() => {
    if (
      !navigationReady ||
      reviewStage !== "detail" ||
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
  const answerTaskById = useMemo(
    () => new Map(answerTasks.map((task) => [task.answerCaseId, task])),
    [answerTasks],
  );
  const activeQuestionReviewedByMe = activeQuestion
    ? reviewedQuestionIds.includes(activeQuestion.id)
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
      ),
    [questionCounts, questions, reviewedQuestionIds],
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
    (patch: Partial<ReviewNavigationState>) => {
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
      commitNavigation(next);
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
      navigate({ pathname: "/review", search: `?week=${encodeURIComponent(week)}` });
    },
    [confirmNavigation, navigate, navigation, reviewStage],
  );
  const openQuestion = useCallback(
    (question: Question) => {
      changeNavigation({
        week: question.week ?? navigation.week,
        task: "question",
        status: reviewedQuestionIds.includes(question.id)
          ? "reviewed"
          : "unreviewed",
        type: "all",
        item: question.id,
      });
    },
    [changeNavigation, navigation.week, reviewedQuestionIds],
  );
  const selectOffset = (offset: number) => {
    const item = activeQueue[activeIndex + offset];
    if (item) changeNavigation({ item: item.id });
  };

  const handleQuestionDelete = async () => {
    if (!activeQuestion?.sourceVersion) {
      throw new Error("Versi sumber soal belum tersedia.");
    }
    await deleteQuestionReview(activeQuestion.id, activeQuestion.sourceVersion);
    setQuestionHistory((current) =>
      current.map((review) =>
        review.questionId === activeQuestion.id &&
        review.sourceVersion === activeQuestion.sourceVersion &&
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
      next.set(activeQuestion.id, Math.max(0, (next.get(activeQuestion.id) ?? 1) - 1));
      return next;
    });
    commitNavigation(
      getNavigationAfterWithdraw(navigation, activeQuestion.id),
    );
    setReviewDataRevision((current) => current + 1);
  };

  const handleQuestionSubmit = async (values: QuestionReviewValues) => {
    if (!activeQuestion?.sourceVersion || activeQuestionLocked) return;
    const alreadyReviewed = reviewedQuestionIds.includes(activeQuestion.id);
    const nextNavigation = getNavigationAfterReviewSave(
      navigation,
      activeQueue,
      activeQuestion.id,
      alreadyReviewed,
    );
    await saveQuestionReview(activeQuestion.id, activeQuestion.sourceVersion, values);
    if (!alreadyReviewed) {
      setQuestionCounts((current) => {
        const next = new Map(current);
        next.set(activeQuestion.id, (next.get(activeQuestion.id) ?? 0) + 1);
        return next;
      });
      commitNavigation(nextNavigation);
    }
    setQuestionDirty(false);
    setReviewDataRevision((current) => current + 1);
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
    commitNavigation(
      getNavigationAfterWithdraw(navigation, activeAnswer.id),
    );
    setReviewDataRevision((current) => current + 1);
  };

  const handleAnswerSubmit = async (values: AnswerReviewValues) => {
    if (!activeAnswer?.sourceVersion || !answerQuestion || activeAnswerLocked) {
      return;
    }
    const alreadyReviewed = reviewedAnswerIds.includes(activeAnswer.id);
    const nextNavigation = getNavigationAfterReviewSave(
      navigation,
      activeQueue,
      activeAnswer.id,
      alreadyReviewed,
    );
    await saveAnswerReview(
      activeAnswer.id,
      answerQuestion.id,
      activeAnswer.sourceVersion,
      values,
    );
    if (!alreadyReviewed) {
      setAnswerCounts((current) => {
        const next = new Map(current);
        next.set(activeAnswer.id, (next.get(activeAnswer.id) ?? 0) + 1);
        return next;
      });
      commitNavigation(nextNavigation);
    }
    setAnswerDirty(false);
    setReviewDataRevision((current) => current + 1);
  };

  if (reviewStage === "overview") {
    return (
      <div className="lecturer-ui mx-auto max-w-[1240px] text-black">
        {loadError && (
          <p role="alert" className="mb-5 rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect">
            {loadError}
          </p>
        )}
        <WeekOverview
          summaries={weekSummaries}
          language={language}
          loading={loading}
          onSelectWeek={navigateToWeek}
          onViewHistory={viewHistory}
        />
      </div>
    );
  }

  if (reviewStage === "list") {
    const requestedWeek = new URLSearchParams(location.search).get("week") ?? "";
    const selectedWeek = navigation.week || requestedWeek;

    return (
      <div className="lecturer-ui mx-auto max-w-[1240px] text-black">
        {loadError && (
          <p role="alert" className="mb-5 rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect">
            {loadError}
          </p>
        )}
        {loading ? (
          <div role="status" aria-label={language === "id" ? "Memuat daftar soal" : "Loading question list"}>
            <ReviewBreadcrumb week={requestedWeek || undefined} language={language} onOverview={navigateToOverview} />
            <div className="h-10 w-56 animate-pulse rounded-lg bg-[#ccbab0]/20" />
            <div className="mt-3 h-5 w-80 max-w-full animate-pulse rounded bg-[#ccbab0]/15" />
            <div className="mt-8 h-28 animate-pulse rounded-xl bg-[#ccbab0]/20" />
            <div className="mt-5 h-72 animate-pulse rounded-xl bg-[#ccbab0]/15" />
          </div>
        ) : (
          <WeekQuestionList
            key={selectedWeek}
            week={selectedWeek}
            questions={questions}
            language={language}
            questionCounts={questionCounts}
            reviewedQuestionIds={reviewedQuestionIds}
            onBack={navigateToOverview}
            onSelectQuestion={openQuestion}
          />
        )}
      </div>
    );
  }

  const detailQuestion = activeQuestion ?? answerQuestion;
  const detailLabel = detailQuestion
    ? getMaterialQuestionIdentifier(detailQuestion)
    : navigation.item;

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
                index={activeIndex}
                itemTotal={activeQueue.length}
                questionReviewCount={activeQuestionCount}
                answers={answers}
                reviewedAnswerIds={reviewedAnswerIds}
                answerTaskById={answerTaskById}
                misconceptions={misconceptions}
                locked={activeQuestionLocked}
                progressUnavailable={!navigationReady || !activeQuestion.sourceVersion}
                reviewedByMe={activeQuestionReviewedByMe}
                globallyComplete={activeQuestionCount >= QUESTION_REVIEWED_THRESHOLD}
                submittedReview={activeQuestionReview}
                submittedReviewLoading={metadataLoading}
                submittedReviewError={loadError}
                isAdmin={isAdmin}
                onPrevious={() => selectOffset(-1)}
                onNext={() => selectOffset(1)}
                onViewHistory={viewHistory}
                onDirtyChange={setQuestionDirty}
                onReviewAnswer={(answerId) => {
                  const target = resolveAnswerDeepLink(
                    answerId,
                    questions,
                    orderedAnswers,
                    reviewedAnswerIds,
                  );
                  if (target) changeNavigation(target);
                }}
                onSelectMisconception={(misconceptionId) =>
                  navigate(`/miskonsepsi/${misconceptionId}`)
                }
                onDelete={handleQuestionDelete}
                onSubmit={handleQuestionSubmit}
              />
            ) : activeAnswer && answerQuestion ? (
              <AnswerValidationWorkspace
                key={activeAnswer.id}
                task={answerTaskById.get(activeAnswer.id)}
                question={answerQuestion}
                answer={activeAnswer}
                siblingAnswerIds={(activeQueue as StudentAnswer[]).map(({ id }) => id)}
                activeIndex={activeIndex}
                misconceptions={misconceptions}
                locked={activeAnswerLocked}
                progressUnavailable={!navigationReady || !activeAnswer.sourceVersion}
                answerReviewCount={activeAnswerCount}
                reviewedByMe={activeAnswerReviewedByMe}
                globallyComplete={activeAnswerCount >= QUESTION_REVIEWED_THRESHOLD}
                submittedReview={activeAnswerReview}
                isAdmin={isAdmin}
                onViewHistory={viewHistory}
                onDirtyChange={setAnswerDirty}
                onSelectAnswer={(answerId) => changeNavigation({ item: answerId })}
                onBackToQuestion={() =>
                  changeNavigation({
                    task: "question",
                    status: reviewedQuestionIds.includes(answerQuestion.id)
                      ? "reviewed"
                      : "unreviewed",
                    type: "mp",
                    item: answerQuestion.id,
                  })
                }
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
