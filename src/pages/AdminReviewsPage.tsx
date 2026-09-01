import { useEffect, useMemo, useState } from "react";
import { Download, Search } from "lucide-react";
import { AdminFilterSelect } from "../components/admin/AdminFilterSelect";
import { EmptyState } from "../components/common/EmptyState";
import { useAsyncData } from "../hooks/useAsyncData";
import { useLanguage } from "../hooks/useLanguage";
import {
  getAdminReviewReadSnapshot,
  type AdminReviewReadSnapshot,
} from "../services/adminReadRepository";
import type {
  AdminAnswerReviewHistoryItem,
  AdminQuestionReviewHistoryItem,
  Language,
  Misconception,
  ReviewLifecycleRow,
} from "../types";
import {
  countCurrentAdminReviewRows,
  groupCurrentAdminReviews,
  indexReviewLifecycle,
  resolveReviewLifecycleLabels,
  type AdminQuestionReviewGroup,
  type AdminReviewerReviewGroup,
} from "../utils/adminCurrentReviews";
import { buildCurrentReviewsCsv } from "../utils/adminExports";
import {
  getMaterialPaginationItems,
  getMaterialQuestionIdentifier,
  getMaterialQuestionType,
  getMaterialWeekLabel,
  getMaterialWeekOptions,
  type MaterialQuestionTypeFilter,
} from "../utils/materialQuestionFilters";
import { downloadCsvFile, wibDateStamp } from "../utils/reviewCsv";
import { t } from "../utils/translation";

const PAGE_SIZE = 8;
const emptySnapshot: AdminReviewReadSnapshot = {
  current: {
    questionReviews: [],
    answerReviews: [],
    deletedQuestionReviews: [],
    deletedAnswerReviews: [],
    reviewers: [],
    excluded: { inactive: 0, staleOrUnverifiable: 0 },
  },
  lifecycle: [],
  questions: [],
  answers: [],
  misconceptions: [],
};

const STATUS_LABEL = { active: "Aktif", deleted: "Dihapus" } as const;
// Presentation wording only: an initial (never-edited) active review reads as
// "Direview" / "Reviewed". The underlying audit event type stays `created`.
const ACTIVITY_LABEL_ID = {
  created: "Direview",
  edited: "Diedit",
  deleted: "Dihapus",
} as const;
const ACTIVITY_LABEL_EN = {
  created: "Reviewed",
  edited: "Edited",
  deleted: "Deleted",
} as const;

function formatDate(value: string, language: Language): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "id" ? "id-ID" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatReviewItemCount(count: number, language: Language): string {
  if (language === "id") return `${count} item review`;
  return `${count} review ${count === 1 ? "item" : "items"}`;
}

function ReviewDetails({
  review,
  misconceptionById,
  language,
}: {
  review: AdminQuestionReviewHistoryItem | AdminAnswerReviewHistoryItem;
  misconceptionById: ReadonlyMap<string, Misconception>;
  language: Language;
}) {
  const isIndonesian = language === "id";
  const isQuestionReview = "hasIncorrectMisconceptions" in review;
  const hasMismatch = isQuestionReview
    ? review.hasIncorrectMisconceptions
    : review.hasMismatchedMisconceptions;
  const itemLabel = (id: string) => {
    const item = misconceptionById.get(id);
    return item ? t(item.title, language) : id;
  };
  const sections = [
    {
      label: isIndonesian ? "Ditandai tidak sesuai" : "Marked as mismatched",
      value: hasMismatch ? (isIndonesian ? "Ya" : "Yes") : (isIndonesian ? "Tidak" : "No"),
    },
    {
      label: isIndonesian ? "Miskonsepsi yang dihapus" : "Removed misconceptions",
      value: review.removedMisconceptionIds.map(itemLabel).join("; ") || (isIndonesian ? "Tidak ada" : "None"),
    },
    {
      label: isIndonesian ? "Alasan penghapusan" : "Removal reason",
      value: review.removalReason || (isIndonesian ? "Tidak ada" : "None"),
    },
    {
      label: isIndonesian ? "Miskonsepsi tambahan" : "Additional misconceptions",
      value: review.additionalMisconceptionIds.map(itemLabel).join("; ") || (isIndonesian ? "Tidak ada" : "None"),
    },
    {
      label: isIndonesian ? "Alasan penambahan" : "Addition reason",
      value: review.additionReason || (isIndonesian ? "Tidak ada" : "None"),
    },
    {
      label: isIndonesian ? "Catatan" : "Note",
      value: review.note || (isIndonesian ? "Tidak ada" : "None"),
    },
  ];

  return (
    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
      {sections.map((section) => (
        <div key={section.label}>
          <p className="text-[11px] text-muted">{section.label}</p>
          <p className="mt-0.5 whitespace-pre-wrap text-xs leading-5 text-navy-deep">{section.value}</p>
        </div>
      ))}
      <p className="text-[11px] text-muted sm:col-span-2">
        {isIndonesian ? "Diperbarui" : "Updated"}: {formatDate(review.updatedAt, language)}
      </p>
    </div>
  );
}

