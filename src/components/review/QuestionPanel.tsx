import type { Assessment, Category, Concept, Question } from "../../types";
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
  assessment,
  category,
  concepts,
  onSelectConcept,
  onSelectMisconception,
}: {
  question: Question;
  assessment: Assessment | undefined;
  category: Category | undefined;
  concepts: Concept[];
  onSelectConcept: (conceptId: string) => void;
  onSelectMisconception: (misconceptionId: string) => void;
}) {
  const { language } = useLanguage();
  const { misconceptions } = useMisconceptionsByIds(question.questionMisconceptionIds);
  const reference = getQuestionReference(question);

  const typeLabel =
    question.type === "short_answer"
      ? t(uiText.filterShortAnswer, language)
      : t(uiText.filterMultipleChoice, language);

  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <p className="text-xs font-medium uppercase tracking-wide text-muted">
        {[assessment ? t(assessment.title, language) : "", question.number, category ? t(category.name, language) : "", typeLabel]
          .filter(Boolean)
          .join(" · ")}
      </p>

      <p className="mt-3 whitespace-pre-wrap font-serif-brand text-lg leading-relaxed text-navy-deep">
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
                  option.isCorrect ? "border-correct/40 bg-correct-bg/40" : "border-border bg-white",
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

      {(reference.pseudocode || reference.checkedElements.length > 0) && (
        <div className="mt-6 border-t border-border pt-5">
          {reference.pseudocode && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t(uiText.referencePseudocode, language)}
              </p>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-bg px-3 py-2 font-mono text-xs leading-5 text-navy-deep">
                {reference.pseudocode}
              </pre>
            </div>
          )}

          {reference.checkedElements.length > 0 && (
            <div className={reference.pseudocode ? "mt-4" : ""}>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t(uiText.checkedElements, language)}
              </p>
              <ul className="space-y-1.5">
                {reference.checkedElements.map((element, index) => (
                  <li key={`${t(element, language)}-${index}`} className="flex items-start gap-2 text-sm text-navy-deep">
                    <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />
                    <span>{t(element, language)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
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
          {t(uiText.questionMisconceptions, language)}
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
