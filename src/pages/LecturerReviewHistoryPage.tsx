import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CalendarDays,
  Code2,
  FileQuestion,
  MessageSquareText,
  MinusCircle,
  PlusCircle,
} from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { useQuestions } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { useMisconceptions } from "../hooks/useMisconceptions";
import {
  getReviewerHistory,
  getReviewSourceVersions,
} from "../services/reviewPersistenceRepository";
import type {
  AnswerReviewHistoryItem,
  Language,
  QuestionReviewHistoryItem,
  ReviewerHistory,
  ReviewSourceVersions,
} from "../types";
import { cn } from "../utils/cn";
import { t } from "../utils/translation";
import { misconceptionLabel } from "../utils/misconceptionLabel";
import { resolveQuestionWordingForReview } from "../utils/reviewWorkspace";

type HistoryMode = "question" | "answer";

const emptyHistory: ReviewerHistory = {
  questionReviews: [],
  answerReviews: [],
};

function formatReviewDate(value: string, language: Language): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function DetailBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-2 text-xs font-semibold text-muted">
        <span className="text-brand" aria-hidden="true">
          {icon}
        </span>
        {title}
      </div>

      <div className="mt-2 text-sm leading-6 text-navy-deep">{children}</div>
    </section>
  );
}

function MisconceptionList({
  ids,
  misconceptionTitles,
  emptyText,
}: {
  ids: string[];
  misconceptionTitles: Map<string, string>;
  emptyText: string;
}) {
  if (ids.length === 0) {
    return <p>{emptyText}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {ids.map((id) => (
        <li
          key={id}
          className="rounded-md border border-border bg-white px-3 py-2 text-navy-deep"
        >
          <span className="font-semibold">
            {misconceptionTitles.get(id) ?? id}
          </span>
        </li>
      ))}
    </ul>
  );
}

function ReviewLifecycleBadge({
  review,
  language,
}: {
  review: Pick<
    QuestionReviewHistoryItem,
    "isActive" | "inactiveReason" | "sourceVersion"
  >;
  language: Language;
}) {
  const label = review.isActive
    ? language === "id"
      ? "Aktif"
      : "Active"
    : review.inactiveReason === "source_updated"
      ? language === "id"
        ? "Sumber diperbarui"
        : "Source updated"
      : language === "id"
        ? "Dihapus"
        : "Deleted";

  return (
    <span
      title={`Source version: ${review.sourceVersion}`}
      className={cn(
        "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
        review.isActive
          ? "border-correct-border bg-correct-bg text-correct"
          : "border-border bg-neutral text-muted",
      )}
    >
      {label}
    </span>
  );
}

