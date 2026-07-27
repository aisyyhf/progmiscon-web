import { useEffect, useMemo, useState } from "react";
import { LockKeyhole } from "lucide-react";
import { AnswerStatusBar } from "../components/review/AnswerStatusBar";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { MisconceptionPicker } from "../components/review/MisconceptionPicker";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { useQuestions } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
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
import { prioritizeMisconceptions, sortReviewTasks } from "../utils/reviewPriority";
import { t } from "../utils/translation";
import { misconceptionLabel } from "../utils/misconceptionLabel";
import {
  getReviewProgress as getSavedReviewProgress,
  saveAnswerReview,
  saveQuestionReview,
} from "../services/reviewPersistenceRepository";
import { PseudocodeBlock } from "../components/review/PseudocodeBlock";
import {
  classifyReviewItems,
  getReviewProgress,
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

export function LecturerReviewPage() {
  const { language } = useLanguage();
  const { user } = useLecturerAuth();
  const { questions, loading: questionsLoading } = useQuestions();
  const { answers, loading: answersLoading } = useAllStudentAnswers();
  const { misconceptions, loading: misconceptionsLoading } = useMisconceptions();
  const { tasks: answerTasks, loading: reviewTasksLoading } = useReviewTasks();
  const [reviewSession, setReviewSession] = useState<ReviewSessionState>(
    readStoredReviewSession,
  );
  const [reviewedQuestionIds, setReviewedQuestionIds] = useState<string[]>([]);
  const [reviewedAnswerIds, setReviewedAnswerIds] = useState<string[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");

  useEffect(() => {
    let active = true;

    const loadProgress = async () => {
      if (!user) {
        if (active) {
          setReviewedQuestionIds([]);
          setReviewedAnswerIds([]);
          setProgressLoading(false);
        }
        return;
      }

      setProgressLoading(true);
      setProgressError("");

      try {
        const progress = await getSavedReviewProgress();
        if (!active) return;
        setReviewedQuestionIds(progress.questionIds);
        setReviewedAnswerIds(progress.answerIds);
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

    void loadProgress();

    return () => {
      active = false;
    };
  }, [user]);

  const { items: classifiedItems, questionById } = useMemo(
    () => classifyReviewItems(questions, answers),
    [answers, questions],
  );
  const workspaceItems = useMemo(
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
  const answerTaskById = useMemo(
    () => new Map(answerTasks.map((task) => [task.answerCaseId, task])),
    [answerTasks],
  );
  const normalizedReviewSession = useMemo(
    () =>
      normalizeReviewSessionState(
        reviewSession,
        workspaceItems,
        questionById,
        reviewedQuestionIds,
        reviewedAnswerIds,
      ),
    [
      questionById,
      reviewSession,
      reviewedAnswerIds,
      reviewedQuestionIds,
      workspaceItems,
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
      workspaceItems["question-ps"],
      reviewedQuestionIds,
    ),
    "answer-ps": getReviewProgress(
      workspaceItems["answer-ps"],
      reviewedAnswerIds,
    ),
    "question-mp": getReviewProgress(
      workspaceItems["question-mp"],
      reviewedQuestionIds,
    ),
    "answer-mp": getReviewProgress(
      workspaceItems["answer-mp"],
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
          workspaceItems[workspace] as StudentAnswer[],
        )
      : workspaceItems[workspace];
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
        workspaceItems[activeAnswerWorkspace],
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
      language === "id" ? "Belum ada jawaban PS" : "There are no PS answers yet",
    "question-mp":
      language === "id" ? "Belum ada soal MP" : "There are no MP questions yet",
    "answer-mp":
      language === "id" ? "Belum ada jawaban MP" : "There are no MP answers yet",
  };
  const openWorkspaceItem = (
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
              workspaceItems[getPairedWorkspace(nextWorkspace)] as StudentAnswer[],
              reviewedAnswerIds,
            )
          : undefined,
      );
    } else {
      const selectedAnswer = (
        workspaceItems[nextWorkspace] as StudentAnswer[]
      ).find(
        (answer) => answer.id === itemId,
      );
      nextParentQuestionIds[kind] =
        parentQuestionId ?? selectedAnswer?.questionId;
    }

    setReviewSession({
      workspace: nextWorkspace,
      activeItemIds: nextActiveItemIds,
      activeParentQuestionIds: nextParentQuestionIds,
    });
  };
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

    const nextItems = workspaceItems[nextWorkspace];
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
        nextItemId = linkedAnswerId ?? nextItemId;
        nextParentQuestionId = linkedAnswerId
          ? activeQuestion.id
          : (nextItems as StudentAnswer[]).find(
              (answer) => answer.id === nextItemId,
            )?.questionId ?? activeQuestion.id;
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

    openWorkspaceItem(nextWorkspace, nextItemId, nextParentQuestionId);
  };
  const selectOffset = (offset: number) => {
    openWorkspaceItem(
      workspace,
      activeItems[activeIndex + offset]?.id,
      activeParentQuestionId,
    );
  };
  const progress = workspaceProgress[workspace];
  const hasActiveItem =
    activeIndex >= 0 &&
    (activeQuestion !== undefined ||
      (activeAnswer !== undefined && answerQuestion !== undefined));
  const loading =
    questionsLoading ||
    answersLoading ||
    misconceptionsLoading ||
    reviewTasksLoading ||
    progressLoading;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="page-title">Review</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          {language === "id"
            ? "Validasi hubungan antara soal, jawaban mahasiswa, dan miskonsepsi."
            : "Validate the relationship between questions, student answers, and misconceptions."}
        </p>
      </header>

      {progressError && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
        >
          {progressError}
        </p>
      )}

      <div
        className="review-workspace-tabs segmented-control w-full"
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

      <section
        id="review-workspace-panel"
        role="tabpanel"
        aria-label={activeTab.label}
      >
        {loading ? (
          <EmptyState
            loading
            message={
              language === "id"
                ? "Memuat tugas validasi..."
                : "Loading validation tasks..."
            }
          />
        ) : hasActiveItem ? (
          <>
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

            {activeQuestion ? (
              <QuestionValidationWorkspace
                key={activeQuestion.id}
                question={activeQuestion}
                answers={
                  workspaceItems[
                    activeQuestion.type === "multiple_choice"
                      ? "answer-mp"
                      : "answer-ps"
                  ]
                }
                reviewedAnswerIds={reviewedAnswerIds}
                answerTaskById={answerTaskById}
                misconceptions={misconceptions}
                onReviewAnswer={(answerId) =>
                  openWorkspaceItem(
                    activeQuestion.type === "multiple_choice"
                      ? "answer-mp"
                      : "answer-ps",
                    answerId,
                    activeQuestion.id,
                  )
                }
                onSubmit={async (values) => {
                  if (!user) throw new Error("Sesi dosen tidak ditemukan.");
                  await saveQuestionReview(user.id, activeQuestion.id, values);
                  setReviewedQuestionIds((current) =>
                    current.includes(activeQuestion.id)
                      ? current
                      : [...current, activeQuestion.id],
                  );
                  const target = selectAfterQuestionReview(
                    activeQuestion,
                    workspaceItems[
                      activeQuestion.type === "multiple_choice"
                        ? "question-mp"
                        : "question-ps"
                    ],
                    workspaceItems[
                      activeQuestion.type === "multiple_choice"
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
            ) : activeAnswer && answerQuestion ? (
              <AnswerValidationWorkspace
                key={activeAnswer.id}
                task={answerTask}
                question={answerQuestion}
                answer={activeAnswer}
                misconceptions={misconceptions}
                onBackToQuestion={() =>
                  openWorkspaceItem(
                    answerQuestion.type === "multiple_choice"
                      ? "question-mp"
                      : "question-ps",
                    answerQuestion.id,
                  )
                }
                onSubmit={async (values) => {
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
                  const target = selectAfterAnswerReview(
                    answerQuestion,
                    activeAnswer.id,
                    workspaceItems[
                      answerQuestion.type === "multiple_choice"
                        ? "question-mp"
                        : "question-ps"
                    ],
                    workspaceItems[
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
  );
}

function QuestionValidationWorkspace({
  question,
  answers,
  reviewedAnswerIds,
  answerTaskById,
  misconceptions,
  onReviewAnswer,
  onSubmit,
}: {
  question: Question;
  answers: StudentAnswer[];
  reviewedAnswerIds: string[];
  answerTaskById: Map<string, ReviewTask>;
  misconceptions: Misconception[];
  onReviewAnswer: (answerId: string) => void;
  onSubmit: (values: QuestionReviewValues) => Promise<void>;
}) {
  const { language } = useLanguage();
  const reference = getQuestionReference(question);
  const recommended = prioritizeMisconceptions(misconceptions, question.questionMisconceptionIds);
  const misconceptionById = new Map(
    misconceptions.map((item) => [item.id, item]),
  );
  const currentMisconceptionIds = new Set(recommended.map((item) => item.id));
  const addableMisconceptions = misconceptions.filter((item) => !currentMisconceptionIds.has(item.id));
  const similarMisconceptions = prioritizeMisconceptions(
    addableMisconceptions,
    recommended.flatMap((item) => item.relatedMisconceptionIds),
  );
  const relatedAnswers = getAnswersForQuestion(question.id, answers);
  const reviewedAnswers = new Set(reviewedAnswerIds);
  const [hasIncorrectMisconceptions, setHasIncorrectMisconceptions] = useState<boolean | null>(null);
  const [removedMisconceptionIds, setRemovedMisconceptionIds] = useState<string[]>([]);
  const [removalReason, setRemovalReason] = useState("");
  const [hasAdditionalMisconceptions, setHasAdditionalMisconceptions] = useState<boolean | null>(null);
  const [additionalMisconceptionIds, setAdditionalMisconceptionIds] = useState<string[]>([]);
  const [additionReason, setAdditionReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const canSubmit =
    hasIncorrectMisconceptions !== null &&
    hasAdditionalMisconceptions !== null &&
    (!hasIncorrectMisconceptions || (removedMisconceptionIds.length > 0 && removalReason.trim().length > 0)) &&
    (!hasAdditionalMisconceptions || (additionalMisconceptionIds.length > 0 && additionReason.trim().length > 0));

  const handleSubmit = async () => {
    if (
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
      await onSubmit({
        hasIncorrectMisconceptions,
        removedMisconceptionIds: hasIncorrectMisconceptions
          ? removedMisconceptionIds
          : [],
        removalReason: hasIncorrectMisconceptions
          ? removalReason.trim()
          : null,
        hasAdditionalMisconceptions,
        additionalMisconceptionIds: hasAdditionalMisconceptions
          ? additionalMisconceptionIds
          : [],
        additionReason: hasAdditionalMisconceptions
          ? additionReason.trim()
          : null,
        note: note.trim() || null,
      });
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
    <div className="scroll-reveal">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <article className="min-w-0 overflow-hidden rounded-lg border border-border bg-white p-5 md:p-7">
          <section className="rounded-lg bg-neutral p-5">
            <p className="academic-label">{language === "id" ? "Soal" : "Question"}</p>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[14px] font-normal leading-7 text-navy-deep">
              {t(question.prompt, language)}
            </p>
          </section>

          {question.options && (
            <section className="mt-6">
              <p className="academic-label mb-2">{language === "id" ? "Pilihan jawaban" : "Answer options"}</p>
              <ul className="space-y-2">
                {question.options.map((option) => (
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
                      {option.misconceptionId &&
                        misconceptionById.has(option.misconceptionId) && (
                          <span className="mt-1 block text-xs text-muted">
                            {misconceptionLabel(
                              misconceptionById.get(option.misconceptionId)!,
                              language,
                            )}
                          </span>
                        )}
                    </span>
                    {option.isCorrect && (
                      <span className="ml-auto shrink-0 text-xs font-semibold text-correct">
                        {language === "id" ? "Jawaban acuan" : "Reference answer"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {reference.pseudocode && (
            <section className="mt-6 border-t border-border pt-5">
              <p className="academic-label mb-2">{language === "id" ? "Pseudocode acuan" : "Reference pseudocode"}</p>
              <div className="overflow-hidden rounded-md border border-border">
                <PseudocodeBlock code={reference.pseudocode} />
              </div>
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
                {recommended.map((item) => (
                  <li
                    key={item.id}
                    className="rounded-md bg-brand-soft/65 px-3 py-2 text-sm font-semibold leading-5 text-navy-deep"
                  >
                    {misconceptionLabel(item, language)}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                {language === "id"
                  ? "Belum ada miskonsepsi yang terhubung."
                  : "No misconceptions are linked yet."}
              </p>
            )}
          </section>

          <section className="mt-6 border-t border-border pt-5">
            <p className="academic-label mb-2">{language === "id" ? "Konsep yang diuji" : "Assessed concepts"}</p>
            <div className="flex flex-wrap gap-2">
              {question.expectedConcepts.map((concept) => (
                <span key={t(concept, language)} className="rounded-md bg-neutral px-2.5 py-1.5 text-xs font-medium text-navy-deep">
                  {t(concept, language)}
                </span>
              ))}
            </div>
          </section>

          <section
            className="mt-6 border-t border-border pt-5"
            aria-labelledby="related-answers-title"
          >
            <h3
              id="related-answers-title"
              className="text-sm font-bold text-navy-deep"
            >
              {language === "id" ? "Jawaban terkait" : "Related answers"}
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
                      ...(option?.misconceptionId
                        ? [option.misconceptionId]
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
                            {reviewedAnswers.has(answer.id)
                              ? language === "id"
                                ? "Sudah direview"
                                : "Reviewed"
                              : language === "id"
                                ? "Belum direview"
                                : "Not reviewed"}
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
                          ? "Review jawaban ini"
                          : "Review this answer"}
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

          <div className="mt-6 space-y-6">
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
                    onChange={setHasIncorrectMisconceptions}
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi yang tidak seharusnya dicantumkan?"
                        : "Are any misconceptions listed that should not be included?"
                    }
                    yesDisabled={recommended.length === 0}
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
                              setRemovedMisconceptionIds((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                          />
                          <span>{misconceptionLabel(item, language)}</span>
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
                    onChange={(event) => setRemovalReason(event.target.value)}
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
                    onChange={setHasAdditionalMisconceptions}
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
                    onChange={setAdditionalMisconceptionIds}
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
                    onChange={(event) => setAdditionReason(event.target.value)}
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
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={language === "id" ? "Komentar opsional" : "Optional comment"}
                    className="academic-input mt-3 min-h-24 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              </div>
            </section>
          </div>

          {submitError && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2.5 text-xs leading-5 text-incorrect"
            >
              {submitError}
            </p>
          )}

          {!canSubmit && (
            <p id="question-validation-help" className="mt-5 text-xs leading-5 text-muted">
              {language === "id"
                ? "Jawab kedua pertanyaan dan lengkapi pilihan serta alasan jika memilih Ada."
                : "Answer both questions and complete the selection and reason when choosing Yes."}
            </p>
          )}

          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            aria-describedby={!canSubmit ? "question-validation-help" : undefined}
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
        </aside>
      </div>
    </div>
  );
}

function AnswerValidationWorkspace({
  task,
  question,
  answer,
  misconceptions,
  onBackToQuestion,
  onSubmit,
}: {
  task?: ReviewTask;
  question: Question;
  answer: StudentAnswer;
  misconceptions: Misconception[];
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
    ...(task?.suggestedMisconceptionId
      ? [task.suggestedMisconceptionId]
      : []),
    ...answer.studentMisconceptionIds,
  ]);
  const linkedMisconceptionIds = new Set(linkedMisconceptions.map((item) => item.id));
  const addableMisconceptions = misconceptions.filter((item) => !linkedMisconceptionIds.has(item.id));
  const similarMisconceptions = prioritizeMisconceptions(
    addableMisconceptions,
    linkedMisconceptions.flatMap((item) => item.relatedMisconceptionIds),
  );
  const [hasMismatchedMisconceptions, setHasMismatchedMisconceptions] = useState<boolean | null>(null);
  const [removedMisconceptionIds, setRemovedMisconceptionIds] = useState<string[]>([]);
  const [removalReason, setRemovalReason] = useState("");
  const [hasAdditionalMisconceptions, setHasAdditionalMisconceptions] = useState<boolean | null>(null);
  const [additionalMisconceptionIds, setAdditionalMisconceptionIds] = useState<string[]>([]);
  const [additionReason, setAdditionReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const canSubmit =
    hasMismatchedMisconceptions !== null &&
    hasAdditionalMisconceptions !== null &&
    (!hasMismatchedMisconceptions || (removedMisconceptionIds.length > 0 && removalReason.trim().length > 0)) &&
    (!hasAdditionalMisconceptions || (additionalMisconceptionIds.length > 0 && additionReason.trim().length > 0));

  const handleSubmit = async () => {
    if (
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
      await onSubmit({
        hasMismatchedMisconceptions,
        removedMisconceptionIds: hasMismatchedMisconceptions
          ? removedMisconceptionIds
          : [],
        removalReason: hasMismatchedMisconceptions
          ? removalReason.trim()
          : null,
        hasAdditionalMisconceptions,
        additionalMisconceptionIds: hasAdditionalMisconceptions
          ? additionalMisconceptionIds
          : [],
        additionReason: hasAdditionalMisconceptions
          ? additionReason.trim()
          : null,
        note: note.trim() || null,
      });
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
    <div className="scroll-reveal">
      <Button
        type="button"
        variant="secondary"
        onClick={onBackToQuestion}
        className="mb-4"
      >
        {language === "id"
          ? "Kembali ke soal ini"
          : "Back to this question"}
      </Button>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_390px] lg:items-start">
        <article className="min-w-0 overflow-hidden rounded-lg border border-border bg-white p-5 md:p-7">
          <section className="rounded-lg bg-neutral p-5">
            <p className="academic-label">{language === "id" ? "Soal sebagai konteks" : "Question context"}</p>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-[14px] font-normal leading-7 text-navy-deep">
              {t(question.prompt, language)}
            </p>
          </section>

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
                  const optionMisconception = option.misconceptionId
                    ? misconceptionById.get(option.misconceptionId)
                    : undefined;

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
                        {optionMisconception && (
                          <span className="mt-1 block text-xs text-muted">
                            {misconceptionLabel(optionMisconception, language)}
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

          <div className="mt-6 space-y-6">
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
                    onChange={setHasMismatchedMisconceptions}
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
                              setRemovedMisconceptionIds((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              )
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
                    onChange={(event) => setRemovalReason(event.target.value)}
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
                    onChange={setHasAdditionalMisconceptions}
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
                    onChange={setAdditionalMisconceptionIds}
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
                    onChange={(event) => setAdditionReason(event.target.value)}
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
                    onChange={(event) => setNote(event.target.value)}
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
          </div>

          {submitError && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2.5 text-xs leading-5 text-incorrect"
            >
              {submitError}
            </p>
          )}

          {!canSubmit && (
            <p id="answer-validation-help" className="mt-5 text-xs leading-5 text-muted">
              {language === "id"
                ? "Jawab kedua pertanyaan dan lengkapi pilihan serta alasan jika memilih Ada."
                : "Answer both questions and complete the selection and reason when choosing Yes."}
            </p>
          )}

          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            aria-describedby={!canSubmit ? "answer-validation-help" : undefined}
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
        </aside>
      </div>
    </div>
  );
}
