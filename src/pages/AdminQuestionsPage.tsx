import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, RotateCcw, Search } from "lucide-react";
import { AdminFilterSelect } from "../components/admin/AdminFilterSelect";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { EmptyState } from "../components/common/EmptyState";
import { QuestionContent } from "../components/review/QuestionContent";
import { useAsyncData } from "../hooks/useAsyncData";
import { useLanguage } from "../hooks/useLanguage";
import { getMisconceptions } from "../services/misconceptionRepository";
import { getQuestions } from "../services/questionRepository";
import {
  getQuestionReviewCounts,
  getReviewSourceVersions,
  resetQuestionReviews,
} from "../services/reviewPersistenceRepository";
import type {
  Misconception,
  Question,
  QuestionReviewCount,
  ReviewSourceVersions,
} from "../types";
import {
  filterMaterialQuestions,
  getMaterialPaginationItems,
  getMaterialWeekLabel,
  getMaterialWeekOptions,
  type MaterialQuestionTypeFilter,
} from "../utils/materialQuestionFilters";
import { t } from "../utils/translation";

const PAGE_SIZE = 10;
const emptySourceVersions: ReviewSourceVersions = {
  questions: new Map(),
  answers: new Map(),
};
type AdminQuestionsData = [
  Question[],
  Misconception[],
  QuestionReviewCount[],
  ReviewSourceVersions,
];
const emptyData: AdminQuestionsData = [[], [], [], emptySourceVersions];