function QuestionHistoryCard({
  review,
  questionPrompt,
  typeLabel,
  misconceptionTitles,
  language,
}: {
  review: QuestionReviewHistoryItem;
  questionPrompt?: string;
  typeLabel?: "PS" | "MP";
  misconceptionTitles: Map<string, string>;
  language: Language;
}) {
  const hasChanges =
    review.hasIncorrectMisconceptions || review.hasAdditionalMisconceptions;

  return (
    <details className="group overflow-hidden rounded-lg border border-border bg-white">
      <summary className="cursor-pointer list-none px-5 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <FileQuestion size={19} strokeWidth={2} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-bold text-navy-deep">
                {language === "id" ? "Validasi Soal" : "Question Validation"}
              </p>

              {typeLabel && (
                <span className="rounded-md bg-neutral px-2 py-1 text-[11px] font-bold text-navy-deep">
                  {typeLabel}
                </span>
              )}

              <ReviewLifecycleBadge review={review} language={language} />

              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                  hasChanges
                    ? "border-warning-border bg-warning-bg text-warning"
                    : "border-correct-border bg-correct-bg text-correct",
                )}
              >
                {hasChanges
                  ? language === "id"
                    ? "Ada perubahan"
                    : "Changes suggested"
                  : language === "id"
                    ? "Tidak ada perubahan"
                    : "No changes"}
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-[13px] font-normal leading-6 text-navy-deep">
              {questionPrompt ?? (language === "id"
                ? "Wording historis tidak tersedia."
                : "Historical wording is unavailable.")}
            </p>

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
                {formatReviewDate(review.updatedAt, language)}
              </span>
              <span className="text-muted/70">{review.questionId}</span>
            </p>
          </div>

          <span className="mt-1 text-xs font-semibold text-brand group-open:hidden">
            {language === "id" ? "Lihat detail" : "View details"}
          </span>

          <span className="mt-1 hidden text-xs font-semibold text-brand group-open:inline">
            {language === "id" ? "Tutup detail" : "Close details"}
          </span>
        </div>
      </summary>

      <div className="border-t border-border bg-bg/55 px-5 py-5">
        <div className="grid gap-4 md:grid-cols-2">
          <DetailBlock
            icon={<MinusCircle size={17} strokeWidth={2} />}
            title={
              language === "id"
                ? "Miskonsepsi yang dilepas"
                : "Removed misconceptions"
            }
          >
            <MisconceptionList
              ids={review.removedMisconceptionIds}
              misconceptionTitles={misconceptionTitles}
              emptyText={
                language === "id"
                  ? "Tidak ada miskonsepsi yang dilepas."
                  : "No misconceptions were removed."
              }
            />

            {review.removalReason && (
              <p className="mt-3">
                <span className="font-semibold text-navy-deep">
                  {language === "id" ? "Alasan: " : "Reason: "}
                </span>
                {review.removalReason}
              </p>
            )}
          </DetailBlock>

          <DetailBlock
            icon={<PlusCircle size={17} strokeWidth={2} />}
            title={
              language === "id"
                ? "Miskonsepsi yang ditambahkan"
                : "Added misconceptions"
            }
          >
            <MisconceptionList
              ids={review.additionalMisconceptionIds}
              misconceptionTitles={misconceptionTitles}
              emptyText={
                language === "id"
                  ? "Tidak ada miskonsepsi yang ditambahkan."
                  : "No misconceptions were added."
              }
            />

            {review.additionReason && (
              <p className="mt-3">
                <span className="font-semibold text-navy-deep">
                  {language === "id" ? "Alasan: " : "Reason: "}
                </span>
                {review.additionReason}
              </p>
            )}
          </DetailBlock>
        </div>

        <div className="mt-4">
          <DetailBlock
            icon={<MessageSquareText size={17} strokeWidth={2} />}
            title={
              language === "id" ? "Komentar tambahan" : "Additional comment"
            }
          >
            <p>
              {review.note ??
                (language === "id"
                  ? "Tidak ada komentar tambahan."
                  : "No additional comment.")}
            </p>
          </DetailBlock>
        </div>
      </div>
    </details>
  );
}

