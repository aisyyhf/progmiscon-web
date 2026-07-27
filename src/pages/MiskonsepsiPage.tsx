import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import { useMisconception, useMisconceptions, useMisconceptionsByIds } from "../hooks/useMisconceptions";
import { useQuestions, useQuestionsByIds } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { Breadcrumb } from "../components/layout/Breadcrumb";
import { Button } from "../components/common/Button";
import { ConceptChip } from "../components/concept/ConceptChip";
import { EmptyState } from "../components/common/EmptyState";
import { answerCaseLabel } from "../components/review/AnswerCaseNavigator";
import { MisconceptionCompare } from "../components/misconception/MisconceptionCompare";
import { MisconceptionChip } from "../components/misconception/MisconceptionChip";
import { useLanguage } from "../hooks/useLanguage";
import { t, uiText } from "../utils/translation";
import { cn } from "../utils/cn";
import { getAnswerVariations } from "../utils/misconceptionExploration";
import { matchesMisconceptionSearch, misconceptionLabel } from "../utils/misconceptionLabel";
import { ChevronDown, Search } from "lucide-react";

export function MiskonsepsiPage() {
  const { misconceptionId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { misconceptions } = useMisconceptions();
  const firstMisconceptionId = useMemo(
    () =>
      [...misconceptions].sort((a, b) =>
        t(a.title, language).localeCompare(t(b.title, language), undefined, { sensitivity: "base" }),
      )[0]?.id,
    [language, misconceptions],
  );
  const selectedMisconceptionId = misconceptionId ?? firstMisconceptionId;

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
  const { misconception } = useMisconception(misconceptionId);
  const { categories } = useCategories();
  const { misconceptions: relatedMisconceptions } = useMisconceptionsByIds(
    misconception?.relatedMisconceptionIds ?? [],
  );
  const { questions } = useQuestionsByIds(misconception?.relatedQuestionIds ?? []);
  const { questions: allQuestions } = useQuestions();
  const { answers } = useAllStudentAnswers();
  const answerVariations = useMemo(() => getAnswerVariations(answers), [answers]);

  const sortedMisconceptions = useMemo(
    () =>
      [...misconceptions].sort((a, b) =>
        t(a.title, language).localeCompare(t(b.title, language), undefined, { sensitivity: "base" }),
      ),
    [language, misconceptions],
  );

  const filteredMisconceptions = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase();
    if (!keyword) return sortedMisconceptions;
    return sortedMisconceptions.filter((item) =>
      matchesMisconceptionSearch(item, keyword) ||
      [item.wrong, item.correct, item.fix].some((text) =>
        [text.id, text.en].some((value) => value.toLocaleLowerCase().includes(keyword)),
      ),
    );
  }, [query, sortedMisconceptions]);

  if (!misconceptionId || !misconception) {
    return <EmptyState message={language === "id" ? "Miskonsepsi tidak ditemukan." : "Misconception not found."} />;
  }

  const category = categories.find((item) => item.id === misconception.categoryId);

  const reviewBackUrl = fromQuestionId
    ? `/question/${fromQuestionId}${fromCaseId ? `?case=${fromCaseId}` : ""}`
    : undefined;
  const relatedAnswerCases = answerVariations.filter((answer) =>
    answer.studentMisconceptionIds.includes(misconception.id),
  );

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb
        items={[
          { label: t(uiText.breadcrumbHome, language), to: "/" },
          { label: t(uiText.breadcrumbMiskonsepsi, language), to: "/miskonsepsi" },
          { label: misconceptionLabel(misconception, language) },
        ]}
      />

      {reviewBackUrl && (
        <div className="mb-6">
          <Button variant="secondary" onClick={() => onNavigate(reviewBackUrl)}>
            ← {t(uiText.backToQuestionReview, language)}
          </Button>
        </div>
      )}

      <div className="mb-7">
        <h1 className="page-title">{t(uiText.miskonsepsiTitle, language)}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {t(uiText.miskonsepsiDescription, language)}
        </p>
      </div>

      <section className="scroll-reveal grid grid-cols-1 gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-lg border border-border bg-white p-4 lg:sticky lg:top-24">
          <button
            type="button"
            onClick={() => setListOpen((current) => !current)}
            aria-expanded={listOpen}
            aria-controls="misconception-list-panel"
            className="flex w-full cursor-pointer items-center justify-between gap-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:pointer-events-none"
          >
            <span className="text-lg font-bold text-navy-deep">
              {language === "id" ? "Daftar Miskonsepsi" : "Misconception List"}
            </span>
            <ChevronDown
              size={15}
              strokeWidth={2}
              aria-hidden="true"
              className={cn("text-muted transition-transform lg:hidden", listOpen && "rotate-180")}
            />
          </button>
          <div id="misconception-list-panel" className={cn(listOpen ? "block" : "hidden", "lg:block")}>
          <div className="relative mt-3">
            <Search size={16} strokeWidth={2} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true" />
            <input
              id="misconception-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={language === "id" ? "Cari miskonsepsi..." : "Search misconceptions..."}
              className="academic-input py-2.5 pl-9 pr-3 text-sm placeholder:text-muted/65"
            />
          </div>
          <div className="thin-scroll mt-3 max-h-72 overflow-y-auto pr-1 lg:max-h-[64vh]">
            {filteredMisconceptions.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">
                {language === "id" ? "Tidak ada miskonsepsi yang cocok." : "No matching misconceptions."}
              </p>
            ) : (
              filteredMisconceptions.map((item) => {
                const selected = item.id === misconception.id;
                return (
                  <Link
                    key={item.id}
                    to={`/miskonsepsi/${item.id}`}
                    className={cn(
                      "block rounded-md px-3 py-2.5 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      selected
                        ? "bg-brand text-white"
                        : "text-muted hover:bg-neutral hover:text-navy-deep",
                    )}
                  >
                    <span className="line-clamp-2 font-medium leading-5">{misconceptionLabel(item, language)}</span>
                  </Link>
                );
              })
            )}
          </div>
          </div>
        </aside>

        <main className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-white p-6 md:p-8">
          {category && (
            <p className="text-xs font-semibold text-brand">
              {t(category.name, language)}
            </p>
          )}
          <h2 className="mt-2 max-w-4xl text-2xl font-bold leading-tight text-navy-deep md:text-3xl">
            {misconceptionLabel(misconception, language)}
          </h2>

          <section className="mt-6">
            <p className="mb-2 text-sm font-bold text-navy-deep">
              {t(uiText.relatedConcepts, language)}
            </p>
            {category && (
              <ConceptChip label={t(category.name, language)} onClick={() => onNavigate(`/konsep/${category.id}`)} />
            )}
          </section>

          <div className="mt-6 space-y-5 divide-y divide-border">
            <MisconceptionCompare wrong={misconception.wrong} correct={misconception.correct} />
            <section className="pt-5">
              <p className="text-sm font-bold text-navy-deep">
                {language === "id" ? "Koreksi Singkat" : "Short Fix"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-navy-deep">
                {t(misconception.fix, language)}
              </p>
            </section>

            <section className="pt-5">
              <p className="mb-2 text-sm font-bold text-navy-deep">
                {t(uiText.relatedQuestions, language)}
              </p>
              {questions.length === 0 ? (
                <p className="text-sm text-muted">{t(uiText.noQuestions, language)}</p>
              ) : (
                <ul className="academic-panel-quiet divide-y divide-border overflow-hidden">
                  {questions.map((question) => {
                    return (
                      <li key={question.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/question/${question.id}`)}
                          className="group w-full cursor-pointer px-4 py-4 text-left transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                        >
                          <p className="line-clamp-2 text-[13px] font-normal leading-6 text-navy-deep transition-colors group-hover:text-brand">
                            {t(question.prompt, language)}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section className="pt-5">
              <p className="mb-2 text-sm font-bold text-navy-deep">
                {language === "id" ? "Variasi Jawaban Terkait" : "Related Answer Variations"}
              </p>
              {relatedAnswerCases.length === 0 ? (
                <p className="text-sm text-muted">
                  {language === "id" ? "Belum ada variasi jawaban terkait." : "No related answer variations yet."}
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {relatedAnswerCases.slice(0, 6).map((answer) => {
                    const question = allQuestions.find((item) => item.id === answer.questionId);
                    const questionAnswers = answerVariations.filter((item) => item.questionId === answer.questionId);
                    const caseIndex = questionAnswers.findIndex((item) => item.id === answer.id);
                    return (
                      <li key={answer.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/question/${answer.questionId}?case=${answer.id}`)}
                          className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <p className="text-xs font-semibold text-brand">
                            {answerCaseLabel(caseIndex, questionAnswers.length, language)}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-navy-deep">
                            {question ? t(question.prompt, language) : answer.questionId}
                          </p>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {relatedMisconceptions.length > 0 && (
              <section className="pt-5">
                <p className="mb-2 text-sm font-bold text-navy-deep">
                  {t(uiText.relatedMisconceptions, language)}
                </p>
                <div className="flex flex-wrap gap-2">
                  {relatedMisconceptions.map((related) => (
                    <MisconceptionChip
                      key={related.id}
                      label={misconceptionLabel(related, language)}
                      tone="related"
                      onClick={() => onNavigate(`/miskonsepsi/${related.id}`)}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </main>
      </section>
    </div>
  );
}
