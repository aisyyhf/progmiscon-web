import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Code2,
  Lightbulb,
  ListChecks,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Breadcrumb } from "../components/layout/Breadcrumb";
import { EmptyState } from "../components/common/EmptyState";
import { MisconceptionCompare } from "../components/misconception/MisconceptionCompare";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { useCategories } from "../hooks/useCategories";
import { useLanguage } from "../hooks/useLanguage";
import { getMaterialQuestionIdentifier } from "../utils/materialQuestionFilters";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions, useQuestionsByIds } from "../hooks/useQuestions";
import type { LocalizedText, Question } from "../types";
import { cn } from "../utils/cn";
import { buildConcepts } from "../utils/concepts";
import {
  getAnswerVariations,
  getRelatedQuestions,
} from "../utils/misconceptionExploration";
import { matchesMisconceptionSearch } from "../utils/misconceptionLabel";
import { t, uiText } from "../utils/translation";

const unavailableValues = new Set([
  "belum tersedia",
  "not yet available",
  "not available yet",
]);

function visibleText(value: LocalizedText | undefined, language: "id" | "en") {
  const text = value ? t(value, language).trim() : "";
  return text && !unavailableValues.has(text.toLocaleLowerCase()) ? text : "";
}

function SectionTitle({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-brand-soft text-brand">
        <Icon size={16} strokeWidth={2} aria-hidden="true" />
      </span>
      <h3 className="text-base font-bold tracking-[-0.01em] text-navy-deep">{children}</h3>
    </div>
  );
}

function RelatedQuestionLink({ question }: { question: Question }) {
  const { language } = useLanguage();
  const identifier = getMaterialQuestionIdentifier(question);
  const title = t(question.title, language).trim();

  return (
    <Link
      to={`/question/${question.id}`}
      className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
    >
      <span className="font-mono text-[11px] font-bold text-brand">{identifier}</span>
      <span className="line-clamp-2 text-sm font-medium leading-5 text-navy-deep">
        {title || question.id}
      </span>
      <ChevronRight
        size={15}
        strokeWidth={2}
        className="text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-brand"
        aria-hidden="true"
      />
    </Link>
  );
}