function AnswerHistoryCard({
  review,
  questionPrompt,
  answerText,
  typeLabel,
  misconceptionTitles,
  language,
}: {
  review: AnswerReviewHistoryItem;
  questionPrompt?: string;
  answerText?: string;
  typeLabel?: "PS" | "MP";
  misconceptionTitles: Map<string, string>;
  language: Language;
}) {
  const hasChanges =
    review.hasMismatchedMisconceptions || review.hasAdditionalMisconceptions;

  return (
    <details className="group overflow-hidden rounded-lg border border-border bg-white">
      <summary className="cursor-pointer list-none px-5 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Code2 size={19} strokeWidth={2} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm font-bold text-navy-deep">
                {language === "id" ? "Validasi Jawaban" : "Answer Validation"}
              </p>

              {typeLabel && (
                <span className="rounded-md bg-neutral px-2 py-1 text-[11px] font-bold text-navy-deep">
                  {typeLabel}
                </span>
              )}

              <ReviewLifecycleBadge review={review} language={language} />

              <span
                className={cn(
                  "rounded-md border px-2.5 py-1 text-[11px] font-semibold",
                  hasChanges
                    ? "border-warning-border bg-warning-bg text-warning"
                    : "border-correct-border bg-correct-bg text-correct",
                )}
              >
                {hasChanges
                  ? language === "id"
                    ? "Ada perubahan"
                    : "Changes suggested"
                  : language === "id"
                    ? "Tidak ada perubahan"
                    : "No changes"}
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
              {questionPrompt ?? (language === "id"
                ? "Wording historis tidak tersedia."
                : "Historical wording is unavailable.")}
            </p>

            {answerText && (
              <p className="mt-2 line-clamp-2 rounded-md bg-neutral px-3 py-2 font-mono text-xs leading-5 text-navy-deep">
                {answerText}
              </p>
            )}

            <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              <span className="flex items-center gap-1.5">
                <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
                {formatReviewDate(review.updatedAt, language)}
              </span>
              <span className="text-muted/70">
                {language === "id" ? "Soal" : "Question"} {review.questionId} / {review.answerId}
              </span>
            </p>
          </div>

          <span className="mt-1 text-xs font-semibold text-brand group-open:hidden">
            {language === "id" ? "Lihat detail" : "View details"}
          </span>

          <span className="mt-1 hidden text-xs font-semibold text-brand group-open:inline">
            {language === "id" ? "Tutup detail" : "Close details"}
          </span>
        </div>
      </summary>

      <div className="border-t border-border bg-bg/55 px-5 py-5">
        <div className="grid gap-4 md:grid-cols-2">
          <DetailBlock
            icon={<MinusCircle size={17} strokeWidth={2} />}
            title={
              language === "id"
                ? "Miskonsepsi yang dilepas"
                : "Removed misconceptions"
            }
          >
            <MisconceptionList
              ids={review.removedMisconceptionIds}
              misconceptionTitles={misconceptionTitles}
              emptyText={
                language === "id"
                  ? "Tidak ada miskonsepsi yang dilepas."
                  : "No misconceptions were removed."
              }
            />

            {review.removalReason && (
              <p className="mt-3">
                <span className="font-semibold text-navy-deep">
                  {language === "id" ? "Alasan: " : "Reason: "}
                </span>
                {review.removalReason}
              </p>
            )}
          </DetailBlock>

          <DetailBlock
            icon={<PlusCircle size={17} strokeWidth={2} />}
            title={
              language === "id"
                ? "Miskonsepsi yang ditambahkan"
                : "Added misconceptions"
            }
          >
            <MisconceptionList
              ids={review.additionalMisconceptionIds}
              misconceptionTitles={misconceptionTitles}
              emptyText={
                language === "id"
                  ? "Tidak ada miskonsepsi yang ditambahkan."
                  : "No misconceptions were added."
              }
            />

            {review.additionReason && (
              <p className="mt-3">
                <span className="font-semibold text-navy-deep">
                  {language === "id" ? "Alasan: " : "Reason: "}
                </span>
                {review.additionReason}
              </p>
            )}
          </DetailBlock>
        </div>

        <div className="mt-4">
          <DetailBlock
            icon={<MessageSquareText size={17} strokeWidth={2} />}
            title={
              language === "id" ? "Komentar tambahan" : "Additional comment"
            }
          >
            <p>
              {review.note ??
                (language === "id"
                  ? "Tidak ada komentar tambahan."
                  : "No additional comment.")}
            </p>
          </DetailBlock>
        </div>
      </div>
    </details>
  );
}

