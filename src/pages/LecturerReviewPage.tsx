import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  ListFilter,
  LockKeyhole,
  Users,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AnswerStatusBar } from "../components/review/AnswerStatusBar";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { MisconceptionPicker } from "../components/review/MisconceptionPicker";
import {
  AdminAnswerContentEditor,
  AdminQuestionContentEditor,
} from "../components/review/AdminContentEditor";
import { ReviewQuestionFilters } from "../components/review/ReviewQuestionFilters";
import { MpQuestionQuizNavigator } from "../components/review/MpQuestionQuizNavigator";
import { useCategories } from "../hooks/useCategories";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { useQuestions } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { useStudents } from "../hooks/useStudents";
import { useReviewTasks } from "../hooks/useReviewTasks";
import { useMisconceptions } from "../hooks/useMisconceptions";
import type {
  AnswerReviewValues,
  Language,
  Misconception,
  Question,
  QuestionReviewValues,
  ReviewTask,
  StudentAnswer,
} from "../types";
import { cn } from "../utils/cn";
import { getQuestionReference } from "../utils/questionReference";
import { getQuestionOptionMisconceptionIds } from "../utils/questionMetadata";
import { prioritizeMisconceptions, sortReviewTasks } from "../utils/reviewPriority";
import { t } from "../utils/translation";
import { misconceptionLabel } from "../utils/misconceptionLabel";
import {
  getQuestionReviewCounts,
  getAnswerReviewCounts,
  getReviewProgress as getSavedReviewProgress,
  saveAnswerReview,
  saveQuestionReview,
} from "../services/reviewPersistenceRepository";
import { PseudocodeBlock } from "../components/review/PseudocodeBlock";
import { PsAnswerEvidenceWorkspace } from "../components/review/PsAnswerEvidenceWorkspace";
import {
  classifyReviewItems,
  filterEligibleAnswerReviewCounts,
  filterEligibleAnswerReviewIds,
  getAnswerWorkspaceForQuestion,
  getReviewProgress,
  isAnswerReviewEligible,
  resolveAnswerSelection,
  type ReviewWorkspace,
} from "../utils/reviewWorkspace";
import {
  REVIEW_SESSION_STORAGE_KEY,
  createDefaultReviewSessionState,
  getAnswersForQuestion,
  getPairedWorkspace,
  normalizeReviewSessionState,
  parseReviewSessionState,
  selectAfterAnswerReview,
  selectAfterQuestionReview,
  getReviewWorkspaceAvailability,
  selectLinkedAnswerId,
  selectAvailableReviewWorkspace,
  selectStoredWorkspaceItemId,
  serializeReviewSessionState,
  setActiveReviewItemId,
  type ReviewSessionState,
} from "../utils/reviewLinking";
import {
  DEFAULT_REVIEW_QUESTION_FILTERS,
  QUESTION_REVIEWED_THRESHOLD,
  REVIEW_FILTER_ALL,
  filterReviewQuestions,
  getActiveReviewQuestionFilterCount,
  type ReviewQuestionFilters as ReviewQuestionFilterValues,
} from "../utils/reviewQuestionFilters";
import {
  buildMpQuestionNavigatorItems,
  getNextMpWeekKey,
  groupMpQuestionsByWeek,
  isMpWeekComplete,
  isMpWeekGloballyComplete,
  resolveMpActiveWeek,
  selectValidMpQuestionId,
  shouldWarnForMpQuestionNavigation,
} from "../utils/mpQuestionNavigator";
import {
  REVIEW_QUESTION_FILTER_SESSION_KEY,
  createDefaultReviewQuestionFilterSession,
  parseReviewQuestionFilterSession,
  serializeReviewQuestionFilterSession,
  type ReviewQuestionFilterSessionState,
} from "../utils/reviewQuestionFilterSession";
import {
  buildAnswerReviewValues,
  buildQuestionReviewValues,
  canSubmitMisconceptionReview,
  getAdditionalMisconceptionCandidates,
  getQuestionRemovalProposalIds,
  initialMisconceptionReviewFormState,
  isMisconceptionReviewFormDirty,
  misconceptionReviewFormReducer,
} from "../utils/reviewMisconceptionForm";

