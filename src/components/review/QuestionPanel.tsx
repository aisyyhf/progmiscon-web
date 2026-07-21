import type { Concept, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { findConceptByText } from "../../utils/concepts";
import { cn } from "../../utils/cn";
import { getQuestionReference } from "../../utils/questionReference";
import { ConceptChip } from "../concept/ConceptChip";
import { MisconceptionChip } from "../misconception/MisconceptionChip";
import { ChevronLeft, ChevronRight, FileQuestion } from "lucide-react";

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
  const { misconceptions } = useMisconceptionsByIds(question.questionMisconceptionIds);
  const reference = getQuestionReference(question);

  return (
    <section className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-white p-5 md:p-7">
      <div className="flex items-center justify-between gap-4">
        <span className="flex items-center gap-2 text-sm font-semibold text-muted">
          <FileQuestion size={17} strokeWidth={2} className="text-brand" aria-hidden="true" />
          {language === "id" ? "Soal" : "Question"}
        </span>
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

      <p className="mt-4 max-w-4xl whitespace-pre-wrap text-xl font-bold leading-8 text-navy-deep">
        {t(question.prompt, language)}
      </p>

      {question.type === "multiple_choice" && question.options && (
        <ul className="mt-5 space-y-2">
          {question.options.map((option) => {
            const optionMisconception = misconceptions.find((m) => m.id === option.misconceptionId);
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
                {optionMisconception && (
                  <p className="mt-1 pl-5 text-xs text-muted">
                    → {t(uiText.mapsToMisconception, language)}: {t(optionMisconception.title, language)}
                  </p>
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

      <div className="mt-6 grid gap-4 border-t border-border pt-5">
        {question.expectedConcepts.length > 0 && (
          <section className="rounded-lg bg-neutral p-4">
            <p className="academic-label mb-2">{t(uiText.expectedConcepts, language)}</p>
            <div className="flex flex-wrap gap-2">
              {question.expectedConcepts.map((concept) => {
                const resolvedConcept = findConceptByText(concepts, concept);
                return (
                  <ConceptChip
                    key={resolvedConcept?.id ?? t(concept, language)}
                    label={t(concept, language)}
                    onClick={() => onSelectConcept(resolvedConcept?.id ?? question.categoryId)}
                  />
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-lg bg-brand-soft/45 p-4">
          <p className="academic-label mb-2 text-brand">
            {language === "id" ? "Miskonsepsi yang Mungkin Muncul" : "Possible Misconceptions"}
          </p>
          {misconceptions.length === 0 ? (
            <p className="text-sm text-muted">{t(uiText.emptyMisconceptions, language)}</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {misconceptions.map((misconception) => (
                <MisconceptionChip
                  key={misconception.id}
                  label={t(misconception.title, language)}
                  tone="question"
                  onClick={() => onSelectMisconception(misconception.id)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