export function AdminQuestionsPage() {
  const { language } = useLanguage();
  const isIndonesian = language === "id";
  const { data, loading, error } = useAsyncData<AdminQuestionsData>(
    () =>
      Promise.all([
        getQuestions(),
        getMisconceptions(),
        getQuestionReviewCounts(),
        getReviewSourceVersions(),
      ]),
    [],
    emptyData,
  );
  const [questions, misconceptions, reviewCounts, sourceVersions] = data;
  const [searchQuery, setSearchQuery] = useState("");
  const [week, setWeek] = useState("all");
  const [type, setType] = useState<MaterialQuestionTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resetBusyQuestionId, setResetBusyQuestionId] = useState("");
  const [resetError, setResetError] = useState("");
  // Question id awaiting confirmation in the in-app ConfirmDialog (null = closed).
  const [pendingResetQuestionId, setPendingResetQuestionId] = useState<
    string | null
  >(null);
  // Populated after a successful reset to drive the success dialog.
  const [resetResult, setResetResult] = useState<{
    questionId: string;
    reviewsReset: number;
  } | null>(null);

  const activeReviewCountByQuestionId = useMemo(
    () =>
      new Map(
        reviewCounts.map((item) => [item.questionId, item.reviewCount]),
      ),
    [reviewCounts],
  );

  const pendingResetActiveCount = pendingResetQuestionId
    ? activeReviewCountByQuestionId.get(pendingResetQuestionId) ?? 0
    : 0;

  const confirmResetReviews = async (questionId: string) => {
    const activeCount = activeReviewCountByQuestionId.get(questionId) ?? 0;
    const sourceVersion = sourceVersions.questions.get(questionId);
    if (activeCount === 0 || !sourceVersion) {
      setPendingResetQuestionId(null);
      return;
    }

    setResetBusyQuestionId(questionId);
    setResetError("");
    setResetResult(null);
    try {
      const result = await resetQuestionReviews(questionId, sourceVersion);
      setResetResult({
        questionId: result.questionId,
        reviewsReset: result.reviewsReset,
      });
      // resetQuestionReviews invalidates the effective master-data cache, which
      // re-runs this page's Promise.all through useAsyncData.
    } catch (caught) {
      setResetError(
        caught instanceof Error
          ? caught.message
          : isIndonesian
            ? "Reset review gagal."
            : "Reset failed.",
      );
    } finally {
      setResetBusyQuestionId("");
      setPendingResetQuestionId(null);
    }
  };

  const weekOptions = useMemo(
    () => getMaterialWeekOptions(questions),
    [questions],
  );
  const filteredQuestions = useMemo(
    () => filterMaterialQuestions(questions, { searchQuery, week, type }),
    [questions, searchQuery, type, week],
  );
  const pageCount = Math.max(1, Math.ceil(filteredQuestions.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleQuestions = filteredQuestions.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );
  const misconceptionById = useMemo(
    () => new Map(misconceptions.map((item) => [item.id, item])),
    [misconceptions],
  );

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [searchQuery, type, week]);

  // Modal-driven state — kept mounted across the post-reset useAsyncData refetch
  // (which briefly flips the page to its loading state) so the dialogs never flash.
  const resetDialogs = (
    <>
      <ConfirmDialog
        open={pendingResetQuestionId !== null}
        align="center"
        title={
          isIndonesian
            ? `Reset review ${pendingResetQuestionId ?? ""}?`
            : `Reset reviews for ${pendingResetQuestionId ?? ""}?`
        }
        description={
          isIndonesian
            ? `${pendingResetActiveCount} review aktif akan direset dan riwayat tetap tersimpan`
            : `${pendingResetActiveCount} active ${
                pendingResetActiveCount === 1 ? "review" : "reviews"
              } will be reset and history is kept`
        }
        cancelLabel={isIndonesian ? "Batal" : "Cancel"}
        confirmLabel={isIndonesian ? "Reset Review" : "Reset Reviews"}
        confirmVariant="primary"
        confirming={resetBusyQuestionId !== ""}
        onCancel={() => {
          if (resetBusyQuestionId === "") setPendingResetQuestionId(null);
        }}
        onConfirm={() => {
          if (pendingResetQuestionId) {
            void confirmResetReviews(pendingResetQuestionId);
          }
        }}
      />
      <ConfirmDialog
        open={resetResult !== null}
        align="center"
        accent={
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand text-white shadow-sm">
            <Check size={26} strokeWidth={3} aria-hidden="true" />
          </span>
        }
        title={isIndonesian ? "Review berhasil direset" : "Reviews reset"}
        confirmLabel={isIndonesian ? "Tutup" : "Close"}
        confirmVariant="secondary"
        onCancel={() => setResetResult(null)}
        onConfirm={() => setResetResult(null)}
      />
    </>
  );

  if (loading) {
    return (
      <>
        {resetDialogs}
        <EmptyState
          loading
          message={isIndonesian ? "Memuat soal saat ini..." : "Loading current questions..."}
        />
      </>
    );
  }

  if (error) {
    return (
      <>
        {resetDialogs}
        <p
          role="alert"
          className="rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm leading-6 text-incorrect"
        >
          {isIndonesian
            ? "Soal saat ini belum dapat dimuat. Silakan coba lagi."
            : "Current questions could not be loaded. Please try again."}
        </p>
      </>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1180px]" aria-labelledby="admin-questions-title">
      {resetDialogs}
      <header className="border-b border-border pb-5">
        <h1 id="admin-questions-title" className="text-2xl font-semibold tracking-tight text-navy-deep">
          {isIndonesian ? "Kelola Soal" : "Manage Questions"}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          {isIndonesian
            ? "Lihat data soal yang sedang digunakan di Progmiscon."
            : "View the question data currently used in Progmiscon."}
        </p>
      </header>

      {resetError && (
        <p role="alert" className="mt-4 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2 text-sm leading-6 text-incorrect">
          {resetError}
        </p>
      )}

      <div className="grid gap-3 py-5 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1fr)_180px_180px]">
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">{isIndonesian ? "Cari soal" : "Search questions"}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder={isIndonesian ? "Cari kode atau judul soal" : "Search question code or title"}
            className="h-10 w-full rounded-lg border border-border bg-white py-2 pl-9 pr-3 text-sm text-navy-deep outline-none placeholder:text-muted focus:border-brand focus:ring-2 focus:ring-brand/15"
          />
        </label>
        <AdminFilterSelect
          label={isIndonesian ? "Filter minggu" : "Filter by week"}
          value={week}
          onChange={(event) => setWeek(event.target.value)}
        >
          <option value="all">{isIndonesian ? "Semua minggu" : "All weeks"}</option>
          <option value="unassigned">{isIndonesian ? "Tanpa minggu" : "Unassigned"}</option>
          {weekOptions.map((item) => (
            <option key={item} value={item}>{getMaterialWeekLabel(item)}</option>
          ))}
        </AdminFilterSelect>
        <AdminFilterSelect
          label={isIndonesian ? "Filter tipe" : "Filter by type"}
          value={type}
          onChange={(event) => setType(event.target.value as MaterialQuestionTypeFilter)}
        >
          <option value="all">{isIndonesian ? "Semua tipe" : "All types"}</option>
          <option value="ps">PS</option>
          <option value="mp">MP</option>
        </AdminFilterSelect>
      </div>

      <div className="mb-3 flex items-center justify-between gap-3 text-xs text-muted">
        <p>{filteredQuestions.length} {isIndonesian ? "soal" : "questions"}</p>
        {pageCount > 1 && <p>{isIndonesian ? "Halaman" : "Page"} {safePage} / {pageCount}</p>}
      </div>

      {visibleQuestions.length === 0 ? (
        <EmptyState message={isIndonesian ? "Tidak ada soal yang sesuai dengan filter ini." : "No questions match these filters."} />
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-white">
          {visibleQuestions.map((question) => {
            const expanded = expandedId === question.id;
            const misconceptionItems = question.questionMisconceptionIds
              .map((id) => misconceptionById.get(id))
              .filter((item): item is Misconception => item !== undefined);
            const activeReviewCount =
              activeReviewCountByQuestionId.get(question.id) ?? 0;
            const resetBusy = resetBusyQuestionId === question.id;

            return (
              <article key={question.id}>
                <button
                  type="button"
                  onClick={() => setExpandedId(expanded ? null : question.id)}
                  aria-expanded={expanded}
                  className="flex min-h-16 w-full cursor-pointer items-start gap-3 px-4 py-3 text-left hover:bg-neutral/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:px-5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                      <span className="text-brand">{question.displayCode?.trim() || `${isIndonesian ? "Soal" : "Question"} ${question.number}`}</span>
                      <span>{question.type === "multiple_choice" ? (isIndonesian ? "Pilihan Ganda" : "Multiple Choice") : (isIndonesian ? "Esai" : "Essay")}</span>
                      <span>{question.week ? getMaterialWeekLabel(question.week) : isIndonesian ? "Tanpa minggu" : "Unassigned"}</span>
                      {activeReviewCount > 0 && (
                        <span className="rounded-md border border-correct-border bg-correct-bg px-1.5 py-0.5 font-semibold text-correct">
                          {isIndonesian ? "Review" : "Reviews"} {activeReviewCount}/3
                        </span>
                      )}
                    </div>
                    <h2 className="mt-1 text-sm font-medium leading-5 text-navy-deep">
                      {t(question.title, language)}
                    </h2>
                    {question.shortDescription && (
                      <p className="mt-1 line-clamp-1 text-xs leading-5 text-muted">
                        {t(question.shortDescription, language)}
                      </p>
                    )}
                  </div>
                  <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs text-brand">
                    {expanded ? (isIndonesian ? "Tutup" : "Close") : (isIndonesian ? "Lihat" : "View")}
                    {expanded ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-border bg-[var(--progmiscon-background)]/60 px-4 py-5 sm:px-5">
                    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-white px-4 py-3">
                      <div className="text-xs leading-5 text-navy-deep">
                        <p className="font-semibold">
                          {isIndonesian ? "Review dosen" : "Lecturer reviews"}
                        </p>
                        <p className="mt-0.5 text-muted">
                          {activeReviewCount > 0
                            ? isIndonesian
                              ? `${activeReviewCount}/3 review dosen aktif.`
                              : `${activeReviewCount}/3 active lecturer reviews.`
                            : isIndonesian
                              ? "Belum ada review dosen aktif."
                              : "No active lecturer reviews yet."}
                        </p>
                      </div>
                      {activeReviewCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setPendingResetQuestionId(question.id)}
                          disabled={resetBusy}
                          className="inline-flex min-h-9 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-brand bg-brand px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:border-brand-deep hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <RotateCcw size={14} strokeWidth={2} aria-hidden="true" />
                          {resetBusy
                            ? isIndonesian ? "Mereset..." : "Resetting..."
                            : isIndonesian ? "Reset Review" : "Reset Reviews"}
                        </button>
                      )}
                    </section>

                    <QuestionContent question={question} />

                    {question.type === "multiple_choice" && question.options && question.options.length > 0 && (
                      <section className="mt-5" aria-label={isIndonesian ? "Pilihan jawaban" : "Answer options"}>
                        <h3 className="text-xs font-semibold text-navy-deep">{isIndonesian ? "Pilihan jawaban" : "Answer options"}</h3>
                        <ol className="mt-2 grid gap-2 sm:grid-cols-2">
                          {question.options.map((option) => (
                            <li key={option.id} className="flex gap-2 rounded-md border border-border bg-white px-3 py-2 text-xs leading-5 text-navy-deep">
                              <span className="font-semibold">{option.label}.</span>
                              <span className="min-w-0 flex-1">{t(option.text, language)}</span>
                              {option.isCorrect && (
                                <span className="shrink-0 text-correct">{isIndonesian ? "Benar" : "Correct"}</span>
                              )}
                            </li>
                          ))}
                        </ol>
                      </section>
                    )}

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <section>
                        <h3 className="text-xs font-semibold text-navy-deep">{isIndonesian ? "Konsep yang diharapkan" : "Expected concepts"}</h3>
                        {question.expectedConcepts.length > 0 ? (
                          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-navy-deep">
                            {question.expectedConcepts.map((concept, index) => <li key={`${t(concept, language)}-${index}`}>{t(concept, language)}</li>)}
                          </ul>
                        ) : <p className="mt-2 text-xs text-muted">{isIndonesian ? "Belum tersedia." : "Not available."}</p>}
                      </section>
                      <section>
                        <h3 className="text-xs font-semibold text-navy-deep">{isIndonesian ? "Miskonsepsi terkait" : "Related misconceptions"}</h3>
                        {misconceptionItems.length > 0 ? (
                          <ul className="mt-2 space-y-1.5 text-xs leading-5 text-navy-deep">
                            {misconceptionItems.map((item) => <li key={item.id}>{t(item.title, language)}</li>)}
                          </ul>
                        ) : <p className="mt-2 text-xs text-muted">{isIndonesian ? "Belum tersedia." : "Not available."}</p>}
                      </section>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-5 flex justify-end gap-2" aria-label={isIndonesian ? "Halaman soal" : "Question pages"}>
          {getMaterialPaginationItems(safePage, pageCount).map((item) => (
            <button
              key={item}
              type="button"
              aria-current={item === safePage ? "page" : undefined}
              onClick={() => setPage(item)}
              className={`h-10 min-w-10 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${item === safePage ? "border-brand bg-brand text-white" : "border-border bg-white text-navy-deep hover:bg-neutral"}`}
            >
              {item}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}
