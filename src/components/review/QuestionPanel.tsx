import type { Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { getQuestionOptionMisconceptionIds } from "../../utils/questionMetadata";
import { getMaterialQuestionIdentifier } from "../../utils/materialQuestionFilters";
import { QuestionContent } from "./QuestionContent";
import { ArrowRight, CheckCircle2, TriangleAlert } from "lucide-react";

export function QuestionPanel({
  question,
  activeMisconceptionId,
  onSelectMisconception,
}: {
  question: Question;
  activeMisconceptionId?: string;
  onSelectMisconception: (misconceptionId: string) => void;
}) {
  const { language } = useLanguage();
  const misconceptionIds = [
    ...new Set([
      ...question.questionMisconceptionIds,
      ...(question.options?.flatMap(getQuestionOptionMisconceptionIds) ?? []),
    ]),
  ];
  const { misconceptions } = useMisconceptionsByIds(misconceptionIds);
  const questionTitle =
    t(question.title, language).trim() ||
    `${language === "id" ? "Soal" : "Question"} ${question.number || question.id}`;
  const questionCode = `#${getMaterialQuestionIdentifier(question).replace(/^#/, "")}`;
  const weekMatch = /^W(\d+)(?:-(\d+))?$/i.exec(question.week ?? "");
  const normalizedWeekNumber = weekMatch
    ? weekMatch[2]
      ? `${Number(weekMatch[1])}–${Number(weekMatch[2])}`
      : String(Number(weekMatch[1]))
    : question.week || (language === "id" ? "Belum tersedia" : "Unavailable");
  const QuestionHeading = activeMisconceptionId ? "h2" : "h1";

  return (
    <article className="min-w-0 bg-bg px-5 py-6 sm:px-7 lg:px-8 lg:py-8">
      <header className="border-b border-border pb-5">
        <QuestionHeading
          aria-label={`${questionTitle}, ${questionCode}`}
          className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-2xl font-extrabold leading-[1.1] tracking-[-0.02em] text-navy-deep md:text-3xl"
        >
          <span>{questionTitle}</span>
          <span className="font-mono text-xs font-normal leading-5 tracking-normal tabular-nums text-muted">
            {questionCode}
          </span>
        </QuestionHeading>
        <dl className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-1 text-sm font-bold leading-5 text-muted">
          <div className="flex min-w-0 items-baseline gap-1">
            <dt className="sr-only">Week</dt>
            <dd>
              <span aria-hidden="true">Week </span>
              {normalizedWeekNumber}
            </dd>
          </div>
          <div className="flex min-w-0 items-baseline gap-1">
            <span className="mx-1 text-muted/65" aria-hidden="true">
              ·
            </span>
            <dt className="shrink-0 font-bold text-navy-deep">KC:</dt>
            <dd className="min-w-0">
              {question.expectedConcepts.length > 0
                ? question.expectedConcepts.map((concept) => t(concept, language)).join(", ")
                : language === "id"
                  ? "Belum tersedia"
                  : "Unavailable"}
            </dd>
          </div>
        </dl>
      </header>

      <section className="py-6" aria-label={language === "id" ? "Isi soal" : "Question content"}>
        <QuestionContent question={question} />

        {question.type === "multiple_choice" && question.options && (
          <ul className="mt-5 space-y-2">
            {question.options.map((option) => {
              const optionMisconceptions = getQuestionOptionMisconceptionIds(option)
                .map((id) => misconceptions.find((item) => item.id === id))
                .filter((item) => item !== undefined);
              return (
                <li
                  key={option.id}
                  className={cn(
                    "rounded-md border px-4 py-2.5 text-sm",
                    option.isCorrect ? "border-correct-border bg-correct-bg/55" : "border-border bg-white",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-navy-deep">{option.label}.</span>
                    <span className="text-navy-deep">{t(option.text, language)}</span>
                    {option.isCorrect && (
                      <span className="ml-auto shrink-0 text-xs font-medium text-correct">
                        {t(uiText.correctOptionLabel, language)}
                      </span>
                    )}
                  </div>
                  {optionMisconceptions.length > 0 && (
                    <ul className="mt-1 space-y-1 pl-5 text-xs text-muted">
                      {optionMisconceptions.map((misconception) => (
                        <li key={misconception.id}>
                          → {t(uiText.mapsToMisconception, language)}:{" "}
                          <button
                            type="button"
                            onClick={() => onSelectMisconception(misconception.id)}
                            className="cursor-pointer text-left font-medium text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            {misconception.id} — {t(misconception.title, language)}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}

      </section>

      <section className="border-t border-border pt-5" aria-labelledby="related-misconceptions-title">
        <h2 id="related-misconceptions-title" className="flex items-center gap-2 text-base font-bold text-navy-deep">
          <TriangleAlert size={17} strokeWidth={2} className="shrink-0 text-brand" aria-hidden="true" />
          <span>{language === "id" ? "Miskonsepsi Terkait" : "Related Misconceptions"}</span>
        </h2>
        {misconceptions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t(uiText.emptyMisconceptions, language)}</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {misconceptions.map((misconception) => {
              const active = misconception.id === activeMisconceptionId;
              return (
                <button
                  key={misconception.id}
                  type="button"
                  onClick={() => onSelectMisconception(misconception.id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "group relative min-h-24 cursor-pointer overflow-hidden rounded-lg border px-4 py-3.5 text-left transition-colors",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                    active
                      ? "border-brand bg-brand text-white"
                      : "border-brand/15 bg-brand-soft/55 text-navy-deep hover:border-brand/35 hover:bg-brand-soft/80",
                  )}
                >
                  <span
                    className={cn(
                      "absolute -right-7 -top-9 size-20 rounded-full",
                      active ? "bg-white/10" : "bg-brand/5",
                    )}
                    aria-hidden="true"
                  />
                  <span className="relative block min-w-0 pr-7">
                    <span className="flex items-center gap-1.5">
                      {active && <CheckCircle2 size={14} className="shrink-0" aria-hidden="true" />}
                      <span
                        className={cn(
                          "font-mono text-[11px] font-extrabold",
                          active ? "text-white" : "text-brand",
                        )}
                      >
                        {misconception.id}
                      </span>
                    </span>
                    <span className="mt-1.5 block text-[13px] font-bold leading-5">
                      {t(misconception.title, language)}
                    </span>
                  </span>
                  <ArrowRight
                    size={15}
                    className={cn(
                      "absolute right-3.5 top-3.5 transition-transform group-hover:translate-x-0.5",
                      active ? "text-white/90" : "text-brand/70",
                    )}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
        )}
      </section>
    </article>
  );
}
