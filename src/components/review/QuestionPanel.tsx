import type { Concept, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { findConceptByText } from "../../utils/concepts";
import { cn } from "../../utils/cn";
import { getQuestionReference } from "../../utils/questionReference";
import { ConceptChip } from "../concept/ConceptChip";
import { MisconceptionChip } from "../misconception/MisconceptionChip";

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
    <div className="rounded-lg border border-border bg-white p-6">
      {relatedQuestionIndex !== undefined && relatedQuestionTotal !== undefined && relatedQuestionIndex >= 0 && (
        <div className="mb-5 flex items-center justify-between gap-4 border-b border-border pb-4">
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
              <span aria-hidden="true">&larr;</span>
            </button>
            <button
              type="button"
              onClick={onNextQuestion}
              disabled={relatedQuestionIndex === relatedQuestionTotal - 1}
              aria-label={language === "id" ? "Soal berikutnya" : "Next question"}
              title={language === "id" ? "Soal berikutnya" : "Next question"}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-white text-sm text-muted transition-colors hover:border-brand/30 hover:bg-brand-soft/40 hover:text-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <span aria-hidden="true">&rarr;</span>
            </button>
          </div>
        </div>
      )}

      <p className="whitespace-pre-wrap font-serif-brand text-lg leading-relaxed text-navy-deep">
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
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.referencePseudocode, language)}
          </p>
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs leading-5 text-navy-deep">
            {reference.pseudocode}
          </pre>
        </div>
      )}

      {question.expectedConcepts.length > 0 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.expectedConcepts, language)}
          </p>
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
        </div>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
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
      </div>
    </div>
  );
}
