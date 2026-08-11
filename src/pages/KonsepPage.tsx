import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Search,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { useCategories } from "../hooks/useCategories";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions } from "../hooks/useQuestions";
import { useLanguage } from "../hooks/useLanguage";
import { Breadcrumb } from "../components/layout/Breadcrumb";
import { EmptyState } from "../components/common/EmptyState";
import { ConceptIcon } from "../components/concept/ConceptIcon";
import { buildConcepts } from "../utils/concepts";
import { cn } from "../utils/cn";
import {
  filterMaterialQuestions,
  getMaterialPaginationItems,
  getMaterialQuestionIdentifier,
  getMaterialQuestionType,
  getMaterialWeekLabel,
} from "../utils/materialQuestionFilters";
import { matchesMisconceptionSearch } from "../utils/misconceptionLabel";
import { t, uiText } from "../utils/translation";
import type { Language, LocalizedText, Misconception, Question } from "../types";

const QUESTIONS_PER_PAGE = 5;
const INITIAL_MISCONCEPTION_COUNT = 6;

type ConceptView = "material" | "questions" | "misconceptions";

const CORE_MATERIAL_PLACEHOLDER: Record<Language, string[]> = {
  id: [
    "Bagian ini menyiapkan ringkasan materi pokok untuk konsep yang sedang dipelajari. Materi terstruktur akan ditambahkan pada tahap berikutnya.",
    "Gunakan deskripsi konsep sebagai pengantar, lalu hubungkan pemahaman Anda dengan soal evaluasi dan daftar miskonsepsi pada tab lain.",
  ],
  en: [
    "This section provides a temporary core-material overview for the concept being studied. Structured material will be added in a later stage.",
    "Use the concept description as an introduction, then connect your understanding with the evaluation questions and misconceptions in the other tabs.",
  ],
};

const conceptCardDescriptions: Record<string, LocalizedText> = {
  "Alur Eksekusi": {
    id: "Urutan langkah yang dijalankan program dari awal hingga selesai",
    en: "The order in which a program runs its instructions from start to finish",
  },
  Ekspresi: {
    id: "Gabungan nilai, variabel, dan operator yang menghasilkan suatu nilai",
    en: "A combination of values, variables, and operators that produces a value",
  },
  "Input/Output": {
    id: "Cara program menerima data dan menampilkan hasil",
    en: "How a program receives data and displays results",
  },
  Konstanta: {
    id: "Nilai tetap yang tidak berubah selama program berjalan",
    en: "A fixed value that does not change while a program runs",
  },
  Operator: {
    id: "Simbol untuk melakukan operasi pada nilai atau variabel",
    en: "Symbols used to perform operations on values or variables",
  },
  Percabangan: {
    id: "Pemilihan alur program berdasarkan kondisi tertentu",
    en: "Choosing a program path based on a condition",
  },
  Perulangan: {
    id: "Menjalankan instruksi berulang kali selama syarat terpenuhi",
    en: "Running instructions repeatedly while a condition is met",
  },
  Variabel: {
    id: "Tempat menyimpan nilai yang dapat digunakan dan diubah program",
    en: "A named place for storing values a program can use and change",
  },
};

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

function questionTypeLabel(question: Question, language: Language): string {
  if (getMaterialQuestionType(question.type) === "mp") {
    return language === "id" ? "Pilihan Ganda" : "Multiple Choice";
  }
  return language === "id" ? "Esai" : "Essay";
}

function misconceptionTitle(misconception: Misconception, language: Language): string {
  const title = t(misconception.title, language).trim();
  if (!title.toLocaleLowerCase().startsWith(misconception.id.toLocaleLowerCase())) return title;
  return title.slice(misconception.id.length).replace(/^[\s:–—-]+/, "") || title;
}

