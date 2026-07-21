import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Code2,
  Download,
  FileQuestion,
  History,
  MessageSquareText,
  MinusCircle,
  PlusCircle,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { useLanguage } from "../hooks/useLanguage";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { getAdminReviewHistory } from "../services/reviewPersistenceRepository";
import type {
  AdminAnswerReviewHistoryItem,
  AdminQuestionReviewHistoryItem,
  AdminReviewHistory,
  Language,
} from "../types";
import { cn } from "../utils/cn";
import { t } from "../utils/translation";

type AdminTab = "history" | "downloads";
type HistoryMode = "question" | "answer";
type ChangeFilter = "all" | "changed" | "unchanged";

const emptyHistory: AdminReviewHistory = {
  questionReviews: [],
  answerReviews: [],
  reviewers: [],
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

function questionReviewHasChanges(review: AdminQuestionReviewHistoryItem): boolean {
  return (
    review.hasIncorrectMisconceptions || review.hasAdditionalMisconceptions
  );
}

function answerReviewHasChanges(review: AdminAnswerReviewHistoryItem): boolean {
  return (
    review.hasMismatchedMisconceptions || review.hasAdditionalMisconceptions
  );
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
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
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
  titles,
  emptyText,
  missingTitle,
}: {
  ids: string[];
  titles: Map<string, string>;
  emptyText: string;
  missingTitle: string;
}) {
  if (ids.length === 0) {
    return <p>{emptyText}</p>;
  }

  return (
    <ul className="space-y-1.5">
      {ids.map((id) => {
        const title = titles.get(id);

        return (
          <li
            key={id}
            className="rounded-md border border-border bg-white px-3 py-2 text-navy-deep"
          >
            <p className="font-semibold">
              {title ?? missingTitle}
            </p>
            <p className="mt-0.5 text-xs text-muted">{id}</p>
          </li>
        );
      })}
    </ul>
  );
}

function ReviewDetails({
  removedIds,
  removalReason,
  additionalIds,
  additionReason,
  note,
  misconceptionTitles,
  language,
}: {
  removedIds: string[];
  removalReason: string | null;
  additionalIds: string[];
  additionReason: string | null;
  note: string | null;
  misconceptionTitles: Map<string, string>;
  language: Language;
}) {
  return (
    <div className="border-t border-border bg-bg/55 px-5 py-5">
      <div className="grid gap-5 md:grid-cols-2">
        <DetailBlock
          icon={<MinusCircle size={17} strokeWidth={2} />}
          title={
            language === "id"
              ? "Miskonsepsi yang dilepas"
              : "Removed misconceptions"
          }
        >
          <MisconceptionList
            ids={removedIds}
            titles={misconceptionTitles}
            emptyText={
              language === "id"
                ? "Tidak ada miskonsepsi yang dilepas."
                : "No misconceptions were removed."
            }
            missingTitle={
              language === "id"
                ? "Judul miskonsepsi tidak tersedia"
                : "Misconception title is unavailable"
            }
          />
          <p className="mt-3">
            <span className="font-semibold">
              {language === "id" ? "Alasan: " : "Reason: "}
            </span>
            {removalReason ??
              (language === "id"
                ? "Tidak ada alasan pelepasan."
                : "No removal reason.")}
          </p>
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
            ids={additionalIds}
            titles={misconceptionTitles}
            emptyText={
              language === "id"
                ? "Tidak ada miskonsepsi yang ditambahkan."
                : "No misconceptions were added."
            }
            missingTitle={
              language === "id"
                ? "Judul miskonsepsi tidak tersedia"
                : "Misconception title is unavailable"
            }
          />
          <p className="mt-3">
            <span className="font-semibold">
              {language === "id" ? "Alasan: " : "Reason: "}
            </span>
            {additionReason ??
              (language === "id"
                ? "Tidak ada alasan penambahan."
                : "No addition reason.")}
          </p>
        </DetailBlock>
      </div>

      <div className="mt-5">
        <DetailBlock
          icon={<MessageSquareText size={17} strokeWidth={2} />}
          title={language === "id" ? "Komentar tambahan" : "Additional comment"}
        >
          <p>
            {note ??
              (language === "id"
                ? "Tidak ada komentar tambahan."
                : "No additional comment.")}
          </p>
        </DetailBlock>
      </div>
    </div>
  );
}

