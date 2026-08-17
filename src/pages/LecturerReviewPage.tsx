import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  CircleCheckBig,
  History,
  ListFilter,
  LockKeyhole,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AnswerStatusBar } from "../components/review/AnswerStatusBar";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { MisconceptionPicker } from "../components/review/MisconceptionPicker";
import { ReviewQuestionFilters } from "../components/review/ReviewQuestionFilters";
import { useCategories } from "../hooks/useCategories";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { useStudents } from "../hooks/useStudents";
import { useReviewTasks } from "../hooks/useReviewTasks";
import { useMisconceptions } from "../hooks/useMisconceptions";
import type {
  AnswerReviewHistoryItem,
  AnswerReviewValues,
  Language,
  Misconception,
  Question,
  QuestionReviewHistoryItem,
  QuestionReviewValues,
  ReviewSourceVersions,
  ReviewTask,
  StudentAnswer,
} from "../types";
import { cn } from "../utils/cn";
import { getQuestionOptionMisconceptionIds } from "../utils/questionMetadata";
import { prioritizeMisconceptions, sortReviewTasks } from "../utils/reviewPriority";
import { t, uiText } from "../utils/translation";
import { misconceptionLabel } from "../utils/misconceptionLabel";
import {
  getQuestionReviewCounts,
  getAnswerReviewCounts,
  getReviewWorkspaceSnapshot,
  getReviewerHistory,
  getReviewProgress as getSavedReviewProgress,
  deleteAnswerReview,
  deleteQuestionReview,
  isReviewPersistenceError,
  saveAnswerReview,
  saveQuestionReview,
} from "../services/reviewPersistenceRepository";
import { QuestionContent } from "../components/review/QuestionContent";
import { PsAnswerEvidenceWorkspace } from "../components/review/PsAnswerEvidenceWorkspace";
import {
  ParentQuestionBackAction,
  QuestionContextAccordion,
  SiblingNavigator,
} from "../components/review/AnswerWorkspaceNavigation";
import { MisconceptionReasonCards } from "../components/review/MisconceptionReasonCards";
import {
  classifyReviewItems,
  filterEligibleAnswerReviewCounts,
  filterEligibleAnswerReviewIds,
  getAnswerWorkspaceForQuestion,
  getReviewProgress,
  isAnswerReviewEligible,
  resolveAnswerSelection,
  stripSelectedOptionPrefix,
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
  shouldWarnForMpAnswerNavigation,
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
  answerReviewFormState,
  canSubmitMisconceptionReview,
  getAdditionalMisconceptionCandidates,
  getQuestionRemovalProposalIds,
  isMisconceptionReviewFormDirty,
  misconceptionReviewFormReducer,
  questionReviewFormState,
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
    <div className="mt-2 inline-grid w-fit grid-cols-2 gap-0.5 rounded-md border border-[#ccbab0]/70 bg-[var(--review-secondary-soft)] p-0.5" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={option.value && yesDisabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-7 min-w-20 cursor-pointer rounded border px-2.5 py-1 text-xs font-normal leading-4 transition-[background-color,border-color,color,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40",
            value === option.value
              ? option.value
                ? "border-brand/20 bg-brand-soft/65 text-brand"
                : "border-[#ccbab0]/70 bg-white text-black shadow-sm"
              : "border-transparent bg-white/70 text-muted hover:bg-white hover:text-black",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
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

function reloadChangedReviewData(error: unknown): boolean {
  if (!isReviewPersistenceError(error, "DATA_VERSION_CHANGED")) return false;

  window.alert(
    error instanceof Error
      ? error.message
      : "Data sumber telah diperbarui. Muat ulang data lalu review kembali.",
  );
  window.location.reload();
  return true;
}

export function LegacyLecturerReviewPage({
  initialAnswerId,
}: {
  initialAnswerId?: string;
} = {}) {
  const { language } = useLanguage();
  const { user } = useLecturerAuth();
  const navigate = useNavigate();
  const { categories, loading: categoriesLoading } = useCategories();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<StudentAnswer[]>([]);
  const { students, loading: studentsLoading } = useStudents();
  const { misconceptions, loading: misconceptionsLoading } = useMisconceptions();
  const { tasks: answerTasks, loading: reviewTasksLoading } = useReviewTasks();
  const [reviewSession, setReviewSession] = useState<ReviewSessionState>(
    readStoredReviewSession,
  );
  const [reviewedQuestionIds, setReviewedQuestionIds] = useState<string[]>([]);
  const [savedReviewedAnswerIds, setReviewedAnswerIds] = useState<string[]>([]);
  const [queueMode, setQueueMode] = useState<"unreviewed" | "reviewed">(
    "unreviewed",
  );
  const [reviewDataRevision, setReviewDataRevision] = useState(0);
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
  const [mpQuestionReviewDirty, setMpQuestionReviewDirty] = useState(false);
  const [mpAnswerReviewDirty, setMpAnswerReviewDirty] = useState(false);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");
  const [progressLoaded, setProgressLoaded] = useState(false);
  const [questionCountsLoading, setQuestionCountsLoading] = useState(true);
  const [questionCountsError, setQuestionCountsError] = useState("");
  const [questionCountsLoaded, setQuestionCountsLoaded] = useState(false);
  const [answerCountsLoading, setAnswerCountsLoading] = useState(true);
  const [answerCountsError, setAnswerCountsError] = useState("");
  const [answerCountsLoaded, setAnswerCountsLoaded] = useState(false);
  const [questionReviewHistory, setQuestionReviewHistory] = useState<
    QuestionReviewHistoryItem[]
  >([]);
  const [answerReviewHistory, setAnswerReviewHistory] = useState<
    AnswerReviewHistoryItem[]
  >([]);
  const [questionReviewHistoryLoading, setQuestionReviewHistoryLoading] =
    useState(false);
  const [questionReviewHistoryError, setQuestionReviewHistoryError] =
    useState("");
  const [reviewSourceVersions, setReviewSourceVersions] = useState<
    ReviewSourceVersions
  >({ questions: new Map(), answers: new Map() });
  const [sourceVersionsLoading, setSourceVersionsLoading] = useState(true);
  const [sourceVersionsError, setSourceVersionsError] = useState("");
  const [sourceVersionsLoaded, setSourceVersionsLoaded] = useState(false);
  const questionsLoading = sourceVersionsLoading;
  const answersLoading = sourceVersionsLoading;

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
    if (
      (!mpQuestionReviewDirty && !mpAnswerReviewDirty) ||
      typeof window === "undefined"
    ) return;

    const preventUnsavedExit = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", preventUnsavedExit);
    return () => window.removeEventListener("beforeunload", preventUnsavedExit);
  }, [mpAnswerReviewDirty, mpQuestionReviewDirty]);

  useEffect(() => {
    let active = true;

    if (!user) {
      setQuestions([]);
      setAnswers([]);
      setReviewSourceVersions({ questions: new Map(), answers: new Map() });
      setSourceVersionsLoading(false);
      setSourceVersionsError("");
      setSourceVersionsLoaded(false);
      return () => {
        active = false;
      };
    }

    setSourceVersionsLoading(true);
    setSourceVersionsError("");
    setSourceVersionsLoaded(false);
    setQuestions([]);
    setAnswers([]);
    setReviewSourceVersions({ questions: new Map(), answers: new Map() });

    void getReviewWorkspaceSnapshot()
      .then((snapshot) => {
        if (!active) return;
        setQuestions(snapshot.questions);
        setAnswers(snapshot.answers);
        setReviewSourceVersions(snapshot.sourceVersions);
        setSourceVersionsLoaded(true);
      })
      .catch((error) => {
        if (!active) return;
        console.error("[Progmiscon] Workspace review gagal dimuat", error);
        setSourceVersionsError(
          error instanceof Error
            ? error.message
            : "Versi sumber review belum dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setSourceVersionsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user]);

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
        await getSavedReviewProgress();
        if (!active) return;
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
  }, [reviewDataRevision, user]);

  useEffect(() => {
    let active = true;

    if (!user || !sourceVersionsLoaded) {
      setQuestionReviewHistory([]);
      setAnswerReviewHistory([]);
      setQuestionReviewHistoryLoading(false);
      setQuestionReviewHistoryError("");
      return () => {
        active = false;
      };
    }

    setQuestionReviewHistory([]);
    setQuestionReviewHistoryLoading(true);
    setQuestionReviewHistoryError("");

    void getReviewerHistory(user.id)
      .then((history) => {
        if (!active) return;
        setQuestionReviewHistory(history.questionReviews);
        setAnswerReviewHistory(history.answerReviews);
        setReviewedQuestionIds(
          history.questionReviews
            .filter(
              (review) =>
                review.isActive &&
                review.sourceVersion ===
                  reviewSourceVersions.questions.get(review.questionId),
            )
            .map((review) => review.questionId),
        );
        setReviewedAnswerIds(
          history.answerReviews
            .filter((review) => {
              const source = reviewSourceVersions.answers.get(review.answerId);
              return (
                review.isActive &&
                review.sourceVersion === source?.sourceVersion &&
                review.questionId === source.questionId
              );
            })
            .map((review) => review.answerId),
        );
      })
      .catch((error) => {
        if (!active) return;
        console.error("[Progmiscon] Detail hasil review gagal dimuat", error);
        setProgressLoaded(false);
        setQuestionReviewHistoryError(
          error instanceof Error
            ? error.message
            : "Detail hasil review belum dapat dimuat.",
        );
      })
      .finally(() => {
        if (active) setQuestionReviewHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    reviewDataRevision,
    reviewSourceVersions,
    sourceVersionsLoaded,
    user,
  ]);

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
  const matchingMpQuestions = useMemo(
    () =>
      filterReviewQuestions(
        allWorkspaceItems["question-mp"],
        questionReviewCounts,
        effectiveQuestionFilters.mp,
      ),
    [
      allWorkspaceItems,
      effectiveQuestionFilters.mp,
      questionReviewCounts,
    ],
  );
  const navigableWorkspaceItems = useMemo(
    () => {
      const reviewedQuestions = new Set(reviewedQuestionIds);
      const reviewedAnswers = new Set(reviewedAnswerIds);
      const includeQuestion = (question: Question) =>
        reviewedQuestions.has(question.id) === (queueMode === "reviewed");
      const includeAnswer = (answer: StudentAnswer) =>
        reviewedAnswers.has(answer.id) === (queueMode === "reviewed");

      return {
      "question-ps": filterReviewQuestions(
        allWorkspaceItems["question-ps"],
        questionReviewCounts,
        effectiveQuestionFilters.ps,
      ).filter(includeQuestion),
      "answer-ps": allWorkspaceItems["answer-ps"],
      "question-mp": matchingMpQuestions.filter(includeQuestion),
      "answer-mp": allWorkspaceItems["answer-mp"].filter(includeAnswer),
    };
    },
    [
      allWorkspaceItems,
      effectiveQuestionFilters.ps,
      matchingMpQuestions,
      queueMode,
      questionReviewCounts,
      reviewedAnswerIds,
      reviewedQuestionIds,
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
    activeQuestionGloballyComplete && !activeQuestionReviewedByMe;
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
    activeAnswerGloballyComplete &&
    !activeAnswerReviewedByMe;
  const activeQuestionReview = activeQuestion
    ? questionReviewHistory.find(
        (review) =>
          review.questionId === activeQuestion.id &&
          review.sourceVersion === activeQuestion.sourceVersion &&
          review.isActive,
      )
    : undefined;
  const activeAnswerReview = activeAnswer
    ? answerReviewHistory.find(
        (review) =>
          review.answerId === activeAnswer.id &&
          review.questionId === activeAnswer.questionId &&
          review.sourceVersion === activeAnswer.sourceVersion &&
          review.isActive,
      )
    : undefined;
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
  const emptyMessages: Record<ReviewWorkspace, string> = {
    "question-ps":
      queueMode === "reviewed"
        ? language === "id"
          ? "Belum ada soal PS yang sudah Anda review"
          : "You have not reviewed any PS questions yet"
        : language === "id"
          ? "Tidak ada soal PS yang belum Anda review"
          : "There are no PS questions left to review",
    "answer-ps":
      language === "id"
        ? "Belum ada evidence jawaban untuk soal ini"
        : "There is no answer evidence for this question yet",
    "question-mp":
      queueMode === "reviewed"
        ? language === "id"
          ? "Belum ada soal MP yang sudah Anda review"
          : "You have not reviewed any MP questions yet"
        : language === "id"
          ? "Tidak ada soal MP yang belum Anda review"
          : "There are no MP questions left to review",
    "answer-mp":
      queueMode === "reviewed"
        ? language === "id"
          ? "Belum ada jawaban MP yang sudah Anda review"
          : "You have not reviewed any MP answers yet"
        : language === "id"
          ? "Tidak ada jawaban MP yang belum Anda review"
          : "There are no MP answers left to review",
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
  const confirmReviewNavigation = useCallback(
    (nextWorkspace: ReviewWorkspace, nextItemId: string | undefined) => {
      const warnForAnswer = shouldWarnForMpAnswerNavigation(
        mpAnswerReviewDirty,
        workspace,
        activeAnswer?.id,
        nextWorkspace,
        nextItemId,
      );
      const warnForQuestion = shouldWarnForMpQuestionNavigation(
        mpQuestionReviewDirty,
        workspace,
        activeQuestion?.id,
        nextWorkspace,
        nextItemId,
      );
      if (!warnForAnswer && !warnForQuestion) return true;

      return window.confirm(
        language === "id"
          ? `Review pada ${warnForAnswer ? "jawaban" : "soal"} ini belum disimpan. Tetap pindah?`
          : `This ${warnForAnswer ? "answer" : "question"} review has not been saved. Continue?`,
      );
    },
    [
      activeAnswer?.id,
      activeQuestion?.id,
      language,
      mpAnswerReviewDirty,
      mpQuestionReviewDirty,
      workspace,
    ],
  );
  const requestOpenWorkspaceItem = useCallback(
    (
      nextWorkspace: ReviewWorkspace,
      itemId: string | undefined,
      parentQuestionId?: string,
    ) => {
      if (!confirmReviewNavigation(nextWorkspace, itemId)) return false;
      setMpQuestionReviewDirty(false);
      setMpAnswerReviewDirty(false);
      openWorkspaceItem(nextWorkspace, itemId, parentQuestionId);
      return true;
    },
    [confirmReviewNavigation, openWorkspaceItem],
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
    getActiveReviewQuestionFilterCount(
      questionFilters[activeParentKind],
      workspace === "question-ps",
    ) > 0 &&
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
    sourceVersionsLoading ||
    questionReviewHistoryLoading ||
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
          ? `${progress.reviewed} dari ${progress.total} jawaban sudah Anda review`
          : `You have reviewed ${progress.reviewed} of ${progress.total} answers`;
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
      const nextMatchingQuestions = filterReviewQuestions(
        allWorkspaceItems["question-mp"],
        questionReviewCounts,
        questionCountsLoaded
          ? filters
          : { ...filters, status: REVIEW_FILTER_ALL },
      );
      const nextQuestionId = nextMatchingQuestions.some(
        (question) => question.id === activeQuestion?.id,
      )
        ? activeQuestion?.id
        : nextMatchingQuestions[0]?.id;

      if (
        workspace === "question-mp" &&
        !confirmReviewNavigation("question-mp", nextQuestionId)
      ) {
        return;
      }

      setQuestionFilters((current) => ({
        ...current,
        mp: filters,
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
  const viewMyReviewHistory = () => navigate("/review/riwayat");
  const selectQueueMode = (nextMode: "unreviewed" | "reviewed") => {
    if (nextMode === queueMode) return;
    if (!confirmReviewNavigation(workspace, undefined)) return;
    setMpQuestionReviewDirty(false);
    setMpAnswerReviewDirty(false);
    setQueueMode(nextMode);
  };

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

      {sourceVersionsError && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
        >
          {sourceVersionsError}
        </p>
      )}

      {questionReviewHistoryError && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
        >
          {questionReviewHistoryError}
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

        <div className="review-workspace-toolbar-meta flex-wrap">
          {workspace !== "answer-ps" && (
            <div
              className="segmented-control"
              role="tablist"
              aria-label={
                language === "id" ? "Antrian review saya" : "My review queue"
              }
            >
              <button
                type="button"
                role="tab"
                className="segmented-tab !min-h-8 !px-2.5 !py-1.5 !text-[11px]"
                aria-selected={queueMode === "unreviewed"}
                onClick={() => selectQueueMode("unreviewed")}
              >
                {language === "id" ? "Belum direview" : "Not reviewed"}
              </button>
              <button
                type="button"
                role="tab"
                className="segmented-tab !min-h-8 !px-2.5 !py-1.5 !text-[11px]"
                aria-selected={queueMode === "reviewed"}
                onClick={() => selectQueueMode("reviewed")}
              >
                {language === "id" ? "Sudah direview" : "Reviewed"}
              </button>
            </div>
          )}
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
                "min-h-8 shrink-0 justify-center !gap-1.5 !px-2.5 !py-1.5 !text-xs",
                activeFilterCount > 0 &&
                  "border-brand/45 bg-brand-soft text-brand hover:border-brand/60 hover:bg-brand-soft",
              )}
            >
              <ListFilter size={14} strokeWidth={2} aria-hidden="true" />
              <span>Filter</span>
              {activeFilterCount > 0 && (
                <span
                  aria-hidden="true"
                  className="inline-flex min-w-4 items-center justify-center rounded bg-brand px-1 py-0.5 text-[10px] leading-none text-white"
                >
                  {activeFilterCount}
                </span>
              )}
            </Button>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={viewMyReviewHistory}
            className="min-h-8 shrink-0 justify-center !gap-1.5 !px-2.5 !py-1.5 !text-xs"
          >
            <History size={14} strokeWidth={2} aria-hidden="true" />
            {language === "id" ? "Riwayat" : "History"}
          </Button>
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
                ? allWorkspaceItems["question-mp"]
                : (allActiveQuestionItems as Question[])
            }
            categories={categories}
            misconceptions={misconceptions}
            filters={questionFilters[activeParentKind]}
            panelId={filterPanelId}
            statusAvailable={questionCountsLoaded}
            statusLoading={questionCountsLoading}
            statusError={questionCountsError}
            onChange={setActiveQuestionFilters}
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
          <div>
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
          </div>
        ) : workspace === "answer-ps" && activeParentQuestion ? (
          <PsAnswerEvidenceWorkspace
            question={activeParentQuestion}
            answers={activePsEvidence}
            activeAnswerId={activeItemIds["answer-ps"]}
            students={students}
            misconceptions={misconceptions}
            error={
              sourceVersionsError
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
                progressUnavailable={
                  !progressLoaded ||
                  !sourceVersionsLoaded ||
                  Boolean(questionReviewHistoryError) ||
                  !activeQuestion.sourceVersion
                }
                reviewedByMe={activeQuestionReviewedByMe}
                globallyComplete={activeQuestionGloballyComplete}
                submittedReview={activeQuestionReview}
                submittedReviewLoading={questionReviewHistoryLoading}
                submittedReviewError={questionReviewHistoryError}
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
                onSelectMisconception={(misconceptionId) =>
                  navigate(`/miskonsepsi/${misconceptionId}`)
                }
                onDelete={async () => {
                  if (!activeQuestion.sourceVersion) {
                    throw new Error("Versi sumber soal belum tersedia.");
                  }
                  await deleteQuestionReview(
                    activeQuestion.id,
                    activeQuestion.sourceVersion,
                  );
                  setReviewedQuestionIds((current) =>
                    current.filter((id) => id !== activeQuestion.id),
                  );
                  setQuestionReviewHistory((current) =>
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
                  setQuestionReviewCounts((current) => {
                    const next = new Map(current);
                    next.set(
                      activeQuestion.id,
                      Math.max(0, (next.get(activeQuestion.id) ?? 1) - 1),
                    );
                    return next;
                  });
                  setQueueMode("unreviewed");
                  setReviewDataRevision((current) => current + 1);
                }}
                onSubmit={async (values) => {
                  if (!progressLoaded || activeQuestionLocked) return;
                  if (!user) throw new Error("Sesi dosen tidak ditemukan.");
                  if (!activeQuestion.sourceVersion) {
                    throw new Error("Versi sumber soal belum tersedia.");
                  }
                  const alreadyReviewed = reviewedQuestionIds.includes(
                    activeQuestion.id,
                  );
                  await saveQuestionReview(
                    activeQuestion.id,
                    activeQuestion.sourceVersion,
                    values,
                  );
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
                  if (alreadyReviewed) {
                    setMpQuestionReviewDirty(false);
                    setReviewDataRevision((current) => current + 1);
                    return;
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
                  setReviewDataRevision((current) => current + 1);
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
                task={answerTask}
                question={answerQuestion}
                answer={activeAnswer}
                siblingAnswerIds={(activeItems as StudentAnswer[]).map(
                  (item) => item.id,
                )}
                activeIndex={activeIndex}
                misconceptions={misconceptions}
                locked={activeAnswerLocked}
                progressUnavailable={
                  !progressLoaded ||
                  !answerCountsLoaded ||
                  !sourceVersionsLoaded ||
                  Boolean(questionReviewHistoryError) ||
                  !activeAnswer.sourceVersion
                }
                reviewedByMe={activeAnswerReviewedByMe}
                globallyComplete={activeAnswerGloballyComplete}
                submittedReview={activeAnswerReview}
                onViewHistory={viewMyReviewHistory}
                onDirtyChange={setMpAnswerReviewDirty}
                onSelectAnswer={(answerId) =>
                  requestOpenWorkspaceItem(
                    "answer-mp",
                    answerId,
                    answerQuestion.id,
                  )
                }
                onBackToQuestion={() =>
                  requestOpenWorkspaceItem(
                    answerQuestion.type === "multiple_choice"
                      ? "question-mp"
                      : "question-ps",
                    answerQuestion.id,
                  )
                }
                onDelete={async () => {
                  if (!activeAnswer.sourceVersion) {
                    throw new Error("Versi sumber jawaban belum tersedia.");
                  }
                  await deleteAnswerReview(
                    activeAnswer.id,
                    activeAnswer.sourceVersion,
                  );
                  setReviewedAnswerIds((current) =>
                    current.filter((id) => id !== activeAnswer.id),
                  );
                  setAnswerReviewHistory((current) =>
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
                  setAnswerReviewCounts((current) => {
                    const next = new Map(current);
                    next.set(
                      activeAnswer.id,
                      Math.max(0, (next.get(activeAnswer.id) ?? 1) - 1),
                    );
                    return next;
                  });
                  setQueueMode("unreviewed");
                  setReviewDataRevision((current) => current + 1);
                }}
                onSubmit={async (values) => {
                  if (
                    !progressLoaded ||
                    !answerCountsLoaded ||
                    activeAnswerLocked
                  ) return;
                  if (!user) throw new Error("Sesi dosen tidak ditemukan.");
                  if (!activeAnswer.sourceVersion) {
                    throw new Error("Versi sumber jawaban belum tersedia.");
                  }
                  const alreadyReviewed = reviewedAnswerIds.includes(
                    activeAnswer.id,
                  );
                  await saveAnswerReview(
                    activeAnswer.id,
                    answerQuestion.id,
                    activeAnswer.sourceVersion,
                    values,
                  );
                  setReviewedAnswerIds((current) =>
                    current.includes(activeAnswer.id)
                      ? current
                      : [...current, activeAnswer.id],
                  );
                  if (!alreadyReviewed) {
                    setAnswerReviewCounts((current) => {
                      const next = new Map(current);
                      next.set(
                        activeAnswer.id,
                        (next.get(activeAnswer.id) ?? 0) + 1,
                      );
                      return next;
                    });
                  }
                  if (alreadyReviewed) {
                    setMpAnswerReviewDirty(false);
                    setReviewDataRevision((current) => current + 1);
                    return;
                  }
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
                  setMpAnswerReviewDirty(false);
                  setReviewDataRevision((current) => current + 1);
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
        ? ["Review Anda aktif.", "Anda dapat mengubah atau menghapus review ini."]
        : [
            "Your review is active.",
            "You can edit or delete this review.",
          ]
      : language === "id"
        ? [
            "Review Anda aktif.",
            "Anda dapat mengubah atau menghapus review ini.",
          ]
        : [
            "Your review is active.",
            "You can edit or delete this review.",
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

function SubmittedQuestionReview({
  review,
  misconceptions,
  loading,
  loadError,
  onViewHistory,
}: {
  review?: QuestionReviewHistoryItem;
  misconceptions: Misconception[];
  loading: boolean;
  loadError: string;
  onViewHistory: () => void;
}) {
  const { language } = useLanguage();
  const misconceptionTitles = new Map(
    misconceptions.map((misconception) => [
      misconception.id,
      misconceptionLabel(misconception, language),
    ]),
  );
  const submittedAt = review ? new Date(review.updatedAt) : null;
  const submittedAtLabel =
    submittedAt && !Number.isNaN(submittedAt.getTime())
      ? new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(submittedAt)
      : review?.updatedAt;
  const emptyReason =
    language === "id"
      ? "Tidak ada alasan yang disimpan."
      : "No reason was saved.";

  const renderMisconceptions = (ids: string[], emptyText: string) =>
    ids.length > 0 ? (
      <ul className="space-y-2">
        {ids.map((id) => (
          <li
            key={id}
            className="rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold leading-5 text-navy-deep"
          >
            {misconceptionTitles.get(id) ?? id}
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-xs leading-5 text-muted">{emptyText}</p>
    );

  return (
    <>
      <div
        role="status"
        className="flex flex-col gap-4 rounded-lg bg-brand px-4 py-4 text-white sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/15">
            <LockKeyhole size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-5">
              {language === "id"
                ? "Anda sudah mereview soal ini."
                : "You have already reviewed this question."}
            </p>
            <p className="mt-1 text-xs leading-5 text-white/85">
              {language === "id"
                ? "Nilai sebelumnya telah dimuat ke form untuk dapat diperbarui."
                : "The previous values are loaded into the form for editing."}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onViewHistory}
          className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-md border border-white bg-white px-3.5 py-2 text-xs font-bold text-brand transition-colors hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {language === "id" ? "Lihat Riwayat" : "View history"}
        </button>
      </div>

      <section
        aria-labelledby="submitted-question-review-title"
        aria-busy={loading}
        className="mt-4 overflow-hidden rounded-lg border border-border bg-bg/70"
      >
        <header className="flex items-start justify-between gap-3 border-b border-border bg-white px-4 py-4">
          <div>
            <h3
              id="submitted-question-review-title"
              className="text-base font-bold text-navy-deep"
            >
              {language === "id" ? "Hasil Review Anda" : "Your Review Result"}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted">
              {language === "id"
                ? "Berikut adalah hasil review yang telah Anda kirim."
                : "Here is the review you submitted."}
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-brand/20 bg-brand-soft px-2.5 py-1.5 text-[11px] font-bold text-brand">
            <LockKeyhole size={12} strokeWidth={2} aria-hidden="true" />
            {language === "id" ? "Aktif" : "Active"}
          </span>
        </header>

        <div className="p-4">
          {loading ? (
            <div className="space-y-3" aria-label={language === "id" ? "Memuat hasil review" : "Loading review result"}>
              <div className="h-16 rounded-md bg-neutral" />
              <div className="h-16 rounded-md bg-neutral" />
              <div className="h-12 rounded-md bg-neutral" />
            </div>
          ) : !review ? (
            <div className="rounded-md border border-border bg-white px-4 py-4">
              <p className="text-sm font-semibold text-navy-deep">
                {language === "id"
                  ? "Detail review belum dapat ditampilkan."
                  : "The review details cannot be displayed yet."}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted">
                {loadError
                  ? language === "id"
                    ? "Data tersimpan tetap dapat dilihat melalui riwayat review."
                    : "The saved data remains available in review history."
                  : language === "id"
                    ? "Tidak ada rincian tersimpan untuk ditampilkan pada soal ini."
                    : "There are no saved details to show for this question."}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {submittedAtLabel && (
                <p className="flex items-center gap-2 text-xs font-medium text-muted">
                  <CalendarDays size={14} strokeWidth={2} aria-hidden="true" />
                  {language === "id" ? "Dikirim" : "Submitted"} {submittedAtLabel}
                </p>
              )}

              <div className="grid gap-3">
                <section className="rounded-md border border-border bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                        1
                      </span>
                      <p className="text-xs font-semibold leading-5 text-navy-deep">
                        {language === "id"
                          ? "Ada miskonsepsi yang tidak seharusnya dicantumkan?"
                          : "Were any listed misconceptions incorrect?"}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold",
                      review.hasIncorrectMisconceptions
                        ? "border-brand/20 bg-brand-soft text-brand"
                        : "border-border bg-neutral text-navy-deep",
                    )}>
                      {review.hasIncorrectMisconceptions
                        ? language === "id" ? "Ada" : "Yes"
                        : language === "id" ? "Tidak ada" : "None"}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    {renderMisconceptions(
                      review.removedMisconceptionIds,
                      language === "id"
                        ? "Tidak ada miskonsepsi yang dilepas."
                        : "No misconceptions were removed.",
                    )}
                    {review.hasIncorrectMisconceptions && (
                      <p className="mt-3 text-xs leading-5 text-muted">
                        <span className="font-semibold text-navy-deep">
                          {language === "id" ? "Alasan: " : "Reason: "}
                        </span>
                        {review.removalReason || emptyReason}
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-md border border-border bg-white p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                        2
                      </span>
                      <p className="text-xs font-semibold leading-5 text-navy-deep">
                        {language === "id"
                          ? "Ada miskonsepsi lain yang perlu ditambahkan?"
                          : "Were other misconceptions needed?"}
                      </p>
                    </div>
                    <span className={cn(
                      "shrink-0 rounded-md border px-2 py-1 text-[11px] font-bold",
                      review.hasAdditionalMisconceptions
                        ? "border-brand/20 bg-brand-soft text-brand"
                        : "border-border bg-neutral text-navy-deep",
                    )}>
                      {review.hasAdditionalMisconceptions
                        ? language === "id" ? "Ada" : "Yes"
                        : language === "id" ? "Tidak ada" : "None"}
                    </span>
                  </div>
                  <div className="mt-3 border-t border-border pt-3">
                    {renderMisconceptions(
                      review.additionalMisconceptionIds,
                      language === "id"
                        ? "Tidak ada miskonsepsi yang ditambahkan."
                        : "No misconceptions were added.",
                    )}
                    {review.hasAdditionalMisconceptions && (
                      <p className="mt-3 text-xs leading-5 text-muted">
                        <span className="font-semibold text-navy-deep">
                          {language === "id" ? "Alasan: " : "Reason: "}
                        </span>
                        {review.additionReason || emptyReason}
                      </p>
                    )}
                  </div>
                </section>
              </div>

              <section className="rounded-md border border-border bg-white p-3.5">
                <p className="text-xs font-semibold text-navy-deep">
                  {language === "id" ? "Komentar tambahan" : "Additional comment"}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-muted">
                  {review.note ||
                    (language === "id"
                      ? "Tidak ada komentar tambahan."
                      : "No additional comment.")}
                </p>
              </section>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export function QuestionValidationWorkspace({
  question,
  answers,
  reviewedAnswerIds,
  answerTaskById,
  misconceptions,
  locked,
  progressUnavailable,
  reviewedByMe,
  globallyComplete,
  submittedReview,
  submittedReviewLoading,
  submittedReviewError,
  readOnly = false,
  onViewHistory,
  onDirtyChange,
  onReviewAnswer,
  onSelectMisconception,
  onDelete,
  onSubmit,
}: {
  question: Question;
  answers: StudentAnswer[];
  reviewedAnswerIds: string[];
  answerTaskById: Map<string, ReviewTask>;
  misconceptions: Misconception[];
  locked: boolean;
  progressUnavailable: boolean;
  reviewedByMe: boolean;
  globallyComplete: boolean;
  submittedReview?: QuestionReviewHistoryItem;
  submittedReviewLoading: boolean;
  submittedReviewError: string;
  readOnly?: boolean;
  onViewHistory: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  onReviewAnswer?: (answerId: string) => void;
  onSelectMisconception: (misconceptionId: string) => void;
  onDelete: () => Promise<void>;
  onSubmit: (values: QuestionReviewValues) => Promise<void>;
}) {
  const { language } = useLanguage();
  const questionTitle =
    t(question.title, language).trim() ||
    `${language === "id" ? "Soal" : "Question"} ${question.number || question.id}`;
  const questionCode = question.sourceCode?.trim() || question.id;
  const displayQuestionCode = `#${questionCode.replace(/^#/, "")}`;
  const questionRemovalProposalIds = getQuestionRemovalProposalIds(
    question.questionMisconceptionIds,
  );
  const recommended = prioritizeMisconceptions(
    misconceptions,
    questionRemovalProposalIds,
  );
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
  const savedForm = useMemo(
    () => questionReviewFormState(submittedReview),
    [submittedReview],
  );
  const [form, dispatchForm] = useReducer(
    misconceptionReviewFormReducer,
    savedForm,
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
  const [deleting, setDeleting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formDirty = isMisconceptionReviewFormDirty(form, savedForm);
  const formUnavailable = readOnly || locked || progressUnavailable;
  const canSubmit =
    !formUnavailable &&
    canSubmitMisconceptionReview(form);

  useEffect(() => {
    onDirtyChange?.(formDirty);
  }, [formDirty, onDirtyChange]);

  useEffect(() => {
    dispatchForm({ type: "replace", value: savedForm });
  }, [savedForm]);

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
      onDirtyChange?.(false);
    } catch (error) {
      console.error("[Progmiscon] Validasi soal gagal disimpan", error);
      if (reloadChangedReviewData(error)) return;
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Validasi soal belum dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!reviewedByMe || deleting || submitting) return;
    if (
      !window.confirm(
        language === "id"
          ? "Hapus review soal ini? Review akan dinonaktifkan dan soal kembali ke antrian belum direview."
          : "Delete this question review? It will be deactivated and returned to the not-reviewed queue.",
      )
    ) {
      return;
    }

    setSubmitError("");
    setDeleting(true);
    try {
      await onDelete();
      onDirtyChange?.(false);
    } catch (error) {
      console.error("[Progmiscon] Review soal gagal dihapus", error);
      if (reloadChangedReviewData(error)) return;
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Review soal belum dapat dihapus.",
      );
    } finally {
      setDeleting(false);
    }
  };


  return (
    <div className="review-question-detail mt-6">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1.65fr)_minmax(22rem,1fr)] lg:items-start xl:gap-14">
        <article className="min-w-0">
          <section aria-labelledby="review-question-title">
            <header className="border-b border-border pb-5">
              <h2
                id="review-question-title"
                aria-label={`${questionTitle}, ${displayQuestionCode}`}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[1.4375rem] font-semibold leading-8 tracking-[-0.02em] text-navy-deep md:text-[1.5625rem]"
              >
                <span>{questionTitle}</span>
                <span className="text-xs font-normal leading-5 tracking-normal text-muted">
                  {displayQuestionCode}
                </span>
              </h2>
              <dl className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] font-normal leading-5">
                <div className="review-detail-meta-kc flex min-w-0 items-center gap-1.5">
                  <ListFilter size={14} strokeWidth={1.8} aria-hidden="true" className="shrink-0" />
                  <dt className="sr-only">{language === "id" ? "Konsep" : "Concepts"}</dt>
                  <dd className="min-w-0">
                    <span className="font-medium">
                      {language === "id" ? "Konsep:" : "Concepts:"}
                    </span>{" "}
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
            </header>

            <div className="mt-4"><QuestionContent question={question} /></div>
          </section>

          {question.options && (
            <section className="mt-4">
              <h3 className="mb-3 text-base font-semibold leading-6 text-navy-deep">{language === "id" ? "Pilihan jawaban" : "Answer options"}</h3>
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
                        "flex items-start gap-3 rounded-md border px-3.5 py-2.5 text-xs font-normal leading-5",
                        option.isCorrect
                          ? "border-correct-border bg-correct-bg"
                          : "border-border bg-white",
                      )}
                    >
                      <span className="font-medium text-navy-deep">{option.label}.</span>
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
                        <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded border border-correct-border bg-white/70 px-2 py-0.5 text-[10px] font-medium text-correct">
                          <Check size={11} strokeWidth={3} aria-hidden="true" />
                          {language === "id" ? "Jawaban yang benar" : "Correct answer"}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="mt-4 border-t border-border pt-4">
            <h3 className="flex items-center gap-1.5 text-base font-semibold leading-6 tracking-[-0.01em] text-navy-deep">
              <span className="flex h-6 w-5 shrink-0 items-center justify-center" aria-hidden="true">
                <TriangleAlert size={16} strokeWidth={1.9} className="text-brand" />
              </span>
              <span>
                {language === "id"
                  ? "Miskonsepsi terkait"
                  : "Related misconceptions"}
              </span>
            </h3>
            {recommended.length > 0 ? (
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {recommended.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectMisconception(item.id)}
                    className="group/misconception relative min-h-[4.5rem] overflow-hidden rounded-md border border-brand/20 bg-brand-soft/35 px-3 py-2.5 text-left transition-[border-color,background-color,transform] duration-150 hover:-translate-y-px hover:border-brand/40 hover:bg-brand-soft/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-0 motion-reduce:translate-y-0"
                  >
                    <span aria-hidden="true" className="absolute -right-3 -top-3 h-12 w-12 rounded-full bg-brand/[0.055]" />
                    <ArrowRight size={13} strokeWidth={1.8} aria-hidden="true" className="absolute right-2.5 top-2.5 text-brand transition-transform duration-150 group-hover/misconception:translate-x-0.5 motion-reduce:translate-x-0" />
                    <span className="relative block font-mono text-[11px] font-normal leading-4 text-brand">
                      {item.id}
                    </span>
                    <span className="relative mt-0.5 block pr-4 text-xs font-normal leading-[18px] text-navy-deep">
                      {t(item.title, language)}
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-muted">
                {t(uiText.emptyMisconceptions, language)}
              </p>
            )}
          </section>

          <section
            className="mt-6 border-t border-border pt-5"
            aria-labelledby="related-answers-title"
          >
            <details
              open={answerReviewEligible || undefined}
              className="group/evidence"
            >
              {answerReviewEligible ? (
                <h3
                  id="related-answers-title"
                  className="text-base font-semibold leading-6 text-navy-deep"
                >
                  {language === "id" ? "Jawaban terkait" : "Related answers"}
                </h3>
              ) : (
                <summary
                  id="related-answers-title"
                  className="flex min-h-9 w-fit cursor-pointer list-none items-center gap-2 rounded-md border border-[#ccbab0] bg-[var(--review-page)] px-3 py-2 text-xs font-medium leading-5 text-black transition-[background-color,border-color,color] duration-150 hover:border-[#b09f85] hover:bg-[var(--review-secondary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden"
                >
                  {language === "id" ? "Lihat evidence" : "View evidence"}
                  <span className="tabular-nums text-muted">
                    ({relatedAnswers.length})
                  </span>
                  <ChevronDown
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="transition-transform duration-150 group-open/evidence:rotate-180"
                  />
                </summary>
              )}

              <div className="review-evidence-disclosure">
            {relatedAnswers.length > 0 ? (
              <ul className="mt-3 grid min-w-0 gap-3">
                {relatedAnswers.map((answer) => {
                  const { option, fallbackText } = resolveAnswerSelection(
                    question,
                    answer,
                  );
                  const optionLabel = option?.label;
                  const answerText = option
                    ? t(option.text, language)
                    : stripSelectedOptionPrefix(fallbackText, optionLabel);
                  const answerReviewed =
                    answerReviewEligible && reviewedAnswers.has(answer.id);
                  const answerReviewStatus = answerReviewEligible
                    ? answerReviewed
                      ? language === "id"
                        ? "Sudah direview"
                        : "Reviewed"
                      : language === "id"
                        ? "Belum direview"
                        : "Not reviewed"
                    : "Evidence";
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
                      className="flex min-w-0 flex-col rounded-r-lg border border-border border-l-2 border-l-brand/45 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className="text-xs font-normal leading-[18px] text-muted">
                          {optionLabel
                            ? `${language === "id" ? "Opsi" : "Option"} ${optionLabel}`
                            : language === "id"
                              ? "Jawaban"
                              : "Answer"}
                        </p>
                        <span
                          className={cn(
                            "inline-flex shrink-0 items-center gap-1 text-[10px] font-medium tracking-[0.04em]",
                            answerReviewed ? "text-brand" : "text-muted",
                          )}
                        >
                          <span
                            aria-hidden="true"
                            className={cn(
                              "h-1.5 w-1.5 rounded-full",
                              answerReviewed ? "bg-brand" : "bg-muted/55",
                            )}
                          />
                          {answerReviewStatus}
                        </span>
                      </div>

                      {question.type === "multiple_choice" ? (
                        <p className="mt-3 break-words rounded bg-neutral/70 px-3 py-2.5 text-xs font-normal leading-5 text-navy-deep">
                          {answerText ||
                              (language === "id"
                                ? "Teks jawaban tidak tersedia."
                                : "Answer text is unavailable.")}
                        </p>
                      ) : (
                        <pre className="mt-3 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded-md border border-[#ccbab0]/70 bg-[var(--review-secondary-soft)] p-3 font-mono text-xs leading-5 text-black">
                          {snippet ||
                            (language === "id"
                              ? "Teks jawaban tidak tersedia."
                              : "Answer text is unavailable.")}
                        </pre>
                      )}

                      {linkedMisconceptions.length > 0 && (
                        <div className="mt-4 border-t border-border pt-4">
                          <MisconceptionReasonCards
                            misconceptions={linkedMisconceptions}
                            mappedReasons={[
                              ...(answer.misconceptionReasons ?? []).map((item) => ({
                                misconceptionId: item.misconceptionId,
                                reasons: [item.reason],
                              })),
                              ...(answer.evidenceReasons ?? []).map((item) => ({
                                misconceptionId: item.misconceptionId,
                                reasons: [item.reason],
                              })),
                              ...(task?.suggestedMisconceptionId
                                ? [{
                                    misconceptionId: task.suggestedMisconceptionId,
                                    reasons: [task.explanation],
                                  }]
                                : []),
                            ]}
                            generalReasons={answer.explanation ? [answer.explanation] : []}
                          />
                        </div>
                      )}

                      {!readOnly && answerReviewEligible && onReviewAnswer && (
                      <button
                        type="button"
                        onClick={() => onReviewAnswer(answer.id)}
                        className="mt-4 inline-flex w-fit items-center gap-1 rounded-sm text-xs font-medium leading-5 text-brand transition-[color,transform] duration-150 hover:translate-x-0.5 hover:text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-x-0 motion-reduce:translate-x-0"
                      >
                        {language === "id" ? "Review jawaban" : "Review answer"}
                        <span aria-hidden="true">→</span>
                      </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-xs leading-5 text-muted">
                {language === "id"
                  ? "Belum ada jawaban terkait untuk soal ini"
                  : "There are no related answers for this question"}
              </p>
            )}
              </div>
            </details>
          </section>
        </article>

        <aside className="relative rounded-xl border border-[#ccbab0] border-t-2 border-t-brand bg-white p-5 shadow-[0_18px_48px_rgba(176,159,133,0.12)] md:p-6">
          <CircleCheckBig aria-hidden="true" strokeWidth={1.15} className="pointer-events-none absolute right-2 top-2 h-36 w-36 -rotate-6 text-brand/[0.045]" />
          {reviewedByMe && (
            <SubmittedQuestionReview
              review={submittedReview}
              misconceptions={misconceptions}
              loading={submittedReviewLoading}
              loadError={submittedReviewError}
              onViewHistory={onViewHistory}
            />
          )}
          <p
            className={cn(
              "relative text-base font-semibold leading-6 tracking-[-0.01em] text-navy-deep",
              reviewedByMe && "mt-5",
            )}
          >
            {language === "id"
              ? "REVIEW MISKONSEPSI SOAL"
              : "QUESTION MISCONCEPTION REVIEW"}
          </p>

          {progressUnavailable ? (
            <ReviewProgressUnavailableNotice />
          ) : readOnly ? (
            <div
              role="status"
              className="mt-3 rounded-md border border-[#b09f85]/35 bg-[#b09f85]/10 px-3 py-2.5 text-xs leading-5 text-muted"
            >
              {reviewedByMe
                ? language === "id"
                  ? "Mode lihat. Review Anda ditampilkan hanya-baca."
                  : "View mode. Your review is shown read-only."
                : language === "id"
                  ? "Batas 3 reviewer telah tercapai. Soal ditampilkan hanya-baca."
                  : "The 3-reviewer limit has been reached. This question is shown read-only."}
            </div>
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
              "mt-5 space-y-5",
              formUnavailable && "opacity-65",
            )}
          >
            <legend className="sr-only">
              {language === "id"
                ? "Isian validasi soal"
                : "Question validation fields"}
            </legend>
            <section aria-labelledby="remove-misconception-question">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand text-xs font-medium leading-5 text-white" aria-hidden="true">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p id="remove-misconception-question" className="text-xs font-normal leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi yang tidak seharusnya dicantumkan?"
                      : "Are any misconceptions listed that should not be included?"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
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
                <div className="ml-[1.875rem] mt-3 space-y-3 rounded-md border border-brand/15 bg-brand-soft/35 p-2.5">
                  <fieldset>
                    <legend className="text-xs font-normal leading-5 text-navy-deep">
                      {language === "id" ? "Pilih yang perlu dihapus" : "Select items to remove"}
                    </legend>
                    <div className="mt-2 space-y-2">
                      {recommended.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-brand/15 bg-white px-2.5 py-2 text-xs font-normal leading-4 text-navy-deep">
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
                            <span className="block font-mono text-[11px] font-normal leading-4 text-brand">
                              {item.id}
                            </span>
                            <span className="mt-0.5 block text-xs font-normal leading-4 text-navy-deep">
                              {t(item.title, language)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label htmlFor="removal-reason" className="block text-xs font-normal text-navy-deep">
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
                    className="academic-input min-h-16 resize-y px-3 py-2 text-xs placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-5" aria-labelledby="add-misconception-question">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand text-xs font-medium leading-5 text-white" aria-hidden="true">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p id="add-misconception-question" className="text-xs font-normal leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi lain yang perlu ditambahkan?"
                      : "Should any other misconceptions be added?"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
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
                <div className="ml-[1.875rem] mt-3 space-y-3 rounded-md border border-brand/15 bg-brand-soft/35 p-2.5">
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
                  />

                  <label htmlFor="addition-reason" className="block text-xs font-normal text-navy-deep">
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
                    className="academic-input min-h-16 resize-y px-3 py-2 text-xs placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-5" aria-labelledby="additional-comment-label">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand text-xs font-medium leading-5 text-white" aria-hidden="true">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <label id="additional-comment-label" htmlFor="question-validation-note" className="block text-xs font-normal leading-5 text-navy-deep">
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
                    placeholder={language === "id" ? "Komentar.." : "Comment.."}
                    className="academic-input mt-2 min-h-16 resize-y px-3 py-2 text-xs placeholder:text-muted/65"
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

          {!formUnavailable && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting || deleting}
              className="mt-4 w-full justify-center !font-medium"
            >
              {submitting
                ? language === "id"
                  ? "Menyimpan..."
                  : "Saving..."
                : language === "id"
                  ? reviewedByMe
                    ? "Simpan Perubahan"
                    : question.type === "multiple_choice"
                      ? "Simpan & Lanjut ke Review Jawaban"
                      : "Simpan & Selesai"
                  : reviewedByMe
                    ? "Save Changes"
                    : question.type === "multiple_choice"
                      ? "Save & Continue to Answer Review"
                      : "Save & Finish"}
            </Button>
          )}
          {reviewedByMe && !formUnavailable && (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={deleting || submitting}
              className="mt-2 w-full justify-center !font-medium"
            >
              <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
              {deleting
                ? language === "id"
                  ? "Menghapus..."
                  : "Deleting..."
                : language === "id"
                  ? "Hapus review"
                  : "Delete review"}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}

export function AnswerValidationWorkspace({
  task,
  question,
  answer,
  siblingAnswerIds,
  activeIndex,
  misconceptions,
  locked,
  progressUnavailable,
  reviewedByMe,
  globallyComplete,
  isFinalAnswer = false,
  submittedReview,
  onViewHistory,
  onDirtyChange,
  onSelectAnswer,
  onBackToQuestion,
  onDelete,
  onSubmit,
}: {
  task?: ReviewTask;
  question: Question;
  answer: StudentAnswer;
  siblingAnswerIds: string[];
  activeIndex: number;
  misconceptions: Misconception[];
  locked: boolean;
  progressUnavailable: boolean;
  reviewedByMe: boolean;
  globallyComplete: boolean;
  isFinalAnswer?: boolean;
  submittedReview?: AnswerReviewHistoryItem;
  onViewHistory: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onSelectAnswer: (answerId: string) => void;
  onBackToQuestion: () => void;
  onDelete: () => Promise<void>;
  onSubmit: (values: AnswerReviewValues) => Promise<void>;
}) {
  const { language } = useLanguage();
  const {
    option: selectedOption,
    fallbackText,
    missingSelectedOption,
  } = resolveAnswerSelection(question, answer);
  const linkedMisconceptions = prioritizeMisconceptions(misconceptions, [
    ...(selectedOption
      ? getQuestionOptionMisconceptionIds(selectedOption)
      : []),
    ...(task?.suggestedMisconceptionId
      ? [task.suggestedMisconceptionId]
      : []),
    ...answer.studentMisconceptionIds,
    ...(answer.evidenceReasons ?? []).map((item) => item.misconceptionId),
  ]);
  const addableMisconceptions = getAdditionalMisconceptionCandidates(
    misconceptions,
    linkedMisconceptions.map((item) => item.id),
  );
  const similarMisconceptions = prioritizeMisconceptions(
    addableMisconceptions,
    linkedMisconceptions.flatMap((item) => item.relatedMisconceptionIds),
  );
  const savedForm = useMemo(
    () => answerReviewFormState(submittedReview),
    [submittedReview],
  );
  const [form, dispatchForm] = useReducer(
    misconceptionReviewFormReducer,
    savedForm,
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
  const [deleting, setDeleting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formUnavailable = locked || progressUnavailable;
  const canSubmit =
    !formUnavailable &&
    canSubmitMisconceptionReview(form);
  const formDirty = isMisconceptionReviewFormDirty(form, savedForm);
  const parentReference = /^q/i.test(question.number)
    ? question.number
    : `Q${question.number || question.id}`;
  const mappedReasons = [
    ...(answer.misconceptionReasons ?? []).map((item) => ({
      misconceptionId: item.misconceptionId,
      reasons: [item.reason],
    })),
    ...(answer.evidenceReasons ?? []).map((item) => ({
      misconceptionId: item.misconceptionId,
      reasons: [item.reason],
    })),
    ...(task?.suggestedMisconceptionId
      ? [{
          misconceptionId: task.suggestedMisconceptionId,
          reasons: [task.explanation],
        }]
      : []),
  ];
  useEffect(() => {
    onDirtyChange(formDirty);
    return () => onDirtyChange(false);
  }, [formDirty, onDirtyChange]);

  useEffect(() => {
    dispatchForm({ type: "replace", value: savedForm });
  }, [savedForm]);

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
      if (reloadChangedReviewData(error)) return;
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Validasi jawaban belum dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!reviewedByMe || deleting || submitting) return;
    if (
      !window.confirm(
        language === "id"
          ? "Hapus review jawaban ini? Review akan dinonaktifkan dan jawaban kembali ke antrian belum direview."
          : "Delete this answer review? It will be deactivated and returned to the not-reviewed queue.",
      )
    ) {
      return;
    }

    setSubmitError("");
    setDeleting(true);
    try {
      await onDelete();
      onDirtyChange(false);
    } catch (error) {
      console.error("[Progmiscon] Review jawaban gagal dihapus", error);
      if (reloadChangedReviewData(error)) return;
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Review jawaban belum dapat dihapus.",
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="scroll-reveal review-folder-content">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <article className="review-folder-primary min-w-0 overflow-hidden rounded-lg border border-border bg-white p-5 md:p-7">
          <div className="mb-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <ParentQuestionBackAction
              language={language}
              onClick={onBackToQuestion}
            />
            <SiblingNavigator
              kind="answer"
              index={activeIndex}
              total={siblingAnswerIds.length}
              language={language}
              onPrevious={() =>
                activeIndex > 0 &&
                onSelectAnswer(siblingAnswerIds[activeIndex - 1])
              }
              onNext={() =>
                activeIndex < siblingAnswerIds.length - 1 &&
                onSelectAnswer(siblingAnswerIds[activeIndex + 1])
              }
            />
          </div>

          <header className="pb-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-brand">
              {language === "id" ? "REVIEW JAWABAN" : "ANSWER REVIEW"}
            </p>
            <h1 className="mt-1.5 text-lg font-semibold leading-7 text-navy-deep">
              {t(question.title, language)}
            </h1>
            <p className="mt-1 text-xs font-medium tabular-nums text-muted">
              {language === "id"
                ? `Jawaban ${activeIndex + 1} dari ${siblingAnswerIds.length}`
                : `Answer ${activeIndex + 1} of ${siblingAnswerIds.length}`}
            </p>
            <div className="mt-5 min-w-0 rounded-md border border-[#ccbab0] bg-[var(--review-page)] px-4 py-3">
              <p className="text-xs font-medium text-muted">
                {language === "id" ? "Jawaban yang sedang direview" : "Answer being reviewed"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-base font-semibold leading-6 text-navy-deep">
                {selectedOption ? (
                  <>
                    <span>{selectedOption.label}.</span>{" "}
                    {t(selectedOption.text, language)}
                  </>
                ) : (
                  fallbackText ||
                  (language === "id"
                    ? "Teks jawaban tidak tersedia."
                    : "Answer text is unavailable.")
                )}
              </p>
            </div>
          </header>

          <div className="overflow-hidden rounded-md border border-border">
            <AnswerStatusBar status={answer.status} />
          </div>

          {missingSelectedOption && (
            <p
              role="status"
              className="mt-4 rounded-md border border-warning-border bg-warning-bg px-3 py-2 text-xs leading-5 text-warning"
            >
              {language === "id"
                ? "Opsi yang dipilih tidak ditemukan. Teks jawaban ditampilkan sebagai fallback."
                : "The selected option could not be found. The answer text is shown as a fallback."}
            </p>
          )}

          <div className="mt-5">
            <QuestionContextAccordion
              id={`mp-question-context-${question.id}`}
              label={
                language === "id"
                  ? "Lihat soal & pilihan jawaban"
                  : "View question & answer options"
              }
            >
              <p className="text-xs font-bold text-muted">
                {parentReference} / {t(question.title, language)}
              </p>
              <div className="mt-3"><QuestionContent question={question} /></div>
              {question.options && (
                <ul className="mt-4 space-y-2">
                  {question.options.map((option) => {
                    const isCurrent = option.id === selectedOption?.id;
                    return (
                      <li
                        key={option.id}
                        className={cn(
                          "flex items-start gap-2 rounded-md border px-3 py-2.5 text-sm leading-6 text-navy-deep",
                          isCurrent
                            ? "border-brand/35 bg-brand-soft/45"
                            : option.isCorrect
                              ? "border-correct-border bg-correct-bg"
                              : "border-border bg-bg",
                        )}
                      >
                        <span className="shrink-0 font-semibold">
                          {option.label}.
                        </span>
                        <span className="min-w-0 flex-1">
                          {t(option.text, language)}
                        </span>
                        <span className="flex shrink-0 flex-wrap justify-end gap-1">
                          {option.isCorrect && (
                            <span className="rounded border border-correct-border bg-white/70 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-correct">
                              {language === "id" ? "Jawaban benar" : "Correct answer"}
                            </span>
                          )}
                          {isCurrent && (
                            <span className="rounded border border-brand/25 bg-white/70 px-1.5 py-0.5 text-[10px] font-medium leading-4 text-brand">
                              {language === "id" ? "Sedang direview" : "In review"}
                            </span>
                          )}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </QuestionContextAccordion>
          </div>

          {(linkedMisconceptions.length > 0 || mappedReasons.length > 0 || answer.explanation) && (
            <div className="mt-3">
              <QuestionContextAccordion
                id={`mp-answer-evidence-${answer.id}`}
                label={language === "id" ? "Lihat evidence" : "View evidence"}
              >
                <MisconceptionReasonCards
                  misconceptions={linkedMisconceptions}
                  mappedReasons={mappedReasons}
                  generalReasons={answer.explanation ? [answer.explanation] : []}
                />
              </QuestionContextAccordion>
            </div>
          )}
        </article>

        <aside className="rounded-lg border border-border bg-white p-5 md:p-6">
          <p className="text-sm font-bold uppercase tracking-[0.04em] text-navy-deep">
            {language === "id"
              ? "REVIEW MISKONSEPSI JAWABAN"
              : "ANSWER MISCONCEPTION REVIEW"}
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
              "mt-5 space-y-5",
              formUnavailable && "opacity-65",
            )}
          >
            <legend className="sr-only">
              {language === "id"
                ? "Isian validasi jawaban"
                : "Answer validation fields"}
            </legend>
            <section aria-labelledby="remove-answer-misconception-question">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand text-xs font-medium leading-5 text-white" aria-hidden="true">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p id="remove-answer-misconception-question" className="text-xs font-normal leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi terkait yang tidak sesuai dengan jawaban ini?"
                      : "Are any linked misconceptions inconsistent with this answer?"}
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
                        ? "Apakah ada miskonsepsi terkait yang tidak sesuai dengan jawaban ini?"
                        : "Are any linked misconceptions inconsistent with this answer?"
                    }
                  />
                </div>
              </div>

              {hasMismatchedMisconceptions && (
                <div className="ml-[1.875rem] mt-3 space-y-3 rounded-md border border-brand/15 bg-brand-soft/35 p-2.5">
                  <fieldset>
                    <legend className="text-xs font-normal leading-5 text-navy-deep">
                      {language === "id" ? "Pilih miskonsepsi yang sebaiknya dilepas" : "Select misconceptions to unlink"}
                    </legend>
                    <div className="mt-2 space-y-2">
                      {linkedMisconceptions.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-brand/15 bg-white px-2.5 py-2 text-xs font-normal leading-4 text-navy-deep">
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
                            <span className="block font-mono text-[11px] font-normal leading-4 text-brand">
                              {item.id}
                            </span>
                            <span className="mt-0.5 block text-xs font-normal leading-4 text-navy-deep">
                              {t(item.title, language)}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label htmlFor="answer-removal-reason" className="block text-xs font-normal leading-5 text-navy-deep">
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
                    className="academic-input min-h-16 resize-y px-3 py-2 text-xs placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-5" aria-labelledby="add-answer-misconception-question">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand text-xs font-medium leading-5 text-white" aria-hidden="true">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p id="add-answer-misconception-question" className="text-xs font-normal leading-5 text-navy-deep">
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
                <div className="ml-[1.875rem] mt-3 space-y-3 rounded-md border border-brand/15 bg-brand-soft/35 p-2.5">
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
                  />

                  <label htmlFor="answer-addition-reason" className="block text-xs font-normal leading-5 text-navy-deep">
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
                    className="academic-input min-h-16 resize-y px-3 py-2 text-xs placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-5" aria-labelledby="answer-additional-comment-label">
              <div className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-brand text-xs font-medium leading-5 text-white" aria-hidden="true">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <label id="answer-additional-comment-label" htmlFor="answer-validation-note" className="block text-xs font-normal leading-5 text-navy-deep">
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
                    placeholder={language === "id" ? "Komentar.." : "Comment.."}
                    className="academic-input mt-2 min-h-16 resize-y px-3 py-2 text-xs placeholder:text-muted/65"
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

          {!formUnavailable && (
            <Button
              variant="primary"
              onClick={handleSubmit}
              disabled={!canSubmit || submitting || deleting}
              className="mt-4 w-full justify-center"
            >
              {submitting
                ? language === "id"
                  ? "Menyimpan..."
                  : "Saving..."
                : language === "id"
                  ? reviewedByMe
                    ? "Simpan Perubahan"
                    : isFinalAnswer
                      ? "Simpan & Selesai"
                      : "Simpan & Lanjut"
                  : reviewedByMe
                    ? "Save Changes"
                    : isFinalAnswer
                      ? "Save & Finish"
                      : "Save & Continue"}
            </Button>
          )}
          {reviewedByMe && !formUnavailable && (
            <Button
              type="button"
              variant="danger"
              onClick={handleDelete}
              disabled={deleting || submitting}
              className="mt-2 w-full justify-center"
            >
              <Trash2 size={15} strokeWidth={2} aria-hidden="true" />
              {deleting
                ? language === "id"
                  ? "Menghapus..."
                  : "Deleting..."
                : language === "id"
                  ? "Hapus review"
                  : "Delete review"}
            </Button>
          )}
        </aside>
      </div>
    </div>
  );
}