function ConceptTabs({
  activeView,
  language,
  questionCount,
  misconceptionCount,
  onChange,
}: {
  activeView: ConceptView;
  language: Language;
  questionCount: number;
  misconceptionCount: number;
  onChange: (view: ConceptView) => void;
}) {
  const tabs: { id: ConceptView; label: string; icon: LucideIcon; count?: number }[] = [
    {
      id: "material",
      label: language === "id" ? "Materi Pokok" : "Core Material",
      icon: BookOpen,
    },
    {
      id: "questions",
      label: language === "id" ? "Soal Evaluasi" : "Evaluation Questions",
      icon: ClipboardList,
      count: questionCount,
    },
    {
      id: "misconceptions",
      label: language === "id" ? "Miskonsepsi" : "Misconceptions",
      icon: TriangleAlert,
      count: misconceptionCount,
    },
  ];

  return (
    <nav
      aria-label={language === "id" ? "Isi konsep" : "Concept content"}
      className="hide-scrollbar -mx-4 overflow-x-auto border-b border-border px-4 sm:mx-0 sm:px-0"
    >
      <div className="mx-auto flex w-max min-w-full justify-center gap-1 sm:min-w-0 sm:gap-3" role="tablist">
        {tabs.map(({ id, label, icon: Icon, count }) => {
          const active = activeView === id;
          return (
            <button
              key={id}
              id={`concept-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`concept-panel-${id}`}
              onClick={() => onChange(id)}
              className={cn(
                "relative inline-flex min-h-12 cursor-pointer items-center gap-2 whitespace-nowrap px-3 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:px-4 sm:text-sm",
                active ? "text-brand" : "text-muted hover:text-navy-deep",
              )}
            >
              <Icon size={15} strokeWidth={2} aria-hidden="true" />
              {label}
              {typeof count === "number" && (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] tabular-nums",
                    active ? "bg-brand-soft text-brand-deep" : "bg-neutral text-muted",
                  )}
                >
                  {count}
                </span>
              )}
              <span
                aria-hidden="true"
                className={cn(
                  "absolute inset-x-3 bottom-0 h-0.5 rounded-t bg-brand transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export function KonsepPage() {
  const { conceptId } = useParams();
  const { language } = useLanguage();
  const { categories, loading: categoriesLoading } = useCategories();
  const { misconceptions, loading: misconceptionsLoading } = useMisconceptions();
  const { questions: allQuestions, loading: questionsLoading } = useQuestions();
  const [activeView, setActiveView] = useState<ConceptView>("material");
  const [questionSearch, setQuestionSearch] = useState("");
  const [misconceptionSearch, setMisconceptionSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [visibleMisconceptionCount, setVisibleMisconceptionCount] = useState(
    INITIAL_MISCONCEPTION_COUNT,
  );

  const concepts = useMemo(
    () => buildConcepts(categories, allQuestions, misconceptions),
    [categories, allQuestions, misconceptions],
  );
  const mainConcepts = useMemo(
    () => concepts.filter((concept) => categories.some((category) => category.id === concept.id)),
    [categories, concepts],
  );
  const sortedConcepts = useMemo(
    () =>
      [...mainConcepts].sort((a, b) =>
        t(a.name, language).localeCompare(t(b.name, language), undefined, { sensitivity: "base" }),
      ),
    [mainConcepts, language],
  );
  const currentConcept = sortedConcepts.find((concept) => concept.id === conceptId);
  const conceptMisconceptions = useMemo(
    () =>
      currentConcept
        ? currentConcept.relatedMisconceptionIds
            .map((misconceptionId) =>
              misconceptions.find((misconception) => misconception.id === misconceptionId),
            )
            .filter(isDefined)
        : [],
    [currentConcept, misconceptions],
  );
  const conceptQuestions = useMemo(() => {
    if (!currentConcept) return [];
    const questionIds = new Set(currentConcept.relatedQuestionIds);
    return allQuestions.filter((question) => questionIds.has(question.id));
  }, [allQuestions, currentConcept]);
  const filteredMisconceptions = useMemo(
    () =>
      conceptMisconceptions.filter((misconception) =>
        matchesMisconceptionSearch(misconception, misconceptionSearch),
      ),
    [conceptMisconceptions, misconceptionSearch],
  );
  const filteredQuestions = useMemo(
    () => filterMaterialQuestions(conceptQuestions, { searchQuery: questionSearch }),
    [conceptQuestions, questionSearch],
  );
  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE));
  const page = Math.min(currentPage, totalPages);
  const rangeStart = filteredQuestions.length === 0 ? 0 : (page - 1) * QUESTIONS_PER_PAGE + 1;
  const rangeEnd = Math.min(page * QUESTIONS_PER_PAGE, filteredQuestions.length);
  const visibleQuestions = filteredQuestions.slice(rangeStart - 1, rangeEnd);
  const paginationItems = getMaterialPaginationItems(page, totalPages);
  const firstPaginationPage = paginationItems[0] ?? 1;
  const lastPaginationPage = paginationItems.at(-1) ?? totalPages;

  useEffect(() => {
    setActiveView("material");
    setQuestionSearch("");
    setMisconceptionSearch("");
    setCurrentPage(1);
    setVisibleMisconceptionCount(INITIAL_MISCONCEPTION_COUNT);
  }, [conceptId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [questionSearch]);

  useEffect(() => {
    setVisibleMisconceptionCount(INITIAL_MISCONCEPTION_COUNT);
  }, [misconceptionSearch]);

  if (categoriesLoading || misconceptionsLoading || questionsLoading) {
    return (
      <EmptyState
        loading
        message={language === "id" ? "Memuat konsep..." : "Loading concept..."}
      />
    );
  }

  if (!conceptId) {
    return (
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 text-center">
          <h1 className="page-title">{t(uiText.konsepTitle, language)}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted">
            {t(uiText.konsepDescription, language)}
          </p>
        </header>

        <ul className="scroll-reveal grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedConcepts.map((concept, index) => {
            const count = concept.relatedMisconceptionIds.length;
            const code = categories.find((category) => category.id === concept.id)?.order ?? index + 1;
            const description = conceptCardDescriptions[concept.name.id] ?? concept.description;
            return (
              <li key={concept.id} className="min-w-0">
                <Link
                  to={`/konsep/${concept.id}`}
                  className="group relative isolate flex h-full min-h-42 flex-col overflow-hidden rounded-xl border border-border bg-white p-4 shadow-[0_8px_28px_rgba(71,45,43,0.045)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_12px_32px_rgba(71,45,43,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span
                    className={`pointer-events-none absolute text-brand/[0.065] ${
                      index % 2 === 0
                        ? "-bottom-5 -left-4 -rotate-6"
                        : "-bottom-7 left-4 rotate-6"
                    }`}
                    aria-hidden="true"
                  >
                    <ConceptIcon name={concept.name} size={92} />
                  </span>

                  <span className="relative text-[10px] font-bold tracking-[0.16em] text-brand">
                    KC-{String(code).padStart(2, "0")}
                  </span>
                  <h2 className="relative mt-1.5 text-lg font-bold leading-snug tracking-[-0.02em] text-navy-deep transition-colors group-hover:text-brand">
                    {t(concept.name, language)}
                  </h2>
                  <span className="relative mt-1.5 text-[13px] leading-5 text-muted">
                    {t(description, language)}
                  </span>
                  <span className="relative mt-auto flex items-end justify-end gap-3 pt-3">
                    <span className="text-[11px] leading-8 text-muted tabular-nums">
                      {count} {language === "id" ? "miskonsepsi" : "misconceptions"}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-white shadow-[0_4px_12px_rgba(182,37,42,0.18)] transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                      <ArrowRight size={15} strokeWidth={2} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!currentConcept) {
    return <EmptyState message={language === "id" ? "Konsep tidak ditemukan." : "Concept not found."} />;
  }

  const conceptOrder =
    categories.find((category) => category.id === currentConcept.id)?.order ??
    sortedConcepts.findIndex((concept) => concept.id === currentConcept.id) + 1;
  const visibleMisconceptions = filteredMisconceptions.slice(0, visibleMisconceptionCount);

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[
          { label: t(uiText.breadcrumbKonsep, language), to: "/konsep" },
          { label: t(currentConcept.name, language) },
        ]}
      />

      <header className="mx-auto mb-7 flex max-w-3xl flex-col items-center text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <ConceptIcon name={currentConcept.name} size={24} />
        </span>
        <span className="mt-3 text-[10px] font-bold tracking-[0.18em] text-brand">
          KC-{String(conceptOrder).padStart(2, "0")}
        </span>
        <h1 className="mt-1 text-3xl font-extrabold tracking-[-0.035em] text-navy-deep sm:text-4xl">
          {t(currentConcept.name, language)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {t(currentConcept.description, language)}
        </p>
      </header>

      <ConceptTabs
        activeView={activeView}
        language={language}
        questionCount={conceptQuestions.length}
        misconceptionCount={conceptMisconceptions.length}
        onChange={setActiveView}
      />

      <div className="pt-6 sm:pt-7">
        {activeView === "material" && (
          <section
            id="concept-panel-material"
            role="tabpanel"
            aria-labelledby="concept-tab-material"
            className="mx-auto max-w-3xl"
          >
            <div className="rounded-xl border border-border bg-white px-5 py-6 shadow-[0_8px_24px_rgba(71,45,43,0.035)] sm:px-7 sm:py-7">
              <h2 className="text-xl font-bold tracking-[-0.02em] text-navy-deep">
                {language === "id" ? "Materi Pokok" : "Core Material"}
              </h2>
              <div className="mt-5 space-y-4 border-t border-border pt-5 text-sm leading-7 text-muted">
                <p className="font-medium text-navy-deep">
                  {t(currentConcept.description, language)}
                </p>
                {CORE_MATERIAL_PLACEHOLDER[language].map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </div>
          </section>
        )}

        {activeView === "questions" && (
          <section
            id="concept-panel-questions"
            role="tabpanel"
            aria-labelledby="concept-tab-questions"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-[-0.02em] text-navy-deep">
                  {language === "id"
                    ? `Soal tentang ${t(currentConcept.name, language)}`
                    : `Questions about ${t(currentConcept.name, language)}`}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {conceptQuestions.length} {language === "id" ? "soal terkait" : "related questions"}
                </p>
              </div>
              <label className="relative w-full sm:w-72">
                <span className="sr-only">
                  {language === "id" ? "Cari soal" : "Search questions"}
                </span>
                <Search
                  size={15}
                  strokeWidth={2}
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={questionSearch}
                  onChange={(event) => setQuestionSearch(event.target.value)}
                  placeholder={language === "id" ? "Cari ID atau judul soal..." : "Search question ID or title..."}
                  className="academic-input h-10 pl-9 pr-3 text-xs placeholder:text-muted/65"
                />
              </label>
            </div>

            {filteredQuestions.length === 0 ? (
              <div className="mt-5">
                <EmptyState
                  message={
                    questionSearch.trim()
                      ? language === "id"
                        ? "Tidak ada soal yang cocok dengan pencarian."
                        : "No questions match your search."
                      : t(uiText.noQuestions, language)
                  }
                />
              </div>
            ) : (
              <>
                <div className="mt-5 overflow-hidden rounded-xl border border-border bg-white">
                  <div className="hidden grid-cols-[6.5rem_minmax(0,1.5fr)_7.5rem_5rem_minmax(9rem,1fr)_2rem] items-center gap-3 bg-neutral px-4 py-2.5 text-[9px] font-bold uppercase tracking-[0.08em] text-muted lg:grid">
                    <span>{language === "id" ? "ID Soal" : "Question ID"}</span>
                    <span>{language === "id" ? "Judul Soal" : "Question Title"}</span>
                    <span>{language === "id" ? "Tipe" : "Type"}</span>
                    <span>{language === "id" ? "Minggu" : "Week"}</span>
                    <span>{language === "id" ? "Konsep Terkait Lainnya" : "Other Related Concepts"}</span>
                    <span className="sr-only">{language === "id" ? "Buka" : "Open"}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {visibleQuestions.map((question) => {
                      const relatedConcepts = question.expectedConcepts.filter(
                        (concept) =>
                          concept.id !== currentConcept.name.id && concept.en !== currentConcept.name.en,
                      );
                      return (
                        <li key={question.id}>
                          <Link
                            to={`/question/${question.id}`}
                            className="group grid min-w-0 gap-3 px-4 py-4 transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand lg:grid-cols-[6.5rem_minmax(0,1.5fr)_7.5rem_5rem_minmax(9rem,1fr)_2rem] lg:items-center lg:py-3"
                          >
                            <span className="w-fit rounded border border-brand/15 bg-brand-soft px-2 py-0.5 text-[10px] font-bold tabular-nums text-brand-deep">
                              {getMaterialQuestionIdentifier(question)}
                            </span>
                            <span className="min-w-0 text-sm font-semibold leading-5 text-navy-deep transition-colors group-hover:text-brand">
                              {t(question.title, language).trim() || `${language === "id" ? "Soal" : "Question"} ${question.number || question.id}`}
                            </span>
                            <span className="text-xs text-muted lg:text-[11px]">
                              {questionTypeLabel(question, language)}
                            </span>
                            <span className="text-xs font-semibold tabular-nums text-muted lg:text-[11px]">
                              {question.week ? getMaterialWeekLabel(question.week) : "—"}
                            </span>
                            <span className="flex min-w-0 flex-wrap gap-1">
                              {relatedConcepts.length > 0 ? (
                                relatedConcepts.map((concept, index) => (
                                  <span
                                    key={`${concept.id}-${concept.en}-${index}`}
                                    className="rounded border border-border bg-neutral px-1.5 py-0.5 text-[9px] font-semibold text-muted"
                                  >
                                    {t(concept, language)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-xs text-muted">—</span>
                              )}
                            </span>
                            <ArrowRight
                              size={15}
                              strokeWidth={2}
                              aria-hidden="true"
                              className="hidden text-muted transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-brand lg:block"
                            />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                <div className="mt-4 flex min-h-11 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs tabular-nums text-muted" role="status" aria-live="polite">
                    {language === "id"
                      ? `Menampilkan ${rangeStart}–${rangeEnd} dari ${filteredQuestions.length} soal`
                      : `Showing ${rangeStart}–${rangeEnd} of ${filteredQuestions.length} questions`}
                  </p>

                  {totalPages > 1 && (
                    <nav
                      aria-label={language === "id" ? "Paginasi soal" : "Question pagination"}
                      className="grid w-[13.25rem] max-w-full grid-cols-6 items-center gap-1"
                    >
                      <button
                        type="button"
                        onClick={() => setCurrentPage((current) => Math.max(1, current - 1))}
                        disabled={page === 1}
                        aria-label={language === "id" ? "Halaman sebelumnya" : "Previous page"}
                        style={{ transform: "none" }}
                        className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-neutral hover:text-brand disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                      </button>

                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-8 place-items-center text-xs text-muted",
                          firstPaginationPage === 1 && "invisible",
                        )}
                      >
                        ...
                      </span>

                      {paginationItems.map((item) => (
                        <button
                          key={item}
                          type="button"
                          onClick={() => setCurrentPage(item)}
                          aria-current={item === page ? "page" : undefined}
                          aria-label={`${language === "id" ? "Halaman" : "Page"} ${item}`}
                          style={{ transform: "none" }}
                          className={cn(
                            "grid size-8 cursor-pointer place-items-center rounded-md text-[11px] font-bold tabular-nums focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                            item === page
                              ? "bg-brand text-white shadow-[0_4px_10px_rgba(143,28,32,0.18)]"
                              : "text-muted hover:bg-neutral hover:text-navy-deep",
                          )}
                        >
                          {item}
                        </button>
                      ))}

                      {paginationItems.length < 2 && <span aria-hidden="true" className="size-8" />}

                      <span
                        aria-hidden="true"
                        className={cn(
                          "grid size-8 place-items-center text-xs text-muted",
                          lastPaginationPage === totalPages && "invisible",
                        )}
                      >
                        ...
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((current) => Math.min(totalPages, current + 1))}
                        disabled={page === totalPages}
                        aria-label={language === "id" ? "Halaman berikutnya" : "Next page"}
                        style={{ transform: "none" }}
                        className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-neutral hover:text-brand disabled:cursor-default disabled:opacity-35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                      >
                        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </nav>
                  )}
                </div>
              </>
            )}
          </section>
        )}

        {activeView === "misconceptions" && (
          <section
            id="concept-panel-misconceptions"
            role="tabpanel"
            aria-labelledby="concept-tab-misconceptions"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-[-0.02em] text-navy-deep">
                  {language === "id"
                    ? `Miskonsepsi tentang ${t(currentConcept.name, language)}`
                    : `Misconceptions about ${t(currentConcept.name, language)}`}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {conceptMisconceptions.length}{" "}
                  {language === "id" ? "miskonsepsi terdokumentasi" : "documented misconceptions"}
                </p>
              </div>
              {conceptMisconceptions.length > 0 && (
                <label className="relative w-full sm:w-72">
                  <span className="sr-only">
                    {language === "id" ? "Cari miskonsepsi" : "Search misconceptions"}
                  </span>
                  <Search
                    size={15}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                  />
                  <input
                    type="search"
                    value={misconceptionSearch}
                    onChange={(event) => setMisconceptionSearch(event.target.value)}
                    placeholder={
                      language === "id"
                        ? "Cari kode atau judul miskonsepsi"
                        : "Search by code or title"
                    }
                    className="academic-input h-10 pl-9 pr-3 text-xs placeholder:text-muted/65"
                  />
                </label>
              )}
            </div>

            {conceptMisconceptions.length === 0 ? (
              <div className="mt-5">
                <EmptyState message={t(uiText.noConceptMisconceptions, language)} />
              </div>
            ) : filteredMisconceptions.length === 0 ? (
              <p className="mt-5 border-y border-border px-3 py-5 text-sm text-muted">
                {language === "id" ? "Miskonsepsi tidak ditemukan" : "No misconceptions found"}
              </p>
            ) : (
              <>
                <ul className="mt-5 divide-y divide-border border-y border-border">
                  {visibleMisconceptions.map((misconception) => (
                    <li key={misconception.id}>
                      <Link
                        to={`/miskonsepsi/${misconception.id}`}
                        className="group grid min-h-14 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-2 py-3 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:px-3"
                      >
                        <span className="rounded border border-brand/15 bg-brand-soft px-2 py-0.5 text-[9px] font-bold tabular-nums text-brand-deep">
                          {misconception.id}
                        </span>
                        <span className="min-w-0 text-[13px] font-semibold leading-5 text-navy-deep transition-colors group-hover:text-brand sm:text-sm">
                          {misconceptionTitle(misconception, language)}
                        </span>
                        <ArrowRight
                          size={15}
                          strokeWidth={2}
                          aria-hidden="true"
                          className="text-muted transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-brand"
                        />
                      </Link>
                    </li>
                  ))}
                </ul>

                {visibleMisconceptions.length < filteredMisconceptions.length && (
                  <div className="mt-5 flex justify-center">
                    <button
                      type="button"
                      onClick={() =>
                        setVisibleMisconceptionCount((count) =>
                          Math.min(count + INITIAL_MISCONCEPTION_COUNT, filteredMisconceptions.length),
                        )
                      }
                      className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-border bg-white px-4 text-xs font-semibold text-navy-deep transition-[border-color,color] hover:border-brand/35 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {language === "id" ? "Tampilkan lebih banyak" : "Show more"}
                      <ChevronDown size={14} strokeWidth={2} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