function PresenceToggle({
  value,
  onChange,
  language,
  label,
  yesDisabled = false,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  language: Language;
  label: string;
  yesDisabled?: boolean;
}) {
  const options = [
    { value: false, label: language === "id" ? "Tidak ada" : "None" },
    { value: true, label: language === "id" ? "Ada" : "Yes" },
  ] as const;

  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-neutral p-1" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={option.value && yesDisabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-9 cursor-pointer rounded px-3 py-2 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40",
            value === option.value
              ? option.value
                ? "bg-white text-brand shadow-[0_2px_8px_rgba(30,41,59,0.08)]"
                : "bg-white text-navy-deep shadow-[0_2px_8px_rgba(30,41,59,0.08)]"
              : "text-muted hover:bg-white/60 hover:text-navy-deep",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function WorkspaceToolbar({
  workspace,
  label,
  itemLabel,
  reviewed,
  index,
  total,
  itemTotal,
  language,
  parentQuestion,
  onPrevious,
  onNext,
}: {
  workspace: ReviewWorkspace;
  label: string;
  itemLabel: string;
  reviewed: number;
  index: number;
  total: number;
  itemTotal: number;
  language: Language;
  parentQuestion?: Question;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const answerWorkspace = workspace.startsWith("answer");
  const parentReference = parentQuestion
    ? /^q/i.test(parentQuestion.number)
      ? parentQuestion.number
      : `Q${parentQuestion.number || parentQuestion.id}`
    : "";

  return (
    <section className="mb-4 rounded-lg border border-border bg-white px-4 py-4 sm:px-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-navy-deep">{label}</h2>
          <p className="mt-1 text-sm text-muted">
            {language === "id"
              ? `${reviewed} dari ${total} telah direview`
              : `${reviewed} of ${total} reviewed`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!answerWorkspace && (
            <span className="mr-auto text-xs font-semibold tabular-nums text-muted sm:mr-2">
              {itemLabel} {index + 1} {language === "id" ? "dari" : "of"}{" "}
              {itemTotal}
            </span>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={onPrevious}
            disabled={index <= 0}
          >
            {language === "id" ? "Sebelumnya" : "Previous"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onNext}
            disabled={index >= itemTotal - 1}
          >
            {language === "id" ? "Berikutnya" : "Next"}
          </Button>
        </div>
      </div>

      {answerWorkspace && parentQuestion && (
        <div className="mt-3 flex min-w-0 flex-col gap-1 rounded-md bg-neutral px-3 py-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="break-words text-xs font-bold text-navy-deep">
              {language === "id"
                ? `Jawaban terkait untuk ${parentReference}`
                : `Related answers for ${parentReference}`}
            </p>
            <p className="mt-0.5 line-clamp-2 break-words text-xs leading-5 text-muted">
              {t(parentQuestion.prompt, language)}
            </p>
          </div>
          <p className="shrink-0 text-xs font-semibold tabular-nums text-muted">
            {itemLabel} {index + 1} {language === "id" ? "dari" : "of"}{" "}
            {itemTotal}
          </p>
        </div>
      )}
    </section>
  );
}

function orderAnswersByTaskPriority(
  answers: StudentAnswer[],
  tasks: ReviewTask[],
): StudentAnswer[] {
  const rank = new Map(
    sortReviewTasks(tasks).map((task, index) => [task.answerCaseId, index]),
  );

  return [...answers].sort(
    (a, b) =>
      (rank.get(a.id) ?? rank.size) - (rank.get(b.id) ?? rank.size),
  );
}

function readStoredReviewSession(): ReviewSessionState {
  if (typeof window === "undefined") return createDefaultReviewSessionState();

  try {
    return parseReviewSessionState(
      window.sessionStorage.getItem(REVIEW_SESSION_STORAGE_KEY),
    );
  } catch {
    return createDefaultReviewSessionState();
  }
}

function readStoredQuestionFilters(): ReviewQuestionFilterSessionState {
  if (typeof window === "undefined") {
    return createDefaultReviewQuestionFilterSession();
  }

  try {
    return parseReviewQuestionFilterSession(
      window.sessionStorage.getItem(REVIEW_QUESTION_FILTER_SESSION_KEY),
    );
  } catch {
    return createDefaultReviewQuestionFilterSession();
  }
}

export function LecturerReviewPage({
  initialAnswerId,
}: {
  initialAnswerId?: string;
} = {}) {
  const { language } = useLanguage();
  const { user, isAdmin } = useLecturerAuth();
  const navigate = useNavigate();
  const { categories, loading: categoriesLoading } = useCategories();
  const { questions, loading: questionsLoading } = useQuestions();
  const {
    answers,
    loading: answersLoading,
    error: answersError,
  } = useAllStudentAnswers();
  const { students, loading: studentsLoading } = useStudents();
  const { misconceptions, loading: misconceptionsLoading } = useMisconceptions();
  const { tasks: answerTasks, loading: reviewTasksLoading } = useReviewTasks();
  const [reviewSession, setReviewSession] = useState<ReviewSessionState>(
    readStoredReviewSession,
  );
  const [reviewedQuestionIds, setReviewedQuestionIds] = useState<string[]>([]);
  const [savedReviewedAnswerIds, setReviewedAnswerIds] = useState<string[]>([]);
  const [handledInitialAnswerId, setHandledInitialAnswerId] = useState("");
  const [questionReviewCounts, setQuestionReviewCounts] = useState<
    Map<string, number>
  >(new Map());
  const [answerReviewCounts, setAnswerReviewCounts] = useState<
    Map<string, number>
  >(new Map());
  const [questionFilters, setQuestionFilters] =
    useState<ReviewQuestionFilterSessionState>(readStoredQuestionFilters);
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [mpWeekResolved, setMpWeekResolved] = useState(false);
  const [mpQuestionReviewDirty, setMpQuestionReviewDirty] = useState(false);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [questionCountsLoading, setQuestionCountsLoading] = useState(true);
  const [questionCountsError, setQuestionCountsError] = useState("");
  const [questionCountsLoaded, setQuestionCountsLoaded] = useState(false);
  const [answerCountsLoading, setAnswerCountsLoading] = useState(true);
  const [answerCountsError, setAnswerCountsError] = useState("");
  const [answerCountsLoaded, setAnswerCountsLoaded] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      window.sessionStorage.setItem(
        REVIEW_QUESTION_FILTER_SESSION_KEY,
        serializeReviewQuestionFilterSession(questionFilters),
      );
    } catch {
      // sessionStorage can be unavailable in restricted browser contexts.
    }
  }, [questionFilters]);

  useEffect(() => {
    if (!mpQuestionReviewDirty || typeof window === "undefined") return;

    const preventUnsavedExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnsavedExit);
    return () => window.removeEventListener("beforeunload", preventUnsavedExit);
  }, [mpQuestionReviewDirty]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setReviewedQuestionIds([]);
      setReviewedAnswerIds([]);
      setQuestionReviewCounts(new Map());
      setAnswerReviewCounts(new Map());
      setProgressLoading(false);
      setProgressError("");
      setProgressLoaded(false);
      setQuestionCountsLoading(false);
      setQuestionCountsError("");
      setQuestionCountsLoaded(false);
      setAnswerCountsLoading(false);
      setAnswerCountsError("");
      setAnswerCountsLoaded(false);
      return () => {
        active = false;
      };
    }

    const loadPersonalProgress = async () => {
      setProgressLoading(true);
      setProgressError("");
      setProgressLoaded(false);

      try {
        const progress = await getSavedReviewProgress();
        if (!active) return;
        setReviewedQuestionIds(progress.questionIds);
        setReviewedAnswerIds(progress.answerIds);
        setProgressLoaded(true);
      } catch (error) {
        if (!active) return;
        console.error("[Progmiscon] Progres review gagal dimuat", error);
        setProgressError(
          error instanceof Error
            ? error.message
            : "Progres review belum dapat dimuat.",
        );
      } finally {
        if (active) setProgressLoading(false);
      }
    };

    const loadQuestionCounts = async () => {
      setQuestionCountsLoading(true);
      setQuestionCountsError("");
      setQuestionCountsLoaded(false);
      setQuestionReviewCounts(new Map());

      try {
        const globalCounts = await getQuestionReviewCounts();
        if (!active) return;
        setQuestionReviewCounts(
          new Map(
            globalCounts.map(({ questionId, reviewCount }) => [
              questionId,
              reviewCount,
            ]),
          ),
        );
        setQuestionCountsLoaded(true);
      } catch (error) {
        if (!active) return;
        console.error(
          "[Progmiscon] Status agregat review soal gagal dimuat",
          error,
        );
        setQuestionCountsError(
          "Status agregat review belum dapat dimuat.",
        );
      } finally {
        if (active) setQuestionCountsLoading(false);
      }
    };

    const loadAnswerCounts = async () => {
      setAnswerCountsLoading(true);
      setAnswerCountsError("");
      setAnswerCountsLoaded(false);
      setAnswerReviewCounts(new Map());

      try {
        const globalCounts = await getAnswerReviewCounts();
        if (!active) return;
        setAnswerReviewCounts(
          new Map(
            globalCounts.map(({ answerId, reviewCount }) => [
              answerId,
              reviewCount,
            ]),
          ),
        );
        setAnswerCountsLoaded(true);
      } catch (error) {
        if (!active) return;
        console.error(
          "[Progmiscon] Status agregat review jawaban gagal dimuat",
          error,
        );
        setAnswerCountsError("Status agregat review jawaban belum dapat dimuat.");
      } finally {
        if (active) setAnswerCountsLoading(false);
      }
    };

    void loadPersonalProgress();
    void loadQuestionCounts();
    void loadAnswerCounts();

    return () => {
      active = false;
    };
  }, [user]);

  const { items: classifiedItems, questionById } = useMemo(
    () => classifyReviewItems(questions, answers),
    [answers, questions],
  );
  const reviewedAnswerIds = useMemo(
    () =>
      filterEligibleAnswerReviewIds(
        savedReviewedAnswerIds,
        answers,
        questionById,
      ),
    [answers, questionById, savedReviewedAnswerIds],
  );
  const eligibleAnswerReviewCounts = useMemo(
    () =>
      filterEligibleAnswerReviewCounts(
        answerReviewCounts,
        answers,
        questionById,
      ),
    [answerReviewCounts, answers, questionById],
  );
  const allWorkspaceItems = useMemo(
    () => ({
      "question-ps": classifiedItems["question-ps"],
      "answer-ps": orderAnswersByTaskPriority(
        classifiedItems["answer-ps"],
        answerTasks,
      ),
      "question-mp": classifiedItems["question-mp"],
      "answer-mp": orderAnswersByTaskPriority(
        classifiedItems["answer-mp"],
        answerTasks,
      ),
    }),
    [answerTasks, classifiedItems],
  );
  const mpQuestionWeeks = useMemo(
    () => groupMpQuestionsByWeek(allWorkspaceItems["question-mp"]),
    [allWorkspaceItems],
  );
  const restoredMpQuestionId = reviewSession.activeItemIds["question-mp"];
  const activeMpWeekKey = resolveMpActiveWeek(
    mpQuestionWeeks,
    questionFilters.mp.week,
    mpWeekResolved ? undefined : restoredMpQuestionId,
  );
  const activeMpWeekQuestions = useMemo(
    () =>
      mpQuestionWeeks.find((week) => week.key === activeMpWeekKey)?.questions ??
      [],
    [activeMpWeekKey, mpQuestionWeeks],
  );

  useEffect(() => {
    if (questionsLoading || mpWeekResolved) return;

    setQuestionFilters((current) => ({
      ...current,
      mp: {
        ...current.mp,
        week: activeMpWeekKey ?? REVIEW_FILTER_ALL,
      },
    }));
    setMpWeekResolved(true);
  }, [activeMpWeekKey, mpWeekResolved, questionsLoading]);

  const effectiveQuestionFilters = useMemo<ReviewQuestionFilterSessionState>(
    () => ({
      ps: questionCountsLoaded
        ? questionFilters.ps
        : { ...questionFilters.ps, status: REVIEW_FILTER_ALL },
      mp: questionCountsLoaded
        ? questionFilters.mp
        : { ...questionFilters.mp, status: REVIEW_FILTER_ALL },
    }),
    [questionCountsLoaded, questionFilters],
  );
  const matchingMpWeekQuestions = useMemo(
    () =>
      filterReviewQuestions(
        activeMpWeekQuestions,
        questionReviewCounts,
        {
          ...effectiveQuestionFilters.mp,
          week: REVIEW_FILTER_ALL,
        },
      ),
    [
      activeMpWeekQuestions,
      effectiveQuestionFilters.mp,
      questionReviewCounts,
    ],
  );
  const navigableWorkspaceItems = useMemo(
    () => ({
      "question-ps": filterReviewQuestions(
        allWorkspaceItems["question-ps"],
        questionReviewCounts,
        effectiveQuestionFilters.ps,
      ),
      "answer-ps": allWorkspaceItems["answer-ps"],
      "question-mp": matchingMpWeekQuestions,
      "answer-mp": allWorkspaceItems["answer-mp"],
    }),
    [
      allWorkspaceItems,
      effectiveQuestionFilters.ps,
      matchingMpWeekQuestions,
      questionReviewCounts,
    ],
  );
  const answerTaskById = useMemo(
    () => new Map(answerTasks.map((task) => [task.answerCaseId, task])),
    [answerTasks],
  );
  const normalizedReviewSession = useMemo(
    () =>
      normalizeReviewSessionState(
        reviewSession,
        navigableWorkspaceItems,
        questionById,
        reviewedQuestionIds,
        reviewedAnswerIds,
      ),
    [
      questionById,
      reviewSession,
      reviewedAnswerIds,
      reviewedQuestionIds,
      navigableWorkspaceItems,
    ],
  );

  useEffect(() => {
    if (
      questionsLoading ||
      answersLoading ||
      reviewTasksLoading ||
      progressLoading ||
      typeof window === "undefined"
    ) {
      return;
    }

    try {
      window.sessionStorage.setItem(
        REVIEW_SESSION_STORAGE_KEY,
        serializeReviewSessionState(normalizedReviewSession),
      );
    } catch {
      // sessionStorage can be unavailable in restricted browser contexts.
    }
  }, [
    answersLoading,
    normalizedReviewSession,
    progressLoading,
    questionsLoading,
    reviewTasksLoading,
  ]);

  const { workspace, activeItemIds, activeParentQuestionIds } =
    normalizedReviewSession;
  const workspaceProgress = {
    "question-ps": getReviewProgress(
      allWorkspaceItems["question-ps"],
      reviewedQuestionIds,
    ),
    "answer-ps": { reviewed: 0, total: 0 },
    "question-mp": getReviewProgress(
      allWorkspaceItems["question-mp"],
      reviewedQuestionIds,
    ),
    "answer-mp": getReviewProgress(
      allWorkspaceItems["answer-mp"],
      reviewedAnswerIds,
    ),
  };
  const activeParentKind = workspace.endsWith("ps") ? "ps" : "mp";
  const activeParentQuestionId =
    activeParentQuestionIds[activeParentKind];
  const activeParentQuestion = activeParentQuestionId
    ? questionById.get(activeParentQuestionId)
    : undefined;
  const activeItems =
    workspace.startsWith("answer") && activeParentQuestion
      ? getAnswersForQuestion(
          activeParentQuestion.id,
          navigableWorkspaceItems[workspace] as StudentAnswer[],
        )
      : navigableWorkspaceItems[workspace];
  const activeReviewedIds = workspace.startsWith("question")
    ? reviewedQuestionIds
    : reviewedAnswerIds;
  const resolvedActiveItemId = selectStoredWorkspaceItemId(
    activeItems,
    activeItemIds[workspace],
    activeReviewedIds,
  );
  const activeIndex = activeItems.findIndex(
    (item) => item.id === resolvedActiveItemId,
  );
  const activeQuestion =
    workspace === "question-ps" || workspace === "question-mp"
      ? (activeItems[activeIndex] as Question | undefined)
      : undefined;
  const activeAnswer =
    workspace === "answer-ps" || workspace === "answer-mp"
      ? (activeItems[activeIndex] as StudentAnswer | undefined)
      : undefined;
  const activeQuestionReviewedByMe = activeQuestion
    ? reviewedQuestionIds.includes(activeQuestion.id)
    : false;
  const activeQuestionGloballyComplete = activeQuestion
    ? questionCountsLoaded &&
      (questionReviewCounts.get(activeQuestion.id) ?? 0) >=
        QUESTION_REVIEWED_THRESHOLD
    : false;
  const activeQuestionLocked =
    activeQuestionReviewedByMe || activeQuestionGloballyComplete;
  const matchingMpQuestionIds = useMemo(
    () => new Set(matchingMpWeekQuestions.map((question) => question.id)),
    [matchingMpWeekQuestions],
  );
  const mpNavigatorItems = useMemo(
    () =>
      buildMpQuestionNavigatorItems(
        activeMpWeekQuestions,
        matchingMpQuestionIds,
        questionReviewCounts,
        reviewedQuestionIds,
        workspace === "question-mp" ? activeQuestion?.id : undefined,
      ),
    [
      activeMpWeekQuestions,
      activeQuestion?.id,
      matchingMpQuestionIds,
      questionReviewCounts,
      reviewedQuestionIds,
      workspace,
    ],
  );
  const mpWeekComplete =
    progressLoaded &&
    isMpWeekComplete(activeMpWeekQuestions, reviewedQuestionIds);
  const mpWeekGloballyComplete =
    questionCountsLoaded &&
    isMpWeekGloballyComplete(
      activeMpWeekQuestions,
      questionReviewCounts,
      QUESTION_REVIEWED_THRESHOLD,
    );
  const nextMpWeekKey = getNextMpWeekKey(
    mpQuestionWeeks,
    activeMpWeekKey,
  );
  const activeAnswerReviewedByMe = activeAnswer
    ? reviewedAnswerIds.includes(activeAnswer.id)
    : false;
  const activeAnswerGloballyComplete = activeAnswer
    ? isAnswerReviewEligible(questionById.get(activeAnswer.questionId)) &&
      answerCountsLoaded &&
      (eligibleAnswerReviewCounts.get(activeAnswer.id) ?? 0) >=
        QUESTION_REVIEWED_THRESHOLD
    : false;
  const activeAnswerLocked =
    isAnswerReviewEligible(
      activeAnswer ? questionById.get(activeAnswer.questionId) : undefined,
    ) &&
    (activeAnswerReviewedByMe || activeAnswerGloballyComplete);
  const answerQuestion = activeAnswer
    ? activeParentQuestion?.id === activeAnswer.questionId
      ? activeParentQuestion
      : questionById.get(activeAnswer.questionId)
    : undefined;
  const answerTask = activeAnswer
    ? answerTaskById.get(activeAnswer.id)
    : undefined;
  const activeAnswerWorkspace =
    activeParentKind === "ps" ? "answer-ps" : "answer-mp";
  const activeContextQuestionId =
    activeQuestion?.id ?? activeParentQuestionId;
  const hasLinkedAnswers = activeContextQuestionId
    ? getAnswersForQuestion(
        activeContextQuestionId,
        allWorkspaceItems[activeAnswerWorkspace],
      ).length > 0
    : false;
  const workspaceAvailability = getReviewWorkspaceAvailability(
    workspace,
    hasLinkedAnswers,
  );
  const tabs: { id: ReviewWorkspace; label: string }[] = [
    {
      id: "question-ps",
      label: language === "id" ? "Soal PS" : "PS Questions",
    },
    {
      id: "answer-ps",
      label: language === "id" ? "Jawaban PS" : "PS Answers",
    },
    {
      id: "question-mp",
      label: language === "id" ? "Soal MP" : "MP Questions",
    },
    {
      id: "answer-mp",
      label: language === "id" ? "Jawaban MP" : "MP Answers",
    },
  ];
  const activeTab = tabs.find((tab) => tab.id === workspace)!;
  const itemLabel =
    workspace.startsWith("question")
      ? language === "id"
        ? "Soal"
        : "Question"
      : language === "id"
        ? "Jawaban"
        : "Answer";
  const emptyMessages: Record<ReviewWorkspace, string> = {
    "question-ps":
      language === "id" ? "Belum ada soal PS" : "There are no PS questions yet",
    "answer-ps":
      language === "id"
        ? "Belum ada evidence jawaban untuk soal ini"
        : "There is no answer evidence for this question yet",
    "question-mp":
      language === "id" ? "Belum ada soal MP" : "There are no MP questions yet",
    "answer-mp":
      language === "id" ? "Belum ada jawaban MP" : "There are no MP answers yet",
  };
  const openWorkspaceItem = useCallback(
    (
      nextWorkspace: ReviewWorkspace,
      itemId: string | undefined,
      parentQuestionId?: string,
    ) => {
      const kind = nextWorkspace.endsWith("ps") ? "ps" : "mp";
      let nextActiveItemIds = setActiveReviewItemId(
        activeItemIds,
        nextWorkspace,
        itemId,
      );
      const nextParentQuestionIds = { ...activeParentQuestionIds };

      if (nextWorkspace.startsWith("question")) {
        nextParentQuestionIds[kind] = itemId;
        nextActiveItemIds = setActiveReviewItemId(
          nextActiveItemIds,
          getPairedWorkspace(nextWorkspace),
          itemId
            ? selectLinkedAnswerId(
                itemId,
                allWorkspaceItems[
                  getPairedWorkspace(nextWorkspace)
                ] as StudentAnswer[],
                reviewedAnswerIds,
              )
            : undefined,
        );
      } else {
        const selectedAnswer = (
          allWorkspaceItems[nextWorkspace] as StudentAnswer[]
        ).find((answer) => answer.id === itemId);
        nextParentQuestionIds[kind] =
          parentQuestionId ?? selectedAnswer?.questionId;
      }

      setReviewSession({
        workspace: nextWorkspace,
        activeItemIds: nextActiveItemIds,
        activeParentQuestionIds: nextParentQuestionIds,
      });
    },
    [
      activeItemIds,
      activeParentQuestionIds,
      allWorkspaceItems,
      reviewedAnswerIds,
    ],
  );
  const confirmMpQuestionNavigation = useCallback(
    (nextWorkspace: ReviewWorkspace, nextQuestionId: string | undefined) => {
      if (
        !shouldWarnForMpQuestionNavigation(
          mpQuestionReviewDirty,
          workspace,
          activeQuestion?.id,
          nextWorkspace,
          nextQuestionId,
        )
      ) {
        return true;
      }

      return window.confirm(
        language === "id"
          ? "Review pada soal ini belum disimpan. Tetap pindah soal?"
          : "This question review has not been saved. Continue to another question?",
      );
    },
    [activeQuestion?.id, language, mpQuestionReviewDirty, workspace],
  );
  const requestOpenWorkspaceItem = useCallback(
    (
      nextWorkspace: ReviewWorkspace,
      itemId: string | undefined,
      parentQuestionId?: string,
    ) => {
      if (!confirmMpQuestionNavigation(nextWorkspace, itemId)) return false;
      setMpQuestionReviewDirty(false);
      openWorkspaceItem(nextWorkspace, itemId, parentQuestionId);
      return true;
    },
    [confirmMpQuestionNavigation, openWorkspaceItem],
  );
  const selectWorkspace = (nextWorkspace: ReviewWorkspace) => {
    if (
      selectAvailableReviewWorkspace(
        workspace,
        nextWorkspace,
        workspaceAvailability,
      ) !== nextWorkspace
    ) {
      return;
    }

    const nextItems = navigableWorkspaceItems[nextWorkspace];
    const reviewedIds = nextWorkspace.startsWith("question")
      ? reviewedQuestionIds
      : reviewedAnswerIds;
    let nextItemId = selectStoredWorkspaceItemId(
      nextItems,
      activeItemIds[nextWorkspace],
      reviewedIds,
    );
    let nextParentQuestionId =
      activeParentQuestionIds[nextWorkspace.endsWith("ps") ? "ps" : "mp"];

    if (getPairedWorkspace(workspace) === nextWorkspace) {
      if (
        workspace.startsWith("question") &&
        nextWorkspace.startsWith("answer") &&
        activeQuestion
      ) {
        const linkedAnswerId = selectLinkedAnswerId(
          activeQuestion.id,
          nextItems as StudentAnswer[],
          reviewedAnswerIds,
        );
        nextItemId = linkedAnswerId;
        nextParentQuestionId = activeQuestion.id;
      } else if (
        workspace.startsWith("answer") &&
        nextWorkspace.startsWith("question")
      ) {
        nextItemId = nextItems.some(
          (question) => question.id === activeParentQuestionId,
        )
          ? activeParentQuestionId
          : nextItemId;
      }
    } else if (nextWorkspace.startsWith("answer") && !nextItemId) {
      nextItemId = selectStoredWorkspaceItemId(
        nextItems,
        undefined,
        reviewedAnswerIds,
      );
      nextParentQuestionId = (nextItems as StudentAnswer[]).find(
        (answer) => answer.id === nextItemId,
      )?.questionId;
    }

    requestOpenWorkspaceItem(
      nextWorkspace,
      nextItemId,
      nextParentQuestionId,
    );
  };
  const selectOffset = (offset: number) => {
    requestOpenWorkspaceItem(
      workspace,
      activeItems[activeIndex + offset]?.id,
      activeParentQuestionId,
    );
  };

  useEffect(() => {
    if (
      !initialAnswerId ||
      handledInitialAnswerId === initialAnswerId ||
      questionsLoading ||
      answersLoading
    ) {
      return;
    }

    const answer = answers.find((item) => item.id === initialAnswerId);
    const question = answer ? questionById.get(answer.questionId) : undefined;
    setHandledInitialAnswerId(initialAnswerId);

    if (!answer || !question) {
      navigate("/review", { replace: true });
      return;
    }

    openWorkspaceItem(
      getAnswerWorkspaceForQuestion(question),
      answer.id,
      question.id,
    );
  }, [
    answers,
    answersLoading,
    handledInitialAnswerId,
    initialAnswerId,
    navigate,
    openWorkspaceItem,
    questionById,
    questionsLoading,
  ]);

  const progress = workspaceProgress[workspace];
  const questionWorkspace =
    workspace === "question-ps" || workspace === "question-mp";
  const allActiveQuestionItems = questionWorkspace
    ? allWorkspaceItems[workspace]
    : [];
  const noFilteredQuestions =
    questionWorkspace &&
    allActiveQuestionItems.length > 0 &&
    activeItems.length === 0;
  const hasActiveItem =
    activeIndex >= 0 &&
    (activeQuestion !== undefined ||
      (activeAnswer !== undefined && answerQuestion !== undefined));
  const activePsEvidence =
    workspace === "answer-ps" && activeParentQuestion
      ? getAnswersForQuestion(
          activeParentQuestion.id,
          allWorkspaceItems["answer-ps"],
        )
      : [];
  const loading =
    questionsLoading ||
    answersLoading ||
    categoriesLoading ||
    misconceptionsLoading ||
    reviewTasksLoading ||
    progressLoading ||
    (workspace === "answer-mp" && answerCountsLoading) ||
    (workspace === "answer-ps" && studentsLoading);
  const filterPanelId = "review-question-filter-panel";
  const activeFilterCount = questionWorkspace
    ? getActiveReviewQuestionFilterCount(
        questionFilters[activeParentKind],
        workspace === "question-ps",
      )
    : 0;
  const filterPanelExpanded =
    questionWorkspace && !loading && filterPanelOpen;
  const currentPosition = activeIndex >= 0 ? activeIndex + 1 : 0;
  const workspaceSummary =
    questionWorkspace
      ? language === "id"
        ? `${progress.reviewed} dari ${progress.total} soal sudah Anda review`
        : `You have reviewed ${progress.reviewed} of ${progress.total} questions`
      : workspace === "answer-ps"
        ? `Evidence ${currentPosition} ${language === "id" ? "dari" : "of"} ${activeItems.length}`
        : language === "id"
          ? `Jawaban ${currentPosition} dari ${activeItems.length}`
          : `Answer ${currentPosition} of ${activeItems.length}`;
  const filterButtonLabel =
    activeFilterCount > 0
      ? language === "id"
        ? `Filter, ${activeFilterCount} filter aktif`
        : `Filter, ${activeFilterCount} active filters`
      : "Filter";
  const setActiveQuestionFilters = (
    filters: ReviewQuestionFilterValues,
  ) => {
    if (activeParentKind === "mp") {
      const nextFilters = {
        ...filters,
        week: activeMpWeekKey ?? filters.week,
      };
      const nextMatchingQuestions = filterReviewQuestions(
        activeMpWeekQuestions,
        questionReviewCounts,
        {
          ...(questionCountsLoaded
            ? nextFilters
            : { ...nextFilters, status: REVIEW_FILTER_ALL }),
          week: REVIEW_FILTER_ALL,
        },
      );
      const nextQuestionId = selectValidMpQuestionId(
        activeMpWeekQuestions,
        new Set(nextMatchingQuestions.map((question) => question.id)),
        activeQuestion?.id,
      );

      if (
        workspace === "question-mp" &&
        !confirmMpQuestionNavigation("question-mp", nextQuestionId)
      ) {
        return;
      }

      setQuestionFilters((current) => ({
        ...current,
        mp: nextFilters,
      }));
      if (
        workspace === "question-mp" &&
        nextQuestionId !== activeQuestion?.id
      ) {
        setMpQuestionReviewDirty(false);
        openWorkspaceItem("question-mp", nextQuestionId);
      }
      return;
    }

    setQuestionFilters((current) => ({
      ...current,
      [activeParentKind]: filters,
    }));
  };
  const selectMpWeek = (weekKey: string) => {
    if (weekKey === activeMpWeekKey) return;

    const weekQuestions =
      mpQuestionWeeks.find((week) => week.key === weekKey)?.questions ?? [];
    const nextFilters = { ...questionFilters.mp, week: weekKey };
    const nextMatchingQuestions = filterReviewQuestions(
      weekQuestions,
      questionReviewCounts,
      {
        ...(questionCountsLoaded
          ? nextFilters
          : { ...nextFilters, status: REVIEW_FILTER_ALL }),
        week: REVIEW_FILTER_ALL,
      },
    );
    const nextQuestionId = selectValidMpQuestionId(
      weekQuestions,
      new Set(nextMatchingQuestions.map((question) => question.id)),
    );

    if (!confirmMpQuestionNavigation("question-mp", nextQuestionId)) return;
    setMpQuestionReviewDirty(false);
    setQuestionFilters((current) => ({
      ...current,
      mp: { ...current.mp, week: weekKey },
    }));
    openWorkspaceItem("question-mp", nextQuestionId);
  };
  const viewMyReviewHistory = () => navigate("/review/riwayat");

  return (
    <div className="mx-auto max-w-6xl">
      {progressError && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
        >
          {progressError}
        </p>
      )}

      {answersError && workspace !== "answer-ps" && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
        >
          {language === "id"
            ? "Evidence jawaban belum dapat dimuat."
            : "Answer evidence could not be loaded."}
        </p>
      )}

      {questionCountsError && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning"
        >
          {questionCountsError}
        </p>
      )}

      {answerCountsError && workspace === "answer-mp" && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning"
        >
          {answerCountsError}
        </p>
      )}

      <div className="review-workspace-toolbar">
        <div
          className="review-workspace-tabs segmented-control"
          role="tablist"
          aria-label={language === "id" ? "Workspace review" : "Review workspace"}
        >
          {(["ps", "mp"] as const).map((kind) => (
            <div
              key={kind}
              role="presentation"
              className="review-workspace-tab-group"
            >
              {tabs
                .filter((tab) => tab.id.endsWith(kind))
                .map((tab) => {
                  const tabProgress = workspaceProgress[tab.id];
                  const disabled = !workspaceAvailability[tab.id];
                  const answerTab = tab.id.startsWith("answer");
                  const noRelatedAnswers =
                    tab.id === activeAnswerWorkspace && !hasLinkedAnswers;
                  const disabledReason = noRelatedAnswers
                    ? language === "id"
                      ? "Belum ada jawaban"
                      : "No answers"
                    : language === "id"
                      ? `Pilih Soal ${kind.toUpperCase()} dahulu`
                      : `Select a ${kind.toUpperCase()} question first`;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={workspace === tab.id}
                      aria-controls="review-workspace-panel"
                      aria-disabled={disabled}
                      aria-label={
                        disabled ? `${tab.label}: ${disabledReason}` : undefined
                      }
                      disabled={disabled}
                      title={disabled ? disabledReason : undefined}
                      onClick={() => selectWorkspace(tab.id)}
                      className={cn(
                        "segmented-tab min-w-0 text-center",
                        answerTab
                          ? "review-answer-tab"
                          : "review-question-tab",
                      )}
                    >
                      <span className="block">{tab.label}</span>
                      {!answerTab && (
                        <span
                          className={cn(
                            "block text-[11px] tabular-nums",
                            workspace === tab.id
                              ? "text-white/80"
                              : "text-muted/75",
                          )}
                        >
                          {tabProgress.reviewed}/{tabProgress.total}
                        </span>
                      )}
                      {disabled && (
                        <span
                          aria-hidden="true"
                          className="review-tab-disabled-status"
                        >
                          <LockKeyhole size={11} strokeWidth={2} />
                          {disabledReason}
                        </span>
                      )}
                    </button>
                  );
                })}
            </div>
          ))}
        </div>

        <div className="review-workspace-toolbar-meta">
          <p
            className="text-sm font-semibold tabular-nums text-muted"
            aria-live="polite"
            aria-busy={loading}
          >
            {loading
              ? language === "id"
                ? "Memuat ringkasan..."
                : "Loading summary..."
              : workspaceSummary}
          </p>
          {questionWorkspace && (
            <Button
              id="review-filter-toggle"
              type="button"
              variant="secondary"
              disabled={loading}
              aria-expanded={filterPanelExpanded}
              aria-controls={filterPanelId}
              aria-label={filterButtonLabel}
              onClick={() => setFilterPanelOpen((open) => !open)}
              className={cn(
                "min-h-10 shrink-0 justify-center",
                activeFilterCount > 0 &&
                  "border-brand/45 bg-brand-soft text-brand hover:border-brand/60 hover:bg-brand-soft",
              )}
            >
              <ListFilter size={16} strokeWidth={2} aria-hidden="true" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span
                  aria-hidden="true"
                  className="inline-flex min-w-5 items-center justify-center rounded bg-brand px-1.5 py-0.5 text-[11px] leading-none text-white"
                >
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}
        </div>
      <section
        id="review-workspace-panel"
        role="tabpanel"
        aria-label={activeTab.label}
        className="review-workspace-panel"
      >
        {filterPanelExpanded && (
          <ReviewQuestionFilters
            questions={
              workspace === "question-mp"
                ? activeMpWeekQuestions
                : (allActiveQuestionItems as Question[])
            }
            categories={categories}
            misconceptions={misconceptions}
            filters={questionFilters[activeParentKind]}
            panelId={filterPanelId}
            statusAvailable={questionCountsLoaded}
            statusLoading={questionCountsLoading}
            statusError={questionCountsError}
            showWeek={workspace !== "question-mp"}
            onChange={setActiveQuestionFilters}
          />
        )}

        {workspace === "question-mp" && !loading && mpQuestionWeeks.length > 0 && (
          <MpQuestionQuizNavigator
            weeks={mpQuestionWeeks}
            activeWeek={activeMpWeekKey}
            items={mpNavigatorItems}
            matchingCount={matchingMpWeekQuestions.length}
            countsAvailable={questionCountsLoaded}
            countsLoading={questionCountsLoading}
            countsError={questionCountsError}
            weekComplete={mpWeekComplete}
            weekGloballyComplete={mpWeekGloballyComplete}
            nextWeek={nextMpWeekKey}
            onSelectWeek={selectMpWeek}
            onSelectQuestion={(questionId) =>
              requestOpenWorkspaceItem("question-mp", questionId)
            }
          />
        )}

        {loading ? (
          <EmptyState
            loading
            message={
              language === "id"
                ? "Memuat tugas validasi..."
                : "Loading validation tasks..."
            }
          />
        ) : noFilteredQuestions ? (
          <div className="academic-panel-quiet flex flex-col items-center justify-center gap-4 px-6 py-10 text-center">
            <p className="max-w-sm text-sm leading-6 text-muted">
              {language === "id"
                ? "Tidak ada soal yang cocok dengan filter aktif."
                : "No questions match the active filters."}
            </p>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setActiveQuestionFilters({
                  ...DEFAULT_REVIEW_QUESTION_FILTERS,
                })
              }
            >
              {language === "id" ? "Reset filter" : "Reset filters"}
            </Button>
          </div>
        ) : workspace === "answer-ps" && activeParentQuestion ? (
          <PsAnswerEvidenceWorkspace
            question={activeParentQuestion}
            answers={activePsEvidence}
            activeAnswerId={activeItemIds["answer-ps"]}
            students={students}
            misconceptions={misconceptions}
            error={
              answersError
                ? language === "id"
                  ? "Evidence jawaban belum dapat dimuat."
                  : "Answer evidence could not be loaded."
                : undefined
            }
            onSelectAnswer={(answerId) =>
              openWorkspaceItem(
                "answer-ps",
                answerId,
                activeParentQuestion.id,
              )
            }
            onBackToQuestion={() =>
              openWorkspaceItem("question-ps", activeParentQuestion.id)
            }
          />
        ) : hasActiveItem ? (
          <>
            {activeQuestion ? (
              <QuestionValidationWorkspace
                key={activeQuestion.id}
                question={activeQuestion}
                index={activeIndex}
                itemTotal={activeItems.length}
                questionReviewCount={
                  questionCountsLoaded
                    ? (questionReviewCounts.get(activeQuestion.id) ?? 0)
                    : undefined
                }
                answers={
                  allWorkspaceItems[
                    activeQuestion.type === "multiple_choice"
                      ? "answer-mp"
                      : "answer-ps"
                  ]
                }
                reviewedAnswerIds={reviewedAnswerIds}
                answerTaskById={answerTaskById}
                misconceptions={misconceptions}
                locked={activeQuestionLocked}
                progressUnavailable={!progressLoaded}
                reviewedByMe={activeQuestionReviewedByMe}
                globallyComplete={activeQuestionGloballyComplete}
                isAdmin={isAdmin}
                onPrevious={() => selectOffset(-1)}
                onNext={() => selectOffset(1)}
                onViewHistory={viewMyReviewHistory}
                onDirtyChange={
                  workspace === "question-mp"
                    ? setMpQuestionReviewDirty
                    : undefined
                }
                onReviewAnswer={(answerId) =>
                  requestOpenWorkspaceItem(
                    activeQuestion.type === "multiple_choice"
                      ? "answer-mp"
                      : "answer-ps",
                    answerId,
                    activeQuestion.id,
                  )
                }
                onSubmit={async (values) => {
                  if (!progressLoaded || activeQuestionLocked) return;
                  if (!user) throw new Error("Sesi dosen tidak ditemukan.");
                  const alreadyReviewed = reviewedQuestionIds.includes(
                    activeQuestion.id,
                  );
                  await saveQuestionReview(user.id, activeQuestion.id, values);
                  setReviewedQuestionIds((current) =>
                    current.includes(activeQuestion.id)
                      ? current
                      : [...current, activeQuestion.id],
                  );
                  if (
                    !alreadyReviewed &&
                    progressLoaded &&
                    questionCountsLoaded
                  ) {
                    setQuestionReviewCounts((current) => {
                      const next = new Map(current);
                      next.set(
                        activeQuestion.id,
                        (next.get(activeQuestion.id) ?? 0) + 1,
                      );
                      return next;
                    });
                  }
                  const target = selectAfterQuestionReview(
                    activeQuestion,
                    navigableWorkspaceItems[
                      activeQuestion.type === "multiple_choice"
                        ? "question-mp"
                        : "question-ps"
                    ],
                    allWorkspaceItems[
                      activeQuestion.type === "multiple_choice"
                        ? "answer-mp"
                        : "answer-ps"
                    ],
                    reviewedQuestionIds,
                    reviewedAnswerIds,
                  );
                  setMpQuestionReviewDirty(false);
                  openWorkspaceItem(
                    target.workspace,
                    target.itemId,
                    target.parentQuestionId,
                  );
                }}
              />
            ) : activeAnswer && answerQuestion ? (
              <AnswerValidationWorkspace
                key={activeAnswer.id}
                toolbar={
                  <WorkspaceToolbar
                    workspace={workspace}
                    label={activeTab.label}
                    itemLabel={itemLabel}
                    reviewed={progress.reviewed}
                    index={activeIndex}
                    total={progress.total}
                    itemTotal={activeItems.length}
                    language={language}
                    parentQuestion={answerQuestion}
                    onPrevious={() => selectOffset(-1)}
                    onNext={() => selectOffset(1)}
                  />
                }
                task={answerTask}
                question={answerQuestion}
                answer={activeAnswer}
                misconceptions={misconceptions}
                locked={activeAnswerLocked}
                progressUnavailable={!progressLoaded || !answerCountsLoaded}
                reviewedByMe={activeAnswerReviewedByMe}
                globallyComplete={activeAnswerGloballyComplete}
                isAdmin={isAdmin}
                onViewHistory={viewMyReviewHistory}
                onBackToQuestion={() =>
                  openWorkspaceItem(
                    answerQuestion.type === "multiple_choice"
                      ? "question-mp"
                      : "question-ps",
                    answerQuestion.id,
                  )
                }
                onSubmit={async (values) => {
                  if (
                    !progressLoaded ||
                    !answerCountsLoaded ||
                    activeAnswerLocked
                  ) return;
                  if (!user) throw new Error("Sesi dosen tidak ditemukan.");
                  await saveAnswerReview(
                    user.id,
                    activeAnswer.id,
                    answerQuestion.id,
                    values,
                  );
                  setReviewedAnswerIds((current) =>
                    current.includes(activeAnswer.id)
                      ? current
                      : [...current, activeAnswer.id],
                  );
                  setAnswerReviewCounts((current) => {
                    const next = new Map(current);
                    next.set(
                      activeAnswer.id,
                      (next.get(activeAnswer.id) ?? 0) + 1,
                    );
                    return next;
                  });
                  const target = selectAfterAnswerReview(
                    answerQuestion,
                    activeAnswer.id,
                    navigableWorkspaceItems[
                      answerQuestion.type === "multiple_choice"
                        ? "question-mp"
                        : "question-ps"
                    ],
                    allWorkspaceItems[
                      answerQuestion.type === "multiple_choice"
                        ? "answer-mp"
                        : "answer-ps"
                    ],
                    reviewedQuestionIds,
                    reviewedAnswerIds,
                  );
                  openWorkspaceItem(
                    target.workspace,
                    target.itemId,
                    target.parentQuestionId,
                  );
                }}
              />
            ) : null}
          </>
        ) : (
          <EmptyState message={emptyMessages[workspace]} />
        )}
      </section>
      </div>
    </div>
  );
}