function ChangeStatus({
  hasChanges,
  language,
}: {
  hasChanges: boolean;
  language: Language;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-semibold",
        hasChanges
          ? "bg-warning-bg text-warning"
          : "bg-correct-bg text-correct",
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
  );
}

function ReviewerIdentity({
  fullName,
  email,
}: {
  fullName: string;
  email: string;
}) {
  return (
    <div className="min-w-0">
      <p className="truncate text-sm font-bold text-navy-deep">{fullName}</p>
      <p className="mt-0.5 truncate text-xs text-muted">{email}</p>
    </div>
  );
}

function QuestionReviewCard({
  review,
  questionPrompt,
  misconceptionTitles,
  language,
}: {
  review: AdminQuestionReviewHistoryItem;
  questionPrompt?: string;
  misconceptionTitles: Map<string, string>;
  language: Language;
}) {
  const hasChanges = questionReviewHasChanges(review);

  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-white">
      <summary className="cursor-pointer list-none px-5 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <FileQuestion size={19} strokeWidth={2} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <ReviewerIdentity fullName={review.fullName} email={review.email} />
              <ChangeStatus hasChanges={hasChanges} language={language} />
            </div>

            <p className="mt-3 text-xs font-semibold text-muted">
              {language === "id" ? "ID Soal" : "Question ID"}: {review.questionId}
            </p>
            <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">
              {questionPrompt ??
                (language === "id"
                  ? "Isi soal tidak tersedia di data master."
                  : "Question content is unavailable in the master data.")}
            </p>

            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
              {formatReviewDate(review.updatedAt, language)}
            </p>
          </div>

          <span className="mt-1 shrink-0 text-xs font-semibold text-brand group-open:hidden">
            {language === "id" ? "Lihat detail" : "View details"}
          </span>
          <span className="mt-1 hidden shrink-0 text-xs font-semibold text-brand group-open:inline">
            {language === "id" ? "Tutup detail" : "Close details"}
          </span>
        </div>
      </summary>

      <ReviewDetails
        removedIds={review.removedMisconceptionIds}
        removalReason={review.removalReason}
        additionalIds={review.additionalMisconceptionIds}
        additionReason={review.additionReason}
        note={review.note}
        misconceptionTitles={misconceptionTitles}
        language={language}
      />
    </details>
  );
}

function AnswerReviewCard({
  review,
  answerText,
  misconceptionTitles,
  language,
}: {
  review: AdminAnswerReviewHistoryItem;
  answerText?: string;
  misconceptionTitles: Map<string, string>;
  language: Language;
}) {
  const hasChanges = answerReviewHasChanges(review);

  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-white">
      <summary className="cursor-pointer list-none px-5 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
        <div className="flex items-start gap-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Code2 size={19} strokeWidth={2} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <ReviewerIdentity fullName={review.fullName} email={review.email} />
              <ChangeStatus hasChanges={hasChanges} language={language} />
            </div>

            <p className="mt-3 text-xs font-semibold text-muted">
              {language === "id" ? "ID Jawaban" : "Answer ID"}: {review.answerId}
              <span className="mx-1.5 text-muted/60">/</span>
              {language === "id" ? "ID Soal" : "Question ID"}: {review.questionId}
            </p>
            <p className="mt-1 line-clamp-2 rounded-md bg-neutral px-3 py-2 font-mono text-xs leading-5 text-navy-deep">
              {answerText ??
                (language === "id"
                  ? "Isi jawaban tidak tersedia di data master."
                  : "Answer content is unavailable in the master data.")}
            </p>

            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
              <CalendarDays size={13} strokeWidth={2} aria-hidden="true" />
              {formatReviewDate(review.updatedAt, language)}
            </p>
          </div>

          <span className="mt-1 shrink-0 text-xs font-semibold text-brand group-open:hidden">
            {language === "id" ? "Lihat detail" : "View details"}
          </span>
          <span className="mt-1 hidden shrink-0 text-xs font-semibold text-brand group-open:inline">
            {language === "id" ? "Tutup detail" : "Close details"}
          </span>
        </div>
      </summary>

      <ReviewDetails
        removedIds={review.removedMisconceptionIds}
        removalReason={review.removalReason}
        additionalIds={review.additionalMisconceptionIds}
        additionReason={review.additionReason}
        note={review.note}
        misconceptionTitles={misconceptionTitles}
        language={language}
      />
    </details>
  );
}