export function LecturerReviewHistoryPage() {
  const { language } = useLanguage();
  const { user } = useLecturerAuth();
  const { questions, loading: questionsLoading } = useQuestions();
  const { answers, loading: answersLoading } = useAllStudentAnswers();
  const { misconceptions, loading: misconceptionsLoading } =
    useMisconceptions();

  const [mode, setMode] = useState<HistoryMode>("question");
  const [history, setHistory] = useState<ReviewerHistory>(emptyHistory);
  const [sourceVersions, setSourceVersions] = useState<ReviewSourceVersions>({
    questions: new Map(),
    answers: new Map(),
  });
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!user) {
        if (active) {
          setHistory(emptyHistory);
          setHistoryLoading(false);
        }
        return;
      }

      setHistoryLoading(true);
      setHistoryError("");

      try {
        const [result, versions] = await Promise.all([
          getReviewerHistory(user.id),
          getReviewSourceVersions(),
        ]);

        if (!active) return;

        setHistory(result);
        setSourceVersions(versions);
      } catch (error) {
        if (!active) return;

        console.error("[Progmiscon] Riwayat review gagal dimuat", error);

        setHistoryError(
          error instanceof Error
            ? error.message
            : "Riwayat review belum dapat dimuat.",
        );
      } finally {
        if (active) {
          setHistoryLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [user]);

  const questionMap = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );

  const answerMap = useMemo(
    () => new Map(answers.map((answer) => [answer.id, answer])),
    [answers],
  );

  const misconceptionTitles = useMemo(
    () =>
      new Map(
        misconceptions.map((misconception) => [
          misconception.id,
          misconceptionLabel(misconception, language),
        ]),
      ),
    [language, misconceptions],
  );

  const loading =
    historyLoading ||
    questionsLoading ||
    answersLoading ||
    misconceptionsLoading;

  return (
    <div className="mx-auto max-w-5xl">
      <Link
        to="/review"
        className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:text-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
        {language === "id" ? "Kembali ke Review" : "Back to Review"}
      </Link>

      <header className="mb-7">
        <div>
          <h1 className="page-title">
            {language === "id" ? "Riwayat Review Saya" : "My Review History"}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {language === "id"
              ? "Lihat kembali hasil Validasi Soal dan Validasi Jawaban yang pernah Anda kirim."
              : "Review the Question Validation and Answer Validation results you have submitted."}
          </p>
        </div>
      </header>

      {historyError && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
        >
          {historyError}
        </p>
      )}

      <div
        className="segmented-control mb-6 w-full sm:w-auto"
        role="tablist"
        aria-label={
          language === "id" ? "Jenis riwayat review" : "Review history type"
        }
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "question"}
          onClick={() => setMode("question")}
          className="segmented-tab sm:min-w-44"
        >
          {language === "id" ? "Validasi Soal" : "Question Validation"}
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "answer"}
          onClick={() => setMode("answer")}
          className="segmented-tab sm:min-w-44"
        >
          {language === "id" ? "Validasi Jawaban" : "Answer Validation"}
        </button>
      </div>

      {loading ? (
        <EmptyState
          loading
          message={
            language === "id"
              ? "Memuat riwayat review..."
              : "Loading review history..."
          }
        />
      ) : mode === "question" ? (
        history.questionReviews.length > 0 ? (
          <div className="space-y-4">
            {history.questionReviews.map((review) => {
              const question = questionMap.get(review.questionId);

              return (
                <QuestionHistoryCard
                  key={review.id}
                  review={review}
                  questionPrompt={
                    t(
                      resolveQuestionWordingForReview(
                        question,
                        {
                          questionId: review.questionId,
                          reviewUpdatedAt: review.updatedAt,
                          reviewSourceVersion: review.sourceVersion,
                          currentSourceVersion: sourceVersions.questions.get(
                            review.questionId,
                          ),
                        },
                      ) ?? { id: "", en: "" },
                      language,
                    ) || undefined
                  }
                  typeLabel={
                    question
                      ? question.type === "multiple_choice"
                        ? "MP"
                        : "PS"
                      : undefined
                  }
                  misconceptionTitles={misconceptionTitles}
                  language={language}
                />
              );
            })}
          </div>
        ) : (
          <EmptyState
            message={
              language === "id"
                ? "Belum ada riwayat Validasi Soal."
                : "There is no Question Validation history yet."
            }
          />
        )
      ) : history.answerReviews.length > 0 ? (
        <div className="space-y-4">
          {history.answerReviews.map((review) => {
            const answer = answerMap.get(review.answerId);
            const answerQuestion = answer
              ? questionMap.get(answer.questionId)
              : undefined;
            const question =
              answerQuestion ?? questionMap.get(review.questionId);
            const selectedOption = question?.options?.find(
              (option) => option.id === answer?.selectedOptionId,
            );

            const answerText = selectedOption
              ? `${selectedOption.label}. ${t(selectedOption.text, language)}`
              : answer?.answerText;

            return (
              <AnswerHistoryCard
                key={review.id}
                review={review}
                  questionPrompt={undefined}
                answerText={answerText}
                typeLabel={
                  question
                    ? question.type === "multiple_choice"
                      ? "MP"
                      : "PS"
                    : undefined
                }
                misconceptionTitles={misconceptionTitles}
                language={language}
              />
            );
          })}
        </div>
      ) : (
        <EmptyState
          message={
            language === "id"
              ? "Belum ada riwayat Validasi Jawaban."
              : "There is no Answer Validation history yet."
          }
        />
      )}
    </div>
  );
}