export function MiskonsepsiPage() {
  const { misconceptionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { misconceptions, loading } = useMisconceptions();
  const firstMisconceptionId = useMemo(
    () =>
      [...misconceptions].sort((left, right) =>
        t(left.title, language).localeCompare(t(right.title, language), undefined, {
          sensitivity: "base",
        }),
      )[0]?.id,
    [language, misconceptions],
  );
  const selectedMisconceptionId = misconceptionId ?? firstMisconceptionId;

  if (loading) {
    return (
      <EmptyState
        loading
        message={language === "id" ? "Memuat pusat miskonsepsi" : "Loading misconception center"}
      />
    );
  }

  return (
    <MiskonsepsiDetailPage
      misconceptionId={selectedMisconceptionId}
      misconceptions={misconceptions}
      fromQuestionId={searchParams.get("fromQuestion") ?? undefined}
      fromCaseId={searchParams.get("fromCase") ?? undefined}
      onNavigate={navigate}
    />
  );
}

function MiskonsepsiDetailPage({
  misconceptionId,
  misconceptions,
  fromQuestionId,
  fromCaseId,
  onNavigate,
}: {
  misconceptionId?: string;
  misconceptions: ReturnType<typeof useMisconceptions>["misconceptions"];
  fromQuestionId?: string;
  fromCaseId?: string;
  onNavigate: (to: string) => void;
}) {
  const { language } = useLanguage();
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const misconception = misconceptions.find((item) => item.id === misconceptionId);
  const { categories } = useCategories();
  const { questions: allQuestions } = useQuestions();
  const { questions: relatedQuestions } = useQuestionsByIds(
    misconception?.relatedQuestionIds ?? [],
  );
  const { answers } = useAllStudentAnswers();

  const orderedMisconceptions = useMemo(
    () =>
      [...misconceptions].sort((left, right) =>
        t(left.title, language).localeCompare(t(right.title, language), undefined, {
          sensitivity: "base",
        }),
      ),
    [language, misconceptions],
  );
  const filteredMisconceptions = useMemo(
    () => orderedMisconceptions.filter((item) => matchesMisconceptionSearch(item, query)),
    [orderedMisconceptions, query],
  );
  const concepts = useMemo(
    () => buildConcepts(categories, allQuestions, misconceptions),
    [allQuestions, categories, misconceptions],
  );
  const relatedConcepts = useMemo(
    () =>
      misconception
        ? concepts.filter((concept) =>
            concept.relatedMisconceptionIds.includes(misconception.id),
          )
        : [],
    [concepts, misconception],
  );
  const answerVariations = useMemo(() => getAnswerVariations(answers), [answers]);
  const explorationQuestions = useMemo(
    () =>
      misconception
        ? getRelatedQuestions(
            allQuestions,
            answerVariations,
            misconception.id,
            misconception.relatedQuestionIds,
          )
        : [],
    [allQuestions, answerVariations, misconception],
  );

  if (!misconceptionId || !misconception) {
    return (
      <EmptyState
        message={language === "id" ? "Miskonsepsi tidak ditemukan" : "Misconception not found"}
      />
    );
  }

  const reviewBackUrl = fromQuestionId
    ? `/question/${fromQuestionId}${fromCaseId ? `?case=${fromCaseId}` : ""}`
    : undefined;
  const description = visibleText(misconception.description ?? misconception.value, language);
  const cause = visibleText(misconception.cause, language);
  const causes = cause
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const fix = visibleText(misconception.fix, language);
  const unavailable = language === "id" ? "Belum tersedia" : "Not available yet";
  const hasWrongExample = misconception.hasWrongExample ?? Boolean(visibleText(misconception.wrong, language));
  const hasCorrectExample = misconception.hasCorrectExample ?? Boolean(visibleText(misconception.correct, language));
  const firstExplorationQuestion = explorationQuestions[0];
  const shownQuestions = relatedQuestions.slice(0, 4);
  const remainingQuestions = relatedQuestions.slice(4);

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb
        items={[
          { label: t(uiText.breadcrumbHome, language), to: "/" },
          { label: t(uiText.breadcrumbMiskonsepsi, language), to: "/miskonsepsi" },
          { label: `${misconception.id} - ${t(misconception.title, language)}` },
        ]}
      />

      {reviewBackUrl && (
        <button
          type="button"
          onClick={() => onNavigate(reviewBackUrl)}
          className="mb-5 inline-flex cursor-pointer items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-navy-deep shadow-sm transition-colors hover:border-brand/35 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
          {t(uiText.backToQuestionReview, language)}
        </button>
      )}

      <header className="grid gap-5 border-b border-border pb-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
        <div>
          <h1 className="page-title">{t(uiText.miskonsepsiTitle, language)}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted sm:text-[15px]">
            {t(uiText.miskonsepsiDescription, language)}
          </p>
        </div>
        <div>
          <label htmlFor="misconception-search" className="sr-only">
            {language === "id" ? "Cari miskonsepsi" : "Search misconceptions"}
          </label>
          <div className="relative">
            <Search
              size={17}
              strokeWidth={2}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
              aria-hidden="true"
            />
            <input
              id="misconception-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={
                language === "id"
                  ? "Cari kode atau judul miskonsepsi"
                  : "Search by code or misconception title"
              }
              className="academic-input h-11 pl-10 pr-3 text-sm placeholder:text-muted/70"
            />
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 pt-7 lg:grid-cols-[310px_minmax(0,1fr)] lg:items-start xl:grid-cols-[330px_minmax(0,1fr)]">
        <aside className="min-w-0">
          <button
            type="button"
            onClick={() => setListOpen((current) => !current)}
            aria-expanded={listOpen}
            aria-controls="misconception-list-panel"
            className="flex w-full cursor-pointer items-end justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:pointer-events-none"
          >
            <span>
              <span className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-navy-deep">
                {language === "id" ? "Daftar Miskonsepsi" : "Misconception List"}
              </span>
              <span className="mt-1 block text-xs font-medium tabular-nums text-muted">
                {filteredMisconceptions.length} {language === "id" ? "teridentifikasi" : "identified"}
              </span>
            </span>
            <ChevronDown
              size={17}
              strokeWidth={2}
              aria-hidden="true"
              className={cn(
                "mb-1 text-muted transition-transform lg:hidden",
                listOpen && "rotate-180",
              )}
            />
          </button>

          <div
            id="misconception-list-panel"
            className={cn(listOpen ? "block" : "hidden", "mt-4 lg:block")}
          >
            {filteredMisconceptions.length === 0 ? (
              <div className="rounded-lg border border-border bg-white px-4 py-5 text-sm leading-6 text-muted">
                {language === "id"
                  ? "Tidak ada miskonsepsi yang cocok"
                  : "No matching misconceptions"}
              </div>
            ) : (
              <nav aria-label={language === "id" ? "Daftar miskonsepsi" : "Misconception list"}>
                <ul className="overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_2px_rgb(35_32_30/0.04)]">
                  {filteredMisconceptions.map((item) => {
                    const selected = item.id === misconception.id;
                    return (
                      <li key={item.id} className="border-b border-border last:border-b-0">
                        <Link
                          to={`/miskonsepsi/${item.id}`}
                          aria-current={selected ? "page" : undefined}
                          className={cn(
                            "group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-l-2 px-4 py-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand",
                            selected
                              ? "border-l-brand bg-brand-soft/70"
                              : "border-l-transparent hover:bg-neutral",
                          )}
                        >
                          <span className="min-w-0">
                            <span
                              className={cn(
                                "block font-mono text-[11px] font-bold",
                                selected ? "text-brand" : "text-muted",
                              )}
                            >
                              {item.id}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-[13px] font-semibold leading-5 text-navy-deep">
                              {t(item.title, language)}
                            </span>
                          </span>
                          <ChevronRight
                            size={15}
                            strokeWidth={2}
                            className={cn(
                              "transition-transform group-hover:translate-x-0.5",
                              selected ? "text-brand" : "text-muted/60 group-hover:text-brand",
                            )}
                            aria-hidden="true"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </nav>
            )}
          </div>
        </aside>

        <main className="min-w-0 overflow-hidden rounded-lg border border-border bg-white shadow-[0_1px_3px_rgb(35_32_30/0.05)]">
          <div className="border-b border-border px-5 py-5 sm:px-7 sm:py-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-xs font-extrabold tracking-[0.06em] text-brand">
                {misconception.id}
              </span>
              {relatedConcepts.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {relatedConcepts.map((concept) => (
                    <Link
                      key={concept.id}
                      to={`/konsep/${concept.id}`}
                      className="rounded-md border border-border bg-neutral px-2.5 py-1 text-xs font-semibold text-navy-deep transition-colors hover:border-brand/35 hover:bg-brand-soft/60 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      {t(concept.name, language)}
                    </Link>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted">{unavailable}</span>
              )}
            </div>
            <h2 className="mt-3 max-w-4xl text-2xl font-extrabold leading-tight tracking-[-0.025em] text-navy-deep sm:text-[2rem]">
              {t(misconception.title, language)}
            </h2>
          </div>

          <div className="divide-y divide-border">
            <section className="px-5 py-6 sm:px-7">
              <SectionTitle icon={BookOpen}>
                {language === "id" ? "Deskripsi" : "Description"}
              </SectionTitle>
              <p className={cn("mt-3 max-w-[72ch] text-sm leading-7", description ? "text-navy-deep" : "text-muted")}>
                {description || unavailable}
              </p>
            </section>

            <section className="px-5 py-6 sm:px-7">
              <SectionTitle icon={CircleAlert}>
                {language === "id" ? "Penyebab Umum" : "Common Causes"}
              </SectionTitle>
              {causes.length > 0 ? (
                <ul className="mt-3 grid gap-2.5">
                  {causes.map((item, index) => (
                    <li key={`${item}-${index}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 text-sm leading-6 text-navy-deep">
                      <span className="mt-[0.65rem] size-1.5 rounded-full bg-brand" aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-muted">{unavailable}</p>
              )}
            </section>

            <section className="px-5 py-6 sm:px-7">
              <SectionTitle icon={Code2}>
                {language === "id" ? "Perbandingan Kode" : "Code Comparison"}
              </SectionTitle>
              <div className="mt-4">
                <MisconceptionCompare
                  wrong={misconception.wrong}
                  correct={misconception.correct}
                  wrongAvailable={hasWrongExample}
                  correctAvailable={hasCorrectExample}
                />
              </div>
            </section>

            <section className="px-5 py-6 sm:px-7">
              <div className="rounded-lg bg-[#f7f1ef] px-4 py-5 sm:px-5">
                <SectionTitle icon={Lightbulb}>
                  {language === "id" ? "Cara Memperbaiki" : "How to Fix It"}
                </SectionTitle>
                <p className={cn("mt-3 text-sm leading-7", fix ? "text-navy-deep" : "text-muted")}>
                  {fix || unavailable}
                </p>
              </div>
            </section>

            <section className="px-5 py-6 sm:px-7">
              <SectionTitle icon={ListChecks}>
                {language === "id" ? "Soal Terkait" : "Related Questions"}
              </SectionTitle>
              {relatedQuestions.length === 0 ? (
                <p className="mt-3 text-sm text-muted">{unavailable}</p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-lg border border-border">
                  <div className="divide-y divide-border">
                    {shownQuestions.map((question) => (
                      <RelatedQuestionLink key={question.id} question={question} />
                    ))}
                  </div>
                  {remainingQuestions.length > 0 && (
                    <details key={misconception.id} className="border-t border-border">
                      <summary className="cursor-pointer px-4 py-3 text-xs font-bold text-brand transition-colors hover:bg-brand-soft/45 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand">
                        {language === "id"
                          ? `Lihat ${remainingQuestions.length} soal lainnya`
                          : `View ${remainingQuestions.length} more questions`}
                      </summary>
                      <div className="divide-y divide-border border-t border-border">
                        {remainingQuestions.map((question) => (
                          <RelatedQuestionLink key={question.id} question={question} />
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-md text-xs leading-5 text-muted">
                  {firstExplorationQuestion
                    ? language === "id"
                      ? `${explorationQuestions.length} soal dapat ditelusuri untuk miskonsepsi ini`
                      : `${explorationQuestions.length} questions can be explored for this misconception`
                    : language === "id"
                      ? "Belum ada soal dengan variasi jawaban yang dapat ditelusuri"
                      : "No questions with traceable answer variations yet"}
                </p>
                <button
                  type="button"
                  disabled={!firstExplorationQuestion}
                  onClick={() =>
                    firstExplorationQuestion &&
                    onNavigate(
                      `/question/${firstExplorationQuestion.id}?misconception=${encodeURIComponent(misconception.id)}`,
                    )
                  }
                  className="inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:bg-neutral disabled:text-muted"
                >
                  {language === "id" ? "Telusuri lewat soal" : "Explore through questions"}
                  <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