function ReviewProgressUnavailableNotice() {
  const { language } = useLanguage();

  return (
    <div
      role="alert"
      className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
    >
      <p className="font-semibold leading-6">
        {language === "id"
          ? "Status review Anda belum dapat dimuat. Muat ulang halaman sebelum melanjutkan review."
          : "Your review status could not be loaded. Reload the page before continuing the review."}
      </p>
      <Button
        type="button"
        variant="secondary"
        onClick={() => window.location.reload()}
        className="mt-3"
      >
        {language === "id" ? "Muat ulang" : "Reload"}
      </Button>
    </div>
  );
}

function ReviewLockNotice({
  kind,
  reviewedByMe,
  globallyComplete = false,
  onViewHistory,
}: {
  kind: "question" | "answer";
  reviewedByMe: boolean;
  globallyComplete?: boolean;
  onViewHistory: () => void;
}) {
  const { language } = useLanguage();
  const personalMessage =
    kind === "question"
      ? language === "id"
        ? ["Anda sudah mereview soal ini.", "Review tidak dapat dikirim ulang."]
        : [
            "You have already reviewed this question.",
            "The review cannot be resubmitted.",
          ]
      : language === "id"
        ? [
            "Anda sudah mereview jawaban ini.",
            "Review tidak dapat dikirim ulang.",
          ]
        : [
            "You have already reviewed this answer.",
            "The review cannot be resubmitted.",
          ];

  if (!reviewedByMe && !globallyComplete) return null;

  return (
    <div
      role="status"
      className="mt-5 rounded-md border border-warning-border bg-warning-bg px-4 py-3 text-sm text-warning"
    >
      <p className="font-semibold leading-6">
        {reviewedByMe
          ? personalMessage.map((sentence) => (
              <span key={sentence} className="block">
                {sentence}
              </span>
            ))
          : language === "id"
            ? `Review ${kind === "question" ? "soal" : "jawaban"} ini telah selesai oleh ${QUESTION_REVIEWED_THRESHOLD} reviewer.`
            : `This ${kind} review has been completed by ${QUESTION_REVIEWED_THRESHOLD} reviewers.`}
      </p>
      {reviewedByMe && (
        <Button
          type="button"
          variant="secondary"
          onClick={onViewHistory}
          className="mt-3"
        >
          {language === "id" ? "Lihat review saya" : "View my review"}
        </Button>
      )}
    </div>
  );
}