function SummaryItem({
  icon,
  label,
  value,
  loading,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  loading: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
        {icon}
      </span>
      <div>
        <dt className="text-xs font-semibold text-muted">{label}</dt>
        <dd className="mt-0.5 text-xl font-bold tracking-tight text-navy-deep">
          {loading ? <span className="skeleton block h-6 w-10" /> : value}
        </dd>
      </div>
    </div>
  );
}

export function AdminPage() {
  const { language } = useLanguage();
  const { questions, loading: questionsLoading } = useQuestions();
  const { answers, loading: answersLoading } = useAllStudentAnswers();
  const { misconceptions, loading: misconceptionsLoading } =
    useMisconceptions();
  const [tab, setTab] = useState<AdminTab>("history");
  const [mode, setMode] = useState<HistoryMode>("question");
  const [history, setHistory] = useState<AdminReviewHistory>(emptyHistory);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [search, setSearch] = useState("");
  const [reviewerId, setReviewerId] = useState("all");
  const [changeFilter, setChangeFilter] = useState<ChangeFilter>("all");

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      setHistoryLoading(true);
      setHistoryError("");

      try {
        const result = await getAdminReviewHistory();

        if (active) {
          setHistory(result);
        }
      } catch (error) {
        if (!active) return;

        console.error("[Progmiscon] Riwayat review Admin gagal dimuat", error);
        setHistory(emptyHistory);
        setHistoryError(
          error instanceof Error
            ? error.message
            : "Riwayat review Admin belum dapat dimuat.",
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
  }, []);

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
          t(misconception.title, language),
        ]),
      ),
    [language, misconceptions],
  );
  const summary = useMemo(
    () => ({
      questionReviews: history.questionReviews.length,
      answerReviews: history.answerReviews.length,
      reviewers: history.reviewers.length,
      changedReviews:
        history.questionReviews.filter(questionReviewHasChanges).length +
        history.answerReviews.filter(answerReviewHasChanges).length,
    }),
    [history],
  );
  const query = search.trim().toLowerCase();
  const filteredQuestionReviews = useMemo(
    () =>
      history.questionReviews.filter(
        (review) =>
          (!query || review.questionId.toLowerCase().includes(query)) &&
          (reviewerId === "all" || review.reviewerId === reviewerId) &&
          (changeFilter === "all" ||
            (changeFilter === "changed"
              ? questionReviewHasChanges(review)
              : !questionReviewHasChanges(review))),
      ),
    [changeFilter, history.questionReviews, query, reviewerId],
  );
  const filteredAnswerReviews = useMemo(
    () =>
      history.answerReviews.filter(
        (review) =>
          (!query ||
            review.answerId.toLowerCase().includes(query) ||
            review.questionId.toLowerCase().includes(query)) &&
          (reviewerId === "all" || review.reviewerId === reviewerId) &&
          (changeFilter === "all" ||
            (changeFilter === "changed"
              ? answerReviewHasChanges(review)
              : !answerReviewHasChanges(review))),
      ),
    [changeFilter, history.answerReviews, query, reviewerId],
  );

  const loading =
    historyLoading ||
    questionsLoading ||
    answersLoading ||
    misconceptionsLoading;
  const activeReviews =
    mode === "question" ? filteredQuestionReviews : filteredAnswerReviews;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <ShieldCheck size={23} strokeWidth={2} aria-hidden="true" />
        </span>

        <div>
          <h1 className="page-title">Admin Progmiscon</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {language === "id"
              ? "Pantau riwayat review dosen dan siapkan unduhan data akademik secara read-only."
              : "Monitor lecturer review history and prepare read-only academic data downloads."}
          </p>
        </div>
      </header>

      <section className="workspace-sheet" aria-labelledby="admin-summary-title">
        <div className="workspace-section">
          <h2 id="admin-summary-title" className="text-base font-bold text-navy-deep">
            {language === "id" ? "Ringkasan riwayat review" : "Review history summary"}
          </h2>
        </div>
        <dl className="grid sm:grid-cols-2 lg:grid-cols-4">
          <SummaryItem
            icon={<FileQuestion size={17} strokeWidth={2} aria-hidden="true" />}
            label={language === "id" ? "Review soal" : "Question reviews"}
            value={summary.questionReviews}
            loading={historyLoading}
          />
          <SummaryItem
            icon={<Code2 size={17} strokeWidth={2} aria-hidden="true" />}
            label={language === "id" ? "Review jawaban" : "Answer reviews"}
            value={summary.answerReviews}
            loading={historyLoading}
          />
          <SummaryItem
            icon={<UsersRound size={17} strokeWidth={2} aria-hidden="true" />}
            label={language === "id" ? "Dosen reviewer" : "Lecturer reviewers"}
            value={summary.reviewers}
            loading={historyLoading}
          />
          <SummaryItem
            icon={<History size={17} strokeWidth={2} aria-hidden="true" />}
            label={language === "id" ? "Review dengan perubahan" : "Reviews with changes"}
            value={summary.changedReviews}
            loading={historyLoading}
          />
        </dl>
      </section>

      {historyError && (
        <p
          role="alert"
          className="mt-6 rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm leading-6 text-incorrect"
        >
          {historyError}
        </p>
      )}

      <div
        className="mt-7 grid grid-cols-2 gap-1 rounded-lg border border-border bg-neutral p-1 sm:w-fit"
        role="tablist"
        aria-label={language === "id" ? "Menu Admin" : "Admin menu"}
      >
        <button
          id="admin-tab-history"
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          aria-controls="admin-panel-history"
          onClick={() => setTab("history")}
          className={cn(
            "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-w-44",
            tab === "history"
              ? "bg-white text-brand shadow-sm"
              : "text-muted hover:bg-white/60 hover:text-navy-deep",
          )}
        >
          <History size={17} strokeWidth={2} aria-hidden="true" />
          {language === "id" ? "Riwayat Review" : "Review History"}
        </button>

        <button
          id="admin-tab-downloads"
          type="button"
          role="tab"
          aria-selected={tab === "downloads"}
          aria-controls="admin-panel-downloads"
          onClick={() => setTab("downloads")}
          className={cn(
            "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-w-44",
            tab === "downloads"
              ? "bg-white text-brand shadow-sm"
              : "text-muted hover:bg-white/60 hover:text-navy-deep",
          )}
        >
          <Download size={17} strokeWidth={2} aria-hidden="true" />
          {language === "id" ? "Unduh Data" : "Download Data"}
        </button>
      </div>

      {tab === "history" ? (
        <section
          id="admin-panel-history"
          role="tabpanel"
          aria-labelledby="admin-tab-history"
          className="mt-5"
        >
          <div
            className="grid grid-cols-2 gap-1 rounded-lg border border-border bg-neutral p-1 sm:w-fit"
            role="tablist"
            aria-label={
              language === "id" ? "Jenis validasi" : "Validation type"
            }
          >
            <button
              id="admin-history-question-tab"
              type="button"
              role="tab"
              aria-selected={mode === "question"}
              aria-controls="admin-history-question-panel"
              onClick={() => setMode("question")}
              className={cn(
                "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-w-44",
                mode === "question"
                  ? "bg-white text-brand shadow-sm"
                  : "text-muted hover:bg-white/60 hover:text-navy-deep",
              )}
            >
              <FileQuestion size={17} strokeWidth={2} aria-hidden="true" />
              {language === "id" ? "Validasi Soal" : "Question Validation"}
            </button>

            <button
              id="admin-history-answer-tab"
              type="button"
              role="tab"
              aria-selected={mode === "answer"}
              aria-controls="admin-history-answer-panel"
              onClick={() => setMode("answer")}
              className={cn(
                "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-w-44",
                mode === "answer"
                  ? "bg-white text-brand shadow-sm"
                  : "text-muted hover:bg-white/60 hover:text-navy-deep",
              )}
            >
              <Code2 size={17} strokeWidth={2} aria-hidden="true" />
              {language === "id" ? "Validasi Jawaban" : "Answer Validation"}
            </button>
          </div>

          <div className="mt-5 grid gap-4 rounded-xl border border-border bg-white p-5 md:grid-cols-3">
            <label className="grid gap-2 text-sm font-semibold text-navy-deep">
              {language === "id"
                ? mode === "question"
                  ? "Cari ID soal"
                  : "Cari ID soal atau jawaban"
                : mode === "question"
                  ? "Search question ID"
                  : "Search question or answer ID"}
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={mode === "question" ? "q-..." : "q-... atau a-..."}
                className="academic-input px-3 py-2.5 text-sm"
              />
            </label>

            <label className="grid gap-2 text-sm font-semibold text-navy-deep">
              {language === "id" ? "Dosen reviewer" : "Lecturer reviewer"}
              <select
                value={reviewerId}
                onChange={(event) => setReviewerId(event.target.value)}
                className="academic-input cursor-pointer px-3 py-2.5 text-sm"
              >
                <option value="all">
                  {language === "id" ? "Semua dosen" : "All lecturers"}
                </option>
                {history.reviewers.map((reviewer) => (
                  <option key={reviewer.reviewerId} value={reviewer.reviewerId}>
                    {reviewer.fullName} ({reviewer.email})
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2 text-sm font-semibold text-navy-deep">
              {language === "id" ? "Status perubahan" : "Change status"}
              <select
                value={changeFilter}
                onChange={(event) =>
                  setChangeFilter(event.target.value as ChangeFilter)
                }
                className="academic-input cursor-pointer px-3 py-2.5 text-sm"
              >
                <option value="all">{language === "id" ? "Semua" : "All"}</option>
                <option value="changed">
                  {language === "id" ? "Ada perubahan" : "Changes suggested"}
                </option>
                <option value="unchanged">
                  {language === "id" ? "Tidak ada perubahan" : "No changes"}
                </option>
              </select>
            </label>
          </div>

          {loading ? (
            <EmptyState
              loading
              message={
                language === "id"
                  ? "Memuat riwayat review seluruh dosen..."
                  : "Loading review history for all lecturers..."
              }
            />
          ) : activeReviews.length > 0 ? (
            <div
              id={
                mode === "question"
                  ? "admin-history-question-panel"
                  : "admin-history-answer-panel"
              }
              role="tabpanel"
              aria-labelledby={
                mode === "question"
                  ? "admin-history-question-tab"
                  : "admin-history-answer-tab"
              }
              className="mt-5 space-y-4"
            >
              {mode === "question"
                ? filteredQuestionReviews.map((review) => {
                    const question = questionMap.get(review.questionId);

                    return (
                      <QuestionReviewCard
                        key={review.id}
                        review={review}
                        questionPrompt={
                          question ? t(question.prompt, language) : undefined
                        }
                        misconceptionTitles={misconceptionTitles}
                        language={language}
                      />
                    );
                  })
                : filteredAnswerReviews.map((review) => {
                    const answer = answerMap.get(review.answerId);
                    const question = questionMap.get(review.questionId);
                    const selectedOption = question?.options?.find(
                      (option) => option.id === answer?.selectedOptionId,
                    );
                    const answerText = selectedOption
                      ? `${selectedOption.label}. ${t(selectedOption.text, language)}`
                      : answer?.answerText;

                    return (
                      <AnswerReviewCard
                        key={review.id}
                        review={review}
                        answerText={answerText}
                        misconceptionTitles={misconceptionTitles}
                        language={language}
                      />
                    );
                  })}
            </div>
          ) : (
            <div
              id={
                mode === "question"
                  ? "admin-history-question-panel"
                  : "admin-history-answer-panel"
              }
              role="tabpanel"
              aria-labelledby={
                mode === "question"
                  ? "admin-history-question-tab"
                  : "admin-history-answer-tab"
              }
              className="mt-5"
            >
              <EmptyState
                message={
                  search || reviewerId !== "all" || changeFilter !== "all"
                    ? language === "id"
                      ? "Tidak ada riwayat review yang sesuai dengan pencarian atau filter."
                      : "No review history matches the current search or filters."
                    : language === "id"
                      ? mode === "question"
                        ? "Belum ada riwayat Validasi Soal dari dosen."
                        : "Belum ada riwayat Validasi Jawaban dari dosen."
                      : mode === "question"
                        ? "There is no Question Validation history from lecturers yet."
                        : "There is no Answer Validation history from lecturers yet."
                }
              />
            </div>
          )}
        </section>
      ) : (
        <section
          id="admin-panel-downloads"
          role="tabpanel"
          aria-labelledby="admin-tab-downloads"
          className="mt-5"
        >
          <EmptyState
            message={
              language === "id"
                ? "Unduhan raw review dan relasi miskonsepsi akan tersedia pada tahap berikutnya."
                : "Raw review and misconception relation downloads will be available in the next stage."
            }
          />
        </section>
      )}
    </div>
  );
}
