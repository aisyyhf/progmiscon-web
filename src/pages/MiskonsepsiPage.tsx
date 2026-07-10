import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAssessments } from "../hooks/useAssessments";
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
  const { misconception } = useMisconception(misconceptionId);
  const { categories } = useCategories();
  const { assessments } = useAssessments();
  const { misconceptions: relatedMisconceptions } = useMisconceptionsByIds(
    misconception?.relatedMisconceptionIds ?? [],
  );
  const { questions } = useQuestionsByIds(misconception?.relatedQuestionIds ?? []);
  const { questions: allQuestions } = useQuestions();
  const { answers } = useAllStudentAnswers();

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
      [item.title, item.wrong, item.correct, item.fix].some((text) =>
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
  const relatedAnswerCases = answers.filter((answer) => answer.studentMisconceptionIds.includes(misconception.id));

  return (
    <div className="mx-auto max-w-7xl">
      <Breadcrumb
        items={[
          { label: t(uiText.breadcrumbHome, language), to: "/" },
          { label: t(uiText.breadcrumbMiskonsepsi, language), to: "/miskonsepsi" },
          { label: t(misconception.title, language) },
        ]}
      />

      {reviewBackUrl && (
        <div className="mb-6">
          <Button variant="secondary" onClick={() => onNavigate(reviewBackUrl)}>
            ← {t(uiText.backToQuestionReview, language)}
          </Button>
        </div>
      )}

      <div className="mb-8">
        <h1 className="font-serif-brand text-2xl font-semibold text-navy-deep">
          {t(uiText.miskonsepsiTitle, language)}
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          {t(uiText.miskonsepsiDescription, language)}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
        <aside className="rounded-lg border border-border bg-white p-4 lg:sticky lg:top-24">
          <label htmlFor="misconception-search" className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {language === "id" ? "Daftar Miskonsepsi" : "Misconception List"}
          </label>
          <input
            id="misconception-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={language === "id" ? "Cari miskonsepsi..." : "Search misconceptions..."}
            className="mt-3 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-navy-deep placeholder:text-muted/70 focus:border-navy focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold/30"
          />
          <div className="thin-scroll mt-4 max-h-[60vh] overflow-y-auto pr-1">
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
                      "block border-l-2 border-y border-r px-3 py-2 text-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                      selected
                        ? "border-border border-l-gold bg-bg text-navy-deep"
                        : "border-transparent text-muted hover:border-l-navy/40 hover:bg-bg/70 hover:text-navy-deep",
                    )}
                  >
                    <span className="line-clamp-2 font-medium">{t(item.title, language)}</span>
                  </Link>
                );
              })
            )}
          </div>
        </aside>

        <main className="rounded-lg border border-border bg-white p-6">
          {category && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-gold">
              {t(category.name, language)}
            </p>
          )}
          <h2 className="mt-1 font-serif-brand text-3xl font-semibold text-navy-deep">
            {t(misconception.title, language)}
          </h2>

          <section className="mt-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              {t(uiText.relatedConcepts, language)}
            </p>
            {category && (
              <ConceptChip label={t(category.name, language)} onClick={() => onNavigate(`/konsep/${category.id}`)} />
            )}
          </section>

          <div className="mt-6 space-y-5 divide-y divide-border">
            <MisconceptionCompare wrong={misconception.wrong} correct={misconception.correct} />
            <section className="pt-5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                {language === "id" ? "Koreksi Singkat" : "Short Fix"}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-navy-deep">
                {t(misconception.fix, language)}
              </p>
            </section>

            <section className="pt-5">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t(uiText.relatedMisconceptions, language)}
              </p>
              {relatedMisconceptions.length === 0 ? (
                <p className="text-sm text-muted">
                  {language === "id" ? "Belum ada miskonsepsi terkait." : "No related misconceptions yet."}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {relatedMisconceptions.map((related) => (
                    <MisconceptionChip
                      key={related.id}
                      label={t(related.title, language)}
                      tone="related"
                      onClick={() => onNavigate(`/miskonsepsi/${related.id}`)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="pt-5">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t(uiText.relatedQuestions, language)}
              </p>
              {questions.length === 0 ? (
                <p className="text-sm text-muted">{t(uiText.noQuestions, language)}</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {questions.map((question) => {
                    const assessment = assessments.find((item) => item.id === question.assessmentId);
                    return (
                      <li key={question.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/question/${question.id}`)}
                          className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">
                            {[assessment ? t(assessment.title, language) : "", question.number]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-6 text-navy-deep">
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
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                {language === "id" ? "Variasi Jawaban Terkait" : "Related Answer Cases"}
              </p>
              {relatedAnswerCases.length === 0 ? (
                <p className="text-sm text-muted">
                  {language === "id" ? "Belum ada variasi jawaban terkait." : "No related answer cases yet."}
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {relatedAnswerCases.slice(0, 6).map((answer) => {
                    const question = allQuestions.find((item) => item.id === answer.questionId);
                    const caseIndex = answers.filter((item) => item.questionId === answer.questionId).findIndex((item) => item.id === answer.id);
                    return (
                      <li key={answer.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate(`/question/${answer.questionId}?case=${answer.id}`)}
                          className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">
                            {answerCaseLabel(caseIndex, language)}
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
          </div>
        </main>
      </div>
    </div>
  );
}