function LifecycleBadge({
  review,
  lifecycleByReviewId,
  language,
}: {
  review: { id: string; isActive: boolean; inactiveReason: string | null };
  lifecycleByReviewId: ReadonlyMap<
    string,
    ReviewLifecycleRow
  >;
  language: Language;
}) {
  const { status, lastActivity } = resolveReviewLifecycleLabels(
    review,
    lifecycleByReviewId,
  );
  const activityLabel =
    language === "id"
      ? ACTIVITY_LABEL_ID[lastActivity]
      : ACTIVITY_LABEL_EN[lastActivity];
  const statusLabel =
    language === "id"
      ? STATUS_LABEL[status]
      : status === "active"
        ? "Active"
        : "Deleted";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${
        status === "deleted"
          ? "border-border bg-neutral text-muted"
          : "border-correct-border bg-correct-bg text-correct"
      }`}
    >
      <span>{statusLabel}</span>
      <span className="font-normal opacity-70">{activityLabel}</span>
    </span>
  );
}

function ReviewerReviewPanel({
  reviewerGroup,
  misconceptionById,
  lifecycleByReviewId,
  language,
  historical = false,
}: {
  reviewerGroup: AdminReviewerReviewGroup;
  misconceptionById: ReadonlyMap<string, Misconception>;
  lifecycleByReviewId: ReadonlyMap<
    string,
    ReviewLifecycleRow
  >;
  language: Language;
  historical?: boolean;
}) {
  const isIndonesian = language === "id";
  const questionReview = reviewerGroup.questionReview;
  return (
    <details>
      <summary className="cursor-pointer list-none px-4 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:px-5 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm text-navy-deep">
              {reviewerGroup.reviewer.fullName || reviewerGroup.reviewer.email}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-muted">{reviewerGroup.reviewer.email}</p>
          </div>
          <span className="shrink-0 text-right text-xs text-muted">
            <span className="block text-brand">{isIndonesian ? "Lihat Review" : "View Review"}</span>
            <span className="mt-0.5 block">
              {formatReviewItemCount(questionReview ? 1 : 0, language)}
            </span>
          </span>
        </div>
      </summary>
      <div className="space-y-3 border-t border-border bg-[var(--progmiscon-background)]/60 px-4 py-4 sm:px-5">
        <section className="rounded-md border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-navy-deep">{isIndonesian ? "Review soal" : "Question review"}</h3>
            {questionReview && (
              <LifecycleBadge
                review={questionReview}
                lifecycleByReviewId={lifecycleByReviewId}
                language={language}
              />
            )}
          </div>
          {questionReview ? (
            <ReviewDetails review={questionReview} misconceptionById={misconceptionById} language={language} />
          ) : (
            <p className="text-xs text-muted">
              {historical
                ? isIndonesian
                  ? "Review soal tidak termasuk dalam penghapusan ini."
                  : "No question review in this deletion."
                : isIndonesian
                  ? "Belum ada review soal saat ini."
                  : "No current question review."}
            </p>
          )}
        </section>

      </div>
    </details>
  );
}

function filterReviewGroups(
  groups: readonly AdminQuestionReviewGroup[],
  filters: {
    query: string;
    reviewerId: string;
    type: MaterialQuestionTypeFilter;
    week: string;
  },
  language: Language,
): AdminQuestionReviewGroup[] {
  const query = filters.query.trim().toLocaleLowerCase();

  return groups.flatMap((group) => {
    if (
      filters.type !== "all" &&
      getMaterialQuestionType(group.question.type) !== filters.type
    ) return [];
    if (
      filters.week !== "all" &&
      (filters.week === "unassigned"
        ? group.question.week !== null
        : group.question.week !== filters.week)
    ) return [];

    const questionMatches =
      !query ||
      [
        group.question.id,
        getMaterialQuestionIdentifier(group.question),
        t(group.question.title, language),
        t(group.question.prompt, language),
      ].some((value) => value.toLocaleLowerCase().includes(query));
    const matchesReviewer = ({ reviewer }: AdminReviewerReviewGroup) => {
      if (filters.reviewerId !== "all" && reviewer.reviewerId !== filters.reviewerId) {
        return false;
      }
      return (
        questionMatches ||
        [reviewer.fullName, reviewer.email]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)
      );
    };
    const reviewers = group.reviewers.filter(matchesReviewer);
    const deletedReviewers = group.deletedReviewers.filter(matchesReviewer);

    return reviewers.length > 0 || deletedReviewers.length > 0
      ? [{ ...group, reviewers, deletedReviewers }]
      : [];
  });
}

export function AdminReviewsPage() {
  const { language } = useLanguage();
  const isIndonesian = language === "id";
  const { data, loading, error } = useAsyncData(
    getAdminReviewReadSnapshot,
    [],
    emptySnapshot,
  );
  const [query, setQuery] = useState("");
  const [week, setWeek] = useState("all");
  const [type, setType] = useState<MaterialQuestionTypeFilter>("all");
  const [reviewerId, setReviewerId] = useState("all");
  const [page, setPage] = useState(1);
  const groups = useMemo(
    () => groupCurrentAdminReviews(data.current, data.questions),
    [data],
  );
  const filteredGroups = useMemo(
    () => filterReviewGroups(groups, { query, reviewerId, type, week }, language),
    [groups, language, query, reviewerId, type, week],
  );
  const counts = useMemo(
    () => countCurrentAdminReviewRows(filteredGroups),
    [filteredGroups],
  );
  const weekOptions = useMemo(
    () => getMaterialWeekOptions(groups.map((group) => group.question)),
    [groups],
  );
  const reviewerOptions = useMemo(() => {
    const seen = new Map<string, { id: string; label: string }>();
    for (const group of groups) {
      for (const reviewerGroup of [
        ...group.reviewers,
        ...group.deletedReviewers,
      ]) {
        const reviewer = reviewerGroup.reviewer;
        seen.set(reviewer.reviewerId, {
          id: reviewer.reviewerId,
          label: reviewer.fullName || reviewer.email || reviewer.reviewerId,
        });
      }
    }
    return [...seen.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [groups]);
  const lifecycleByReviewId = useMemo(
    () => indexReviewLifecycle(data.lifecycle),
    [data.lifecycle],
  );
  const misconceptionById = useMemo(
    () => new Map(data.misconceptions.map((item) => [item.id, item])),
    [data.misconceptions],
  );
  const pageCount = Math.max(1, Math.ceil(filteredGroups.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const visibleGroups = filteredGroups.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  useEffect(() => setPage(1), [query, reviewerId, type, week]);

  const handleExport = () => {
    const csv = buildCurrentReviewsCsv(filteredGroups, {
      misconceptions: data.misconceptions,
      language,
      lifecycle: data.lifecycle,
    });
    downloadCsvFile(
      `progmiscon_hasil_review_dosen_${wibDateStamp()}.csv`,
      csv.headers,
      csv.rows,
    );
  };

  if (loading) {
    return <EmptyState loading message={isIndonesian ? "Memuat review saat ini..." : "Loading current reviews..."} />;
  }

  if (error) {
    return (
      <p role="alert" className="rounded-lg border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm leading-6 text-incorrect">
        {isIndonesian
          ? "Review saat ini belum dapat dimuat. Silakan coba lagi."
          : "Current reviews could not be loaded. Please try again."}
      </p>
    );
  }

  return (
    <section className="mx-auto w-full max-w-[1180px]" aria-labelledby="admin-reviews-title">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 id="admin-reviews-title" className="text-2xl font-semibold tracking-tight text-navy-deep">
            {isIndonesian ? "Hasil Review Dosen" : "Lecturer Review Results"}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {isIndonesian
              ? "Review aktif untuk versi sumber saat ini, ditambah generasi yang dihapus lecturer sebagai riwayat. Hitungan reviewer hanya memakai review aktif."
              : "Active reviews for the current source version, plus lecturer-deleted generations as history. Reviewer counts use active reviews only."}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={counts.totalReviews === 0}
          className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Download size={16} aria-hidden="true" />
          {isIndonesian ? "Unduh Hasil Review (CSV)" : "Download Review Results (CSV)"}
        </button>
      </header>

      {(data.current.excluded.inactive > 0 || data.current.excluded.staleOrUnverifiable > 0) && (
        <p className="mt-4 rounded-md border border-border bg-neutral/50 px-3 py-2 text-xs leading-5 text-muted">
          {isIndonesian
            ? `${data.current.excluded.inactive + data.current.excluded.staleOrUnverifiable} baris disembunyikan karena sumbernya diperbarui, sudah usang, atau tidak dapat diverifikasi terhadap sumber saat ini (bukan penghapusan oleh lecturer).`
            : `${data.current.excluded.inactive + data.current.excluded.staleOrUnverifiable} rows are hidden because their source was updated, is stale, or cannot be verified against the current source (not a lecturer deletion).`}
        </p>
      )}

      <div className="grid gap-3 py-5 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_160px_160px_220px]">
        <label className="relative block sm:col-span-2 xl:col-span-1">
          <span className="sr-only">{isIndonesian ? "Cari review" : "Search reviews"}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={isIndonesian ? "Cari soal atau reviewer" : "Search question or reviewer"}
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
          {weekOptions.map((item) => <option key={item} value={item}>{getMaterialWeekLabel(item)}</option>)}
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
        <AdminFilterSelect
          label={isIndonesian ? "Filter reviewer" : "Filter by reviewer"}
          value={reviewerId}
          onChange={(event) => setReviewerId(event.target.value)}
        >
          <option value="all">{isIndonesian ? "Semua reviewer" : "All reviewers"}</option>
          {reviewerOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </AdminFilterSelect>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border">
        {[
          [isIndonesian ? "Soal" : "Questions", counts.questions],
          ["Reviewer", counts.reviewers],
          [isIndonesian ? "Review soal" : "Question reviews", counts.questionReviews],
        ].map(([label, value]) => (
          <div key={label} className="bg-white px-4 py-3">
            <p className="text-[11px] text-muted">{label}</p>
            <p className="mt-1 text-lg font-semibold text-navy-deep">{value}</p>
          </div>
        ))}
      </div>

      {visibleGroups.length === 0 ? (
        <EmptyState message={isIndonesian ? "Tidak ada review saat ini yang sesuai dengan filter." : "No current reviews match these filters."} />
      ) : (
        <div className="space-y-3">
          {visibleGroups.map((group) => (
            <article key={group.question.id} className="overflow-hidden rounded-lg border border-border bg-white">
              <header className="border-b border-border px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
                  <span className="text-brand">{group.question.displayCode?.trim() || `${isIndonesian ? "Soal" : "Question"} ${group.question.number}`}</span>
                  <span>{group.question.type === "multiple_choice" ? (isIndonesian ? "Pilihan Ganda" : "Multiple Choice") : (isIndonesian ? "Esai" : "Essay")}</span>
                  <span>{group.question.week ? getMaterialWeekLabel(group.question.week) : isIndonesian ? "Tanpa minggu" : "Unassigned"}</span>
                </div>
                <h2 className="mt-1 text-sm font-medium leading-5 text-navy-deep">{t(group.question.title, language)}</h2>
              </header>
              <div className="divide-y divide-border">
                {group.reviewers.map((reviewerGroup) => (
                  <ReviewerReviewPanel
                    key={reviewerGroup.reviewer.reviewerId}
                    reviewerGroup={reviewerGroup}
                    misconceptionById={misconceptionById}
                    lifecycleByReviewId={lifecycleByReviewId}
                    language={language}
                  />
                ))}
              </div>
              {group.deletedReviewers.length > 0 && (
                <div className="border-t border-border bg-neutral/40">
                  <p className="px-4 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted sm:px-5">
                    {isIndonesian ? "Riwayat dihapus" : "Deleted history"}
                  </p>
                  <p className="px-4 pb-2 text-[11px] leading-4 text-muted sm:px-5">
                    {isIndonesian
                      ? "Generasi review yang dihapus lecturer. Tidak dihitung sebagai reviewer aktif dan tidak ikut konsensus."
                      : "Lecturer-deleted review generations. Not counted as active reviewers and excluded from consensus."}
                  </p>
                  <div className="divide-y divide-border">
                    {group.deletedReviewers.map((reviewerGroup, index) => (
                      <ReviewerReviewPanel
                        key={`${reviewerGroup.reviewer.reviewerId}-deleted-${index}`}
                        reviewerGroup={reviewerGroup}
                        misconceptionById={misconceptionById}
                        lifecycleByReviewId={lifecycleByReviewId}
                        language={language}
                        historical
                      />
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <nav className="mt-5 flex justify-end gap-2" aria-label={isIndonesian ? "Halaman review" : "Review pages"}>
          {getMaterialPaginationItems(safePage, pageCount).map((item) => (
            <button key={item} type="button" aria-current={item === safePage ? "page" : undefined} onClick={() => setPage(item)} className={`h-10 min-w-10 rounded-md border px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${item === safePage ? "border-brand bg-brand text-white" : "border-border bg-white text-navy-deep hover:bg-neutral"}`}>
              {item}
            </button>
          ))}
        </nav>
      )}
    </section>
  );
}