function QuestionValidationWorkspace({
  question,
  index,
  itemTotal,
  questionReviewCount,
  answers,
  reviewedAnswerIds,
  answerTaskById,
  misconceptions,
  locked,
  progressUnavailable,
  reviewedByMe,
  globallyComplete,
  isAdmin,
  onPrevious,
  onNext,
  onViewHistory,
  onDirtyChange,
  onReviewAnswer,
  onSubmit,
}: {
  question: Question;
  index: number;
  itemTotal: number;
  questionReviewCount?: number;
  answers: StudentAnswer[];
  reviewedAnswerIds: string[];
  answerTaskById: Map<string, ReviewTask>;
  misconceptions: Misconception[];
  locked: boolean;
  progressUnavailable: boolean;
  reviewedByMe: boolean;
  globallyComplete: boolean;
  isAdmin: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onViewHistory: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onReviewAnswer: (answerId: string) => void;
  onSubmit: (values: QuestionReviewValues) => Promise<void>;
}) {
  const { language } = useLanguage();
  const reference = getQuestionReference(question);
  const questionTitle =
    t(question.title, language).trim() ||
    `${language === "id" ? "Soal" : "Question"} ${question.number || question.id}`;
  const questionCode = question.sourceCode?.trim() || question.id;
  const weekMatch = /^W(\d+)(?:-(\d+))?$/i.exec(question.week ?? "");
  const normalizedWeekNumber = weekMatch
    ? weekMatch[2]
      ? `${Number(weekMatch[1])}–${Number(weekMatch[2])}`
      : String(Number(weekMatch[1]))
    : question.week || (language === "id" ? "Belum tersedia" : "Unavailable");
  const localizedPrompt = t(question.prompt, language);
  const localizedQuestionText =
    (language === "id" ? question.questionInd : question.questionEn)?.trim() ||
    (question.questionCode && localizedPrompt.endsWith(question.questionCode)
      ? localizedPrompt.slice(0, -question.questionCode.length).trimEnd()
      : localizedPrompt);
  const pseudocode = question.questionCode?.trim() || reference.pseudocode;
  const reviewerCount =
    questionReviewCount === undefined
      ? undefined
      : Math.min(questionReviewCount, QUESTION_REVIEWED_THRESHOLD);
  const reviewerLabel = language === "id" ? "Reviewer" : "Reviewers";
  const reviewerCountLabel =
    reviewerCount === undefined
      ? ""
      : language === "id"
        ? `${reviewerCount} dari ${QUESTION_REVIEWED_THRESHOLD} reviewer telah mereview soal ini`
        : `${reviewerCount} of ${QUESTION_REVIEWED_THRESHOLD} reviewers have reviewed this question`;
  const questionRemovalProposalIds = getQuestionRemovalProposalIds(
    question.questionMisconceptionIds,
  );
  const recommended = prioritizeMisconceptions(
    misconceptions,
    questionRemovalProposalIds,
  );
  const directQuestionMisconceptionIds =
    question.directQuestionMisconceptionIds;
  const answerDerivedMisconceptionIds =
    question.answerDerivedMisconceptionIds;
  const directQuestionMisconceptionIdSet = new Set(
    directQuestionMisconceptionIds,
  );
  const answerDerivedMisconceptionIdSet = new Set(
    answerDerivedMisconceptionIds,
  );
  const misconceptionSourceLabel = (misconceptionId: string): string => {
    const directlyLinked =
      directQuestionMisconceptionIdSet.has(misconceptionId);
    const answerDerived =
      answerDerivedMisconceptionIdSet.has(misconceptionId);
    if (directlyLinked && answerDerived) {
      return language === "id"
        ? "Terkait ke soal dan jawaban"
        : "Linked to question and answer";
    }
    if (answerDerived) {
      return language === "id"
        ? "Diturunkan dari jawaban"
        : "Derived from answer";
    }
    return language === "id"
      ? "Terkait langsung ke soal"
      : "Directly linked to question";
  };
  const misconceptionById = new Map(
    misconceptions.map((item) => [item.id, item]),
  );
  const addableMisconceptions = getAdditionalMisconceptionCandidates(
    misconceptions,
    question.questionMisconceptionIds,
  );
  const similarMisconceptions = prioritizeMisconceptions(
    addableMisconceptions,
    recommended.flatMap((item) => item.relatedMisconceptionIds),
  );
  const relatedAnswers = getAnswersForQuestion(question.id, answers);
  const answerReviewEligible = isAnswerReviewEligible(question);
  const reviewedAnswers = new Set(reviewedAnswerIds);
  const [form, dispatchForm] = useReducer(
    misconceptionReviewFormReducer,
    initialMisconceptionReviewFormState,
  );
  const {
    removalChoice: hasIncorrectMisconceptions,
    removedMisconceptionIds,
    removalReason,
    additionChoice: hasAdditionalMisconceptions,
    additionalMisconceptionIds,
    additionReason,
    note,
  } = form;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formDirty = isMisconceptionReviewFormDirty(form);
  const formUnavailable = locked || progressUnavailable;
  const canSubmit =
    !formUnavailable &&
    canSubmitMisconceptionReview(form);

  useEffect(() => {
    onDirtyChange?.(formDirty);
  }, [formDirty, onDirtyChange]);

  const handleSubmit = async () => {
    if (
      formUnavailable ||
      !canSubmit ||
      submitting ||
      hasIncorrectMisconceptions === null ||
      hasAdditionalMisconceptions === null
    ) {
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      await onSubmit(buildQuestionReviewValues(form));
      dispatchForm({ type: "reset" });
      onDirtyChange?.(false);
    } catch (error) {
      console.error("[Progmiscon] Validasi soal gagal disimpan", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Validasi soal belum dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scroll-reveal review-folder-content">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <article className="review-folder-primary min-w-0 overflow-hidden rounded-lg border border-border bg-white p-5 md:p-7">
          <section aria-labelledby="review-question-title">
            <nav
              className="flex items-center justify-between gap-2 border-b border-border pb-5 sm:gap-4"
              aria-label={
                language === "id"
                  ? "Navigasi soal review"
                  : "Review question navigation"
              }
            >
              <Button
                type="button"
                variant="secondary"
                onClick={onPrevious}
                disabled={index <= 0}
                className="min-w-0 justify-self-start px-2.5 sm:px-3.5"
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                {language === "id" ? "Sebelumnya" : "Previous"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={onNext}
                disabled={index >= itemTotal - 1}
                className="min-w-0 justify-self-end px-2.5 sm:px-3.5"
              >
                {language === "id" ? "Berikutnya" : "Next"}
                <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
              </Button>
            </nav>

            <header className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="min-w-0">
                <h2
                  id="review-question-title"
                  aria-label={`${questionCode} / ${questionTitle}`}
                  className="text-lg font-extrabold leading-[1.2] tracking-[-0.015em] text-navy-deep md:text-xl"
                >
                  <span className="font-mono font-extrabold leading-none tracking-[0.02em] tabular-nums text-brand">
                    {questionCode}
                  </span>
                  <span className="mx-1.5 font-medium text-muted/70" aria-hidden="true">
                    /
                  </span>
                  <span>{questionTitle}</span>
                </h2>
                <dl className="mt-1 flex flex-wrap items-baseline gap-x-1 gap-y-1 text-xs font-bold leading-5 text-muted">
                  <div className="flex min-w-0 items-baseline gap-1">
                    <dt className="sr-only">Week</dt>
                    <dd>
                      <span aria-hidden="true">Week </span>
                      {normalizedWeekNumber}
                    </dd>
                  </div>
                  <div className="flex min-w-0 items-baseline gap-1">
                    <span className="mx-1 text-muted/65" aria-hidden="true">
                      ·
                    </span>
                    <dt className="shrink-0 font-bold text-navy-deep">KC:</dt>
                    <dd className="min-w-0">
                      {question.expectedConcepts.length > 0
                        ? question.expectedConcepts
                            .map((concept) => t(concept, language))
                            .join(", ")
                        : language === "id"
                          ? "Belum tersedia"
                          : "Unavailable"}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex md:justify-end">
                {reviewerCount !== undefined && (
                  <span
                    aria-label={reviewerCountLabel}
                    className={cn(
                      "inline-flex min-w-[96px] items-center gap-2 rounded-md border px-2.5 py-2",
                      reviewerCount === QUESTION_REVIEWED_THRESHOLD
                        ? "border-correct-border bg-correct-bg text-correct"
                        : reviewerCount > 0
                          ? "border-brand/25 bg-brand-soft text-brand"
                          : "border-border bg-neutral text-muted",
                    )}
                  >
                    <Users size={16} strokeWidth={2} aria-hidden="true" />
                    <span className="grid leading-none">
                      <span className="text-sm font-bold tabular-nums">
                        {reviewerCount}/{QUESTION_REVIEWED_THRESHOLD}
                      </span>
                      <span className="mt-1 text-[10px] font-semibold">
                        {reviewerLabel}
                      </span>
                    </span>
                  </span>
                )}
              </div>
            </header>

            <div className="mt-6 border-t border-border pt-6">
              {localizedQuestionText && (
                <p className="max-w-3xl whitespace-pre-wrap text-[14px] font-normal leading-7 text-navy-deep">
                  {localizedQuestionText}
                </p>
              )}

              {pseudocode && (
                <div className="mt-5 overflow-hidden rounded-lg border border-navy-deep/15 bg-navy-deep shadow-[0_8px_22px_rgba(33,29,27,0.12)]">
                  <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                    <p className="font-mono text-[11px] font-semibold text-white/70">
                      {language === "id"
                        ? "Pseudocode baca-saja"
                        : "Read-only pseudocode"}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(pseudocode)
                          .catch(() => undefined);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                      aria-label={
                        language === "id"
                          ? "Salin pseudocode"
                          : "Copy pseudocode"
                      }
                    >
                      <Copy size={14} strokeWidth={2} aria-hidden="true" />
                      {language === "id" ? "Salin" : "Copy"}
                    </button>
                  </div>
                  <PseudocodeBlock code={pseudocode} />
                </div>
              )}
            </div>
          </section>

          {isAdmin && <AdminQuestionContentEditor question={question} />}

          {question.options && (
            <section className="mt-6">
              <p className="academic-label mb-2">{language === "id" ? "Pilihan jawaban" : "Answer options"}</p>
              <ul className="space-y-2">
                {question.options.map((option) => {
                  const optionMisconceptions =
                    getQuestionOptionMisconceptionIds(option)
                      .map((id) => misconceptionById.get(id))
                      .filter((item) => item !== undefined);
                  return (
                    <li
                      key={option.id}
                      className={cn(
                        "flex items-start gap-3 rounded-md border px-4 py-3 text-[13px] leading-6",
                        option.isCorrect ? "border-correct-border bg-correct-bg/55" : "border-border bg-white",
                      )}
                    >
                      <span className="font-semibold text-navy-deep">{option.label}.</span>
                      <span className="min-w-0 flex-1 text-navy-deep">
                        <span className="block">{t(option.text, language)}</span>
                        {optionMisconceptions.length > 0 && (
                          <span className="mt-1 block space-y-1 text-xs text-muted">
                            {optionMisconceptions.map((misconception) => (
                              <span key={misconception.id} className="block">
                                {misconceptionLabel(misconception, language)}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      {option.isCorrect && (
                        <span className="ml-auto shrink-0 text-xs font-semibold text-correct">
                          {language === "id" ? "Jawaban acuan" : "Reference answer"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mt-6 border-t border-border pt-5">
            <p className="academic-label mb-2">
              {language === "id"
                ? "Miskonsepsi tingkat soal"
                : "Question-level misconceptions"}
            </p>
            {recommended.length > 0 ? (
              <ul className="space-y-2">
                {recommended.map((item) => {
                  return (
                    <li
                      key={item.id}
                      className="rounded-md bg-brand-soft/65 px-3 py-2 text-navy-deep"
                    >
                      <span className="block text-sm font-semibold leading-5">
                        {misconceptionLabel(item, language)}
                      </span>
                      <span className="mt-0.5 block text-xs font-medium text-muted">
                        {misconceptionSourceLabel(item.id)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                {language === "id"
                  ? "Belum ada miskonsepsi yang terhubung."
                  : "No misconceptions are linked yet."}
              </p>
            )}
            {answerDerivedMisconceptionIds.length > 0 && (
              <p className="mt-3 text-xs leading-5 text-muted">
                {answerReviewEligible
                  ? language === "id"
                    ? "Relasi yang diturunkan dari jawaban tetap efektif sampai relasi jawaban terkait direview terlebih dahulu."
                    : "Answer-derived relations remain effective until the related answer relation is reviewed first."
                  : language === "id"
                    ? "Relasi yang diturunkan dari jawaban tetap ditampilkan sebagai evidence dan bukan pekerjaan review jawaban."
                    : "Answer-derived relations remain visible as evidence and are not answer-review work."}
              </p>
            )}
          </section>

          <section
            className="mt-6 border-t border-border pt-5"
            aria-labelledby="related-answers-title"
          >
            <h3
              id="related-answers-title"
              className="text-sm font-bold text-navy-deep"
            >
              {answerReviewEligible
                ? language === "id"
                  ? "Jawaban terkait"
                  : "Related answers"
                : language === "id"
                  ? "Evidence jawaban terkait"
                  : "Related answer evidence"}
            </h3>

            {relatedAnswers.length > 0 ? (
              <ul className="mt-3 grid min-w-0 gap-3 md:grid-cols-2">
                {relatedAnswers.map((answer, index) => {
                  const { option, fallbackText } = resolveAnswerSelection(
                    question,
                    answer,
                  );
                  const task = answerTaskById.get(answer.id);
                  const linkedMisconceptions = prioritizeMisconceptions(
                    misconceptions,
                    [
                      ...(option
                        ? getQuestionOptionMisconceptionIds(option)
                        : []),
                      ...(task?.suggestedMisconceptionId
                        ? [task.suggestedMisconceptionId]
                        : []),
                      ...answer.studentMisconceptionIds,
                    ],
                  );
                  const snippet =
                    fallbackText.length > 240
                      ? `${fallbackText.slice(0, 240)}...`
                      : fallbackText;

                  return (
                    <li
                      key={answer.id}
                      className="min-w-0 rounded-md border border-border bg-bg p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <p className="text-sm font-bold text-navy-deep">
                          {language === "id" ? "Jawaban" : "Answer"} {index + 1}
                        </p>
                        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                          <span
                            className={cn(
                              "rounded px-2 py-1",
                              answer.status === "correct"
                                ? "bg-correct-bg text-correct"
                                : "bg-incorrect-bg text-incorrect",
                            )}
                          >
                            {answer.status === "correct"
                              ? language === "id"
                                ? "Benar"
                                : "Correct"
                              : language === "id"
                                ? "Salah"
                                : "Incorrect"}
                          </span>
                          <span className="rounded bg-neutral px-2 py-1 text-navy-deep">
                            {answerReviewEligible
                              ? reviewedAnswers.has(answer.id)
                                ? language === "id"
                                  ? "Sudah direview"
                                  : "Reviewed"
                                : language === "id"
                                  ? "Belum direview"
                                  : "Not reviewed"
                              : "Evidence"}
                          </span>
                        </div>
                      </div>

                      {question.type === "multiple_choice" ? (
                        <p className="mt-3 break-words rounded-md bg-white px-3 py-2 text-sm leading-6 text-navy-deep">
                          {option
                            ? `${option.label}. ${t(option.text, language)}`
                            : fallbackText ||
                              (language === "id"
                                ? "Teks jawaban tidak tersedia."
                                : "Answer text is unavailable.")}
                        </p>
                      ) : (
                        <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded-md bg-navy-deep p-3 font-mono text-xs leading-5 text-white">
                          {snippet ||
                            (language === "id"
                              ? "Teks jawaban tidak tersedia."
                              : "Answer text is unavailable.")}
                        </pre>
                      )}

                      {linkedMisconceptions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs font-semibold text-muted">
                            {language === "id"
                              ? "Miskonsepsi terkait"
                              : "Linked misconceptions"}
                          </p>
                          <ul className="mt-1 space-y-1">
                            {linkedMisconceptions.map((item) => (
                              <li
                                key={item.id}
                                className="break-words text-xs leading-5 text-navy-deep"
                              >
                                {misconceptionLabel(item, language)}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => onReviewAnswer(answer.id)}
                        className="mt-4 w-full justify-center sm:w-auto"
                      >
                        {language === "id"
                          ? answerReviewEligible
                            ? "Review jawaban ini"
                            : "Lihat evidence"
                          : answerReviewEligible
                            ? "Review this answer"
                            : "View evidence"}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {language === "id"
                  ? "Belum ada jawaban terkait untuk soal ini"
                  : "There are no related answers for this question"}
              </p>
            )}
          </section>
        </article>

        <aside className="rounded-lg border border-border bg-white p-5 md:p-6 lg:sticky lg:top-24">
          <p className="text-base font-bold text-navy-deep">
            {language === "id" ? "Form validasi soal" : "Question validation form"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {language === "id"
              ? "Tinjau daftar kemungkinan miskonsepsi pada soal ini."
              : "Review the possible misconceptions listed for this question."}
          </p>

          {progressUnavailable ? (
            <ReviewProgressUnavailableNotice />
          ) : (
            <ReviewLockNotice
              kind="question"
              reviewedByMe={reviewedByMe}
              globallyComplete={globallyComplete}
              onViewHistory={onViewHistory}
            />
          )}

          <fieldset
            disabled={formUnavailable}
            aria-disabled={formUnavailable}
            className={cn(
              "mt-6 space-y-6",
              formUnavailable && "opacity-65",
            )}
          >
            <legend className="sr-only">
              {language === "id"
                ? "Isian validasi soal"
                : "Question validation fields"}
            </legend>
            <section aria-labelledby="remove-misconception-question">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p id="remove-misconception-question" className="text-sm font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi yang tidak seharusnya dicantumkan?"
                      : "Are any misconceptions listed that should not be included?"}
                  </p>
                  <PresenceToggle
                    value={hasIncorrectMisconceptions}
                    onChange={(value) =>
                      dispatchForm({
                        type: "set_presence",
                        field: "removal",
                        value,
                      })
                    }
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi yang tidak seharusnya dicantumkan?"
                        : "Are any misconceptions listed that should not be included?"
                    }
                    yesDisabled={questionRemovalProposalIds.length === 0}
                  />
                </div>
              </div>

              {hasIncorrectMisconceptions && (
                <div className="ml-9 mt-4 space-y-4 rounded-md border border-border bg-neutral/60 p-3">
                  <fieldset>
                    <legend className="text-xs font-semibold leading-5 text-navy-deep">
                      {language === "id" ? "Pilih yang perlu dihapus" : "Select items to remove"}
                    </legend>
                    <div className="mt-2 space-y-2">
                      {recommended.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-white px-3 py-2.5 text-sm leading-5 text-navy-deep">
                          <input
                            type="checkbox"
                            checked={removedMisconceptionIds.includes(item.id)}
                            onChange={(event) =>
                              dispatchForm({
                                type: "set_ids",
                                field: "removal",
                                ids: event.target.checked
                                  ? [...removedMisconceptionIds, item.id]
                                  : removedMisconceptionIds.filter(
                                      (id) => id !== item.id,
                                    ),
                              })
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                          />
                          <span className="min-w-0">
                            <span className="block">
                              {misconceptionLabel(item, language)}
                            </span>
                            <span className="mt-0.5 block text-xs text-muted">
                              {misconceptionSourceLabel(item.id)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label htmlFor="removal-reason" className="block text-xs font-semibold text-navy-deep">
                    {language === "id" ? "Alasan" : "Reason"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
                  </label>
                  <textarea
                    id="removal-reason"
                    value={removalReason}
                    onChange={(event) =>
                      dispatchForm({
                        type: "set_reason",
                        field: "removal",
                        value: event.target.value,
                      })
                    }
                    aria-required="true"
                    placeholder={language === "id" ? "Jelaskan mengapa perlu dihapus" : "Explain why it should be removed"}
                    className="academic-input min-h-20 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-6" aria-labelledby="add-misconception-question">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p id="add-misconception-question" className="text-sm font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi lain yang perlu ditambahkan?"
                      : "Should any other misconceptions be added?"}
                  </p>
                  <PresenceToggle
                    value={hasAdditionalMisconceptions}
                    onChange={(value) =>
                      dispatchForm({
                        type: "set_presence",
                        field: "addition",
                        value,
                      })
                    }
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi lain yang perlu ditambahkan?"
                        : "Should any other misconceptions be added?"
                    }
                    yesDisabled={addableMisconceptions.length === 0}
                  />
                </div>
              </div>

              {hasAdditionalMisconceptions && (
                <div className="ml-9 mt-4 space-y-4 rounded-md border border-border bg-neutral/60 p-3">
                  <MisconceptionPicker
                    misconceptions={addableMisconceptions}
                    recommended={similarMisconceptions}
                    value={additionalMisconceptionIds}
                    onChange={(ids) =>
                      dispatchForm({
                        type: "set_ids",
                        field: "addition",
                        ids,
                      })
                    }
                    variant="selection"
                    label={language === "id" ? "Miskonsepsi yang ditambahkan" : "Misconceptions to add"}
                    helper={language === "id" ? "Anda dapat memilih lebih dari satu." : "You may select more than one."}
                  />

                  <label htmlFor="addition-reason" className="block text-xs font-semibold text-navy-deep">
                    {language === "id" ? "Alasan" : "Reason"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
                  </label>
                  <textarea
                    id="addition-reason"
                    value={additionReason}
                    onChange={(event) =>
                      dispatchForm({
                        type: "set_reason",
                        field: "addition",
                        value: event.target.value,
                      })
                    }
                    aria-required="true"
                    placeholder={language === "id" ? "Jelaskan mengapa perlu ditambahkan" : "Explain why it should be added"}
                    className="academic-input min-h-20 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-6" aria-labelledby="additional-comment-label">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <label id="additional-comment-label" htmlFor="question-validation-note" className="block text-sm font-semibold text-navy-deep">
                    {language === "id" ? "Komentar tambahan" : "Additional comment"}
                  </label>
                  <textarea
                    id="question-validation-note"
                    value={note}
                    onChange={(event) =>
                      dispatchForm({
                        type: "set_note",
                        value: event.target.value,
                      })
                    }
                    placeholder={language === "id" ? "Komentar opsional" : "Optional comment"}
                    className="academic-input mt-3 min-h-24 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              </div>
            </section>
          </fieldset>

          {!formUnavailable && submitError && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2.5 text-xs leading-5 text-incorrect"
            >
              {submitError}
            </p>
          )}

          {!formUnavailable && !canSubmit && (
            <p id="question-validation-help" className="mt-5 text-xs leading-5 text-muted">
              {language === "id"
                ? "Jawab kedua pertanyaan dan lengkapi pilihan serta alasan jika memilih Ada."
                : "Answer both questions and complete the selection and reason when choosing Yes."}
            </p>
          )}

          {!formUnavailable && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              aria-describedby={
                !canSubmit ? "question-validation-help" : undefined
              }
              className="mt-4 w-full justify-center"
            >
              {submitting
                ? language === "id"
                  ? "Menyimpan..."
                  : "Saving..."
                : language === "id"
                  ? "Simpan & lanjut"
                  : "Save & continue"}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

function AnswerValidationWorkspace({
  toolbar,
  task,
  question,
  answer,
  misconceptions,
  locked,
  progressUnavailable,
  reviewedByMe,
  globallyComplete,
  isAdmin,
  onViewHistory,
  onBackToQuestion,
  onSubmit,
}: {
  toolbar: ReactNode;
  task?: ReviewTask;
  question: Question;
  answer: StudentAnswer;
  misconceptions: Misconception[];
  locked: boolean;
  progressUnavailable: boolean;
  reviewedByMe: boolean;
  globallyComplete: boolean;
  isAdmin: boolean;
  onViewHistory: () => void;
  onBackToQuestion: () => void;
  onSubmit: (values: AnswerReviewValues) => Promise<void>;
}) {
  const { language } = useLanguage();
  const {
    option: selectedOption,
    fallbackText,
    missingSelectedOption,
  } = resolveAnswerSelection(question, answer);
  const misconceptionById = new Map(
    misconceptions.map((item) => [item.id, item]),
  );
  const linkedMisconceptions = prioritizeMisconceptions(misconceptions, [
    ...(selectedOption
      ? getQuestionOptionMisconceptionIds(selectedOption)
      : []),
    ...(task?.suggestedMisconceptionId
      ? [task.suggestedMisconceptionId]
      : []),
    ...answer.studentMisconceptionIds,
  ]);
  const addableMisconceptions = getAdditionalMisconceptionCandidates(
    misconceptions,
    linkedMisconceptions.map((item) => item.id),
  );
  const similarMisconceptions = prioritizeMisconceptions(
    addableMisconceptions,
    linkedMisconceptions.flatMap((item) => item.relatedMisconceptionIds),
  );
  const [form, dispatchForm] = useReducer(
    misconceptionReviewFormReducer,
    initialMisconceptionReviewFormState,
  );
  const {
    removalChoice: hasMismatchedMisconceptions,
    removedMisconceptionIds,
    removalReason,
    additionChoice: hasAdditionalMisconceptions,
    additionalMisconceptionIds,
    additionReason,
    note,
  } = form;
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formUnavailable = locked || progressUnavailable;
  const canSubmit =
    !formUnavailable &&
    canSubmitMisconceptionReview(form);

  const handleSubmit = async () => {
    if (
      formUnavailable ||
      !canSubmit ||
      submitting ||
      hasMismatchedMisconceptions === null ||
      hasAdditionalMisconceptions === null
    ) {
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      await onSubmit(buildAnswerReviewValues(form));
    } catch (error) {
      console.error("[Progmiscon] Validasi jawaban gagal disimpan", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Validasi jawaban belum dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scroll-reveal review-folder-content">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <article className="review-folder-primary min-w-0 overflow-hidden rounded-lg border border-border bg-white p-5 md:p-7">
          {toolbar}
          <Button
            type="button"
            variant="secondary"
            onClick={onBackToQuestion}
            className="mb-5"
          >
            {language === "id"
              ? "Kembali ke soal ini"
              : "Back to this question"}
          </Button>
          <section className="rounded-lg bg-neutral p-5">
            <p className="academic-label">{language === "id" ? "Soal sebagai konteks" : "Question context"}</p>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[14px] font-normal leading-7 text-navy-deep">
              {t(question.prompt, language)}
            </p>
          </section>

          {isAdmin && <AdminAnswerContentEditor answer={answer} />}

          {question.type === "multiple_choice" && question.options && (
            <section className="mt-6">
              <p className="academic-label mb-2">
                {language === "id"
                  ? "Pilihan jawaban sebagai konteks"
                  : "Answer options as context"}
              </p>
              <ul className="space-y-2">
                {question.options.map((option) => {
                  const selected = option.id === selectedOption?.id;
                  const optionMisconceptions =
                    getQuestionOptionMisconceptionIds(option)
                      .map((id) => misconceptionById.get(id))
                      .filter((item) => item !== undefined);

                  return (
                    <li
                      key={option.id}
                      className={cn(
                        "flex items-start gap-3 rounded-md border px-4 py-3 text-[13px] leading-6",
                        selected
                          ? "border-brand bg-brand-soft/55"
                          : option.isCorrect
                            ? "border-correct-border bg-correct-bg/55"
                            : "border-border bg-white",
                      )}
                    >
                      <span className="font-semibold text-navy-deep">
                        {option.label}.
                      </span>
                      <span className="min-w-0 flex-1 text-navy-deep">
                        <span className="block">{t(option.text, language)}</span>
                        {optionMisconceptions.length > 0 && (
                          <span className="mt-1 block space-y-1 text-xs text-muted">
                            {optionMisconceptions.map((misconception) => (
                              <span key={misconception.id} className="block">
                                {misconceptionLabel(misconception, language)}
                              </span>
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="ml-auto flex shrink-0 flex-col items-end gap-1 text-[11px] font-semibold">
                        {selected && (
                          <span className="text-brand">
                            {language === "id" ? "Dipilih" : "Selected"}
                          </span>
                        )}
                        {selected && !option.isCorrect && (
                          <span className="text-incorrect">
                            {language === "id" ? "Salah" : "Incorrect"}
                          </span>
                        )}
                        {option.isCorrect && (
                          <span className="text-correct">
                            {language === "id" ? "Benar" : "Correct"}
                          </span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mt-6">
            <p className="mb-2 text-sm font-bold text-navy-deep">
              {language === "id" ? "Variasi jawaban" : "Answer variation"}
            </p>
            {missingSelectedOption && (
              <p
                role="status"
                className="mb-3 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs leading-5 text-warning"
              >
                {language === "id"
                  ? "Opsi yang dipilih tidak ditemukan. Teks jawaban ditampilkan sebagai fallback."
                  : "The selected option could not be found. The answer text is shown as a fallback."}
              </p>
            )}
            <div className="overflow-hidden rounded-md border border-border">
              <div
                className={
                  selectedOption || question.type === "multiple_choice"
                    ? "bg-bg p-5"
                    : "bg-navy-deep"
                }
              >
                {selectedOption ? (
                  <p className="text-sm text-navy-deep">
                    <span className="font-medium">{selectedOption.label}.</span> {t(selectedOption.text, language)}
                  </p>
                ) : question.type === "multiple_choice" ? (
                  <p className="whitespace-pre-wrap text-sm text-navy-deep">
                    {fallbackText ||
                      (language === "id"
                        ? "Teks jawaban tidak tersedia."
                        : "Answer text is unavailable.")}
                  </p>
                ) : (
                  <PseudocodeBlock code={fallbackText} />
                )}
              </div>
              <AnswerStatusBar status={answer.status} />
            </div>
          </section>

          {task?.explanation && (
            <section className="mt-6 border-t border-border pt-5">
              <p className="academic-label mb-2">
                {language === "id" ? "Penjelasan" : "Explanation"}
              </p>
              <p className="whitespace-pre-wrap text-sm leading-6 text-navy-deep">
                {t(task.explanation, language)}
              </p>
            </section>
          )}

          <section className="mt-6 border-t border-border pt-5">
            <p className="academic-label">
              {language === "id" ? "Miskonsepsi yang dikaitkan saat ini" : "Currently linked misconceptions"}
            </p>
            {linkedMisconceptions.length > 0 ? (
              <ul className="mt-3 space-y-2">
                {linkedMisconceptions.map((item) => (
                  <li key={item.id} className="rounded-md bg-brand-soft/65 px-4 py-3 text-sm font-semibold leading-5 text-navy-deep">
                    {misconceptionLabel(item, language)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted">
                {language === "id"
                  ? "Belum ada miskonsepsi yang terhubung."
                  : "No misconceptions are linked yet."}
              </p>
            )}
          </section>
        </article>

        <aside className="rounded-lg border border-border bg-white p-5 md:p-6 lg:sticky lg:top-24">
          <p className="text-base font-bold text-navy-deep">
            {language === "id" ? "Form validasi jawaban" : "Answer validation form"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {language === "id"
              ? "Nilai label berdasarkan pola yang terlihat pada variasi jawaban ini."
              : "Evaluate labels based on the pattern visible in this answer variation."}
          </p>

          {progressUnavailable ? (
            <ReviewProgressUnavailableNotice />
          ) : (
            <ReviewLockNotice
              kind="answer"
              reviewedByMe={reviewedByMe}
              globallyComplete={globallyComplete}
              onViewHistory={onViewHistory}
            />
          )}

          <fieldset
            disabled={formUnavailable}
            aria-disabled={formUnavailable}
            className={cn(
              "mt-6 space-y-6",
              formUnavailable && "opacity-65",
            )}
          >
            <legend className="sr-only">
              {language === "id"
                ? "Isian validasi jawaban"
                : "Answer validation fields"}
            </legend>
            <section aria-labelledby="remove-answer-misconception-question">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p id="remove-answer-misconception-question" className="text-sm font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi yang saat ini dikaitkan dengan jawaban ini, tetapi tidak sesuai dengan pola jawabannya?"
                      : "Are any misconceptions currently linked to this answer inconsistent with its pattern?"}
                  </p>
                  <PresenceToggle
                    value={hasMismatchedMisconceptions}
                    onChange={(value) =>
                      dispatchForm({
                        type: "set_presence",
                        field: "removal",
                        value,
                      })
                    }
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi yang saat ini dikaitkan dengan jawaban ini, tetapi tidak sesuai dengan pola jawabannya?"
                        : "Are any misconceptions currently linked to this answer inconsistent with its pattern?"
                    }
                    yesDisabled={linkedMisconceptions.length === 0}
                  />
                </div>
              </div>

              {hasMismatchedMisconceptions && (
                <div className="ml-9 mt-4 space-y-4 rounded-md border border-border bg-neutral/60 p-3">
                  <fieldset>
                    <legend className="text-xs font-semibold leading-5 text-navy-deep">
                      {language === "id" ? "Pilih miskonsepsi yang sebaiknya dilepas" : "Select misconceptions to unlink"}
                    </legend>
                    <div className="mt-2 space-y-2">
                      {linkedMisconceptions.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-white px-3 py-2.5 text-sm leading-5 text-navy-deep">
                          <input
                            type="checkbox"
                            checked={removedMisconceptionIds.includes(item.id)}
                            onChange={(event) =>
                              dispatchForm({
                                type: "set_ids",
                                field: "removal",
                                ids: event.target.checked
                                  ? [...removedMisconceptionIds, item.id]
                                  : removedMisconceptionIds.filter(
                                      (id) => id !== item.id,
                                    ),
                              })
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                          />
                          <span>{misconceptionLabel(item, language)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label htmlFor="answer-removal-reason" className="block text-xs font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Mengapa miskonsepsi tersebut tidak sesuai dengan pola jawaban ini?"
                      : "Why is this misconception inconsistent with the answer pattern?"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
                  </label>
                  <textarea
                    id="answer-removal-reason"
                    value={removalReason}
                    onChange={(event) =>
                      dispatchForm({
                        type: "set_reason",
                        field: "removal",
                        value: event.target.value,
                      })
                    }
                    aria-required="true"
                    placeholder={language === "id" ? "Tuliskan alasan" : "Write a reason"}
                    className="academic-input min-h-20 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-6" aria-labelledby="add-answer-misconception-question">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p id="add-answer-misconception-question" className="text-sm font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi lain yang perlu dikaitkan dengan jawaban ini?"
                      : "Should any other misconceptions be linked to this answer?"}
                  </p>
                  <PresenceToggle
                    value={hasAdditionalMisconceptions}
                    onChange={(value) =>
                      dispatchForm({
                        type: "set_presence",
                        field: "addition",
                        value,
                      })
                    }
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi lain yang perlu dikaitkan dengan jawaban ini?"
                        : "Should any other misconceptions be linked to this answer?"
                    }
                    yesDisabled={addableMisconceptions.length === 0}
                  />
                </div>
              </div>

              {hasAdditionalMisconceptions && (
                <div className="ml-9 mt-4 space-y-4 rounded-md border border-border bg-neutral/60 p-3">
                  <MisconceptionPicker
                    misconceptions={addableMisconceptions}
                    recommended={similarMisconceptions}
                    value={additionalMisconceptionIds}
                    onChange={(ids) =>
                      dispatchForm({
                        type: "set_ids",
                        field: "addition",
                        ids,
                      })
                    }
                    variant="selection"
                    label={language === "id" ? "Miskonsepsi yang dikaitkan" : "Misconceptions to link"}
                    helper={language === "id" ? "Anda dapat memilih lebih dari satu." : "You may select more than one."}
                  />

                  <label htmlFor="answer-addition-reason" className="block text-xs font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Mengapa miskonsepsi tersebut sesuai dengan pola jawaban ini?"
                      : "Why does this misconception match the answer pattern?"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
                  </label>
                  <textarea
                    id="answer-addition-reason"
                    value={additionReason}
                    onChange={(event) =>
                      dispatchForm({
                        type: "set_reason",
                        field: "addition",
                        value: event.target.value,
                      })
                    }
                    aria-required="true"
                    placeholder={language === "id" ? "Tuliskan alasan" : "Write a reason"}
                    className="academic-input min-h-20 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-6" aria-labelledby="answer-additional-comment-label">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <label id="answer-additional-comment-label" htmlFor="answer-validation-note" className="block text-sm font-semibold text-navy-deep">
                    {language === "id" ? "Komentar tambahan" : "Additional comment"}
                  </label>
                  <textarea
                    id="answer-validation-note"
                    value={note}
                    onChange={(event) =>
                      dispatchForm({
                        type: "set_note",
                        value: event.target.value,
                      })
                    }
                    placeholder={
                      language === "id"
                        ? "Tuliskan catatan lain mengenai jawaban atau pemetaan miskonsepsinya."
                        : "Write another note about the answer or its misconception mapping."
                    }
                    className="academic-input mt-3 min-h-24 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              </div>
            </section>
          </fieldset>

          {!formUnavailable && submitError && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2.5 text-xs leading-5 text-incorrect"
            >
              {submitError}
            </p>
          )}

          {!formUnavailable && !canSubmit && (
            <p id="answer-validation-help" className="mt-5 text-xs leading-5 text-muted">
              {language === "id"
                ? "Jawab kedua pertanyaan dan lengkapi pilihan serta alasan jika memilih Ada."
                : "Answer both questions and complete the selection and reason when choosing Yes."}
            </p>
          )}

          {!formUnavailable && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting}
              aria-describedby={
                !canSubmit ? "answer-validation-help" : undefined
              }
              className="mt-4 w-full justify-center"
            >
              {submitting
                ? language === "id"
                  ? "Menyimpan..."
                  : "Saving..."
                : language === "id"
                  ? "Simpan & lanjut"
                  : "Save & continue"}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
