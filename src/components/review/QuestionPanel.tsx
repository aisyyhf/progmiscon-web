import type { Concept, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { misconceptionLabel } from "../../utils/misconceptionLabel";
import { findConceptByText } from "../../utils/concepts";
import { cn } from "../../utils/cn";
import { getQuestionReference } from "../../utils/questionReference";
import { getQuestionOptionMisconceptionIds } from "../../utils/questionMetadata";
import { ConceptChip } from "../concept/ConceptChip";
import { ConceptIcon } from "../concept/ConceptIcon";
import { MisconceptionChip } from "../misconception/MisconceptionChip";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function QuestionPanel({
  question,
  concepts,
  onSelectConcept,
  onSelectMisconception,
  relatedQuestionIndex,
  relatedQuestionTotal,
  onPreviousQuestion,
  onNextQuestion,
}: {
  question: Question;
  concepts: Concept[];
  onSelectConcept: (conceptId: string) => void;
  onSelectMisconception: (misconceptionId: string) => void;
  relatedQuestionIndex?: number;
  relatedQuestionTotal?: number;
  onPreviousQuestion: () => void;
  onNextQuestion: () => void;
}) {
  const { language } = useLanguage();
  const misconceptionIds = [
    ...new Set([
      ...question.questionMisconceptionIds,
      ...(question.options?.flatMap(getQuestionOptionMisconceptionIds) ?? []),
    ]),
  ];
  const { misconceptions } = useMisconceptionsByIds(misconceptionIds);
  const reference = getQuestionReference(question);

  return (
    <div className="grid min-w-0 gap-4">
      <section className="relative overflow-hidden rounded-lg border border-border bg-white p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-bold text-navy-deep">
          {language === "id" ? "Soal" : "Question"}
          </h2>
        {relatedQuestionIndex !== undefined && relatedQuestionTotal !== undefined && relatedQuestionIndex >= 0 && (
        <div className="flex items-center gap-3">
          <p className="text-xs font-medium text-muted">
            {language === "id"
              ? `Soal terkait ${relatedQuestionIndex + 1} dari ${relatedQuestionTotal}`
              : `Related question ${relatedQuestionIndex + 1} of ${relatedQuestionTotal}`}
          </p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={onPreviousQuestion}
              disabled={relatedQuestionIndex === 0}
              aria-label={language === "id" ? "Soal sebelumnya" : "Previous question"}
              title={language === "id" ? "Soal sebelumnya" : "Previous question"}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-white text-sm text-muted transition-colors hover:border-brand/30 hover:bg-brand-soft/40 hover:text-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={onNextQuestion}
              disabled={relatedQuestionIndex === relatedQuestionTotal - 1}
              aria-label={language === "id" ? "Soal berikutnya" : "Next question"}
              title={language === "id" ? "Soal berikutnya" : "Next question"}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-white text-sm text-muted transition-colors hover:border-brand/30 hover:bg-brand-soft/40 hover:text-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
        )}
      </div>

      <p className="mt-4 max-w-4xl whitespace-pre-wrap text-[13px] font-normal leading-6 text-navy-deep">
        {t(question.prompt, language)}
      </p>

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
                          {misconceptionLabel(misconception, language)}
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

      {reference.pseudocode && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="academic-label mb-2">
            {t(uiText.referencePseudocode, language)}
          </p>
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-neutral px-4 py-3 font-mono text-[13px] leading-6 text-navy-deep">
            {reference.pseudocode}
          </pre>
        </div>
      )}
      </section>

      {question.expectedConcepts.length > 0 && (
        <section className="rounded-lg border border-border bg-white p-5 md:p-6">
          <h2 className="text-base font-bold text-navy-deep">
            {language === "id" ? "Konsep" : "Concepts"}
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {question.expectedConcepts.map((concept) => {
              const resolvedConcept = findConceptByText(concepts, concept);
              return (
                <ConceptChip
                  key={resolvedConcept?.id ?? t(concept, language)}
                  label={t(concept, language)}
                  icon={<ConceptIcon name={resolvedConcept?.name ?? concept} size={15} />}
                  showArrow={false}
                  onClick={() => onSelectConcept(resolvedConcept?.id ?? question.categoryId)}
                />
              );
            })}
          </div>
        </section>
      )}

      <section className="rounded-lg border border-border bg-white p-5 md:p-6">
        <h2 className="text-base font-bold text-navy-deep">
          {language === "id" ? "Miskonsepsi yang Mungkin Muncul" : "Possible Misconceptions"}
        </h2>
        {misconceptions.length === 0 ? (
          <p className="mt-3 text-sm text-muted">{t(uiText.emptyMisconceptions, language)}</p>
        ) : (
          <div className="mt-3 grid gap-2">
            {misconceptions.map((misconception) => (
              <MisconceptionChip
                key={misconception.id}
                label={misconceptionLabel(misconception, language)}
                tone="question"
                className="w-full justify-between px-3.5 py-3 text-left"
                onClick={() => onSelectMisconception(misconception.id)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
