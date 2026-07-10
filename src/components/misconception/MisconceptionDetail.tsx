import { useLanguage } from "../../hooks/useLanguage";
import { useMisconception, useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { useQuestionsByIds } from "../../hooks/useQuestions";
import { useCategories } from "../../hooks/useCategories";
import { useVerificationCheckForMisconception } from "../../hooks/useVerificationChecks";
import { t, uiText } from "../../utils/translation";
import { Button } from "../common/Button";
import { Chip } from "../common/Chip";
import { ConceptChip } from "../concept/ConceptChip";
import { MisconceptionChip } from "./MisconceptionChip";
import { MisconceptionCheck } from "./MisconceptionCheck";

type VerificationContext = {
  questionId: string;
  studentId: string;
};

export function MisconceptionDetail({
  misconceptionId,
  onSelectRelatedMisconception,
  onSelectRelatedQuestion,
  onViewInConcept,
  onOpenMisconceptionPage,
  verificationContext,
}: {
  misconceptionId: string;
  onSelectRelatedMisconception: (id: string) => void;
  onSelectRelatedQuestion: (questionId: string) => void;
  onViewInConcept?: (conceptId: string) => void;
  onOpenMisconceptionPage?: (misconceptionId: string) => void;
  verificationContext?: VerificationContext;
}) {
  const { language } = useLanguage();
  const { misconception } = useMisconception(misconceptionId);
  const { categories } = useCategories();
  const { misconceptions: relatedMisconceptions } = useMisconceptionsByIds(
    misconception?.relatedMisconceptionIds ?? [],
  );
  const { questions: relatedQuestions } = useQuestionsByIds(misconception?.relatedQuestionIds ?? []);
  const { check } = useVerificationCheckForMisconception(
    verificationContext?.questionId,
    verificationContext?.studentId,
    misconceptionId,
  );

  if (!misconception) return null;

  const category = categories.find((c) => c.id === misconception.categoryId);
  const relatedConcepts = categories.filter((concept) =>
    relatedMisconceptions.some(
      (related) => related.categoryId === concept.id && related.categoryId !== misconception.categoryId,
    ),
  );

  const sections: Array<{ label: { id: string; en: string }; text: string }> = [
    { label: uiText.drawerWrong, text: t(misconception.wrong, language) },
    { label: uiText.drawerCorrect, text: t(misconception.correct, language) },
    { label: uiText.drawerFix, text: t(misconception.fix, language) },
    { label: uiText.drawerCause, text: t(misconception.cause, language) },
  ];

  return (
    <div className="space-y-6">
      <div>
        {category && (
          <p className="text-[11px] font-medium uppercase tracking-wide text-gold">{t(category.name, language)}</p>
        )}
        <h2 className="mt-1 font-serif-brand text-xl font-semibold text-navy-deep">
          {t(misconception.title, language)}
        </h2>
      </div>

      <div className="space-y-4 divide-y divide-border">
        {sections.map((section) => (
          <div key={section.label.id} className="pt-4 first:pt-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {t(section.label, language)}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-navy-deep">{section.text}</p>
          </div>
        ))}

        {misconception.pattern.length > 0 && (
          <div className="pt-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {t(uiText.drawerPattern, language)}
            </p>
            <ul className="mt-1 list-inside list-disc space-y-1 text-sm text-navy-deep">
              {misconception.pattern.map((item, index) => (
                <li key={index}>{t(item, language)}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="pt-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.drawerValue, language)}
          </p>
          <p className="mt-1 text-sm text-navy-deep">{t(misconception.value, language)}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {onOpenMisconceptionPage && (
          <Button variant="primary" onClick={() => onOpenMisconceptionPage(misconception.id)}>
            {t(uiText.openMisconceptionPage, language)} →
          </Button>
        )}
        {onViewInConcept && (
          <Button variant="secondary" onClick={() => onViewInConcept(misconception.categoryId)}>
            {t(uiText.viewInConcepts, language)} →
          </Button>
        )}
      </div>

      <div>
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
          {t(uiText.drawerConcepts, language)}
        </p>
        <div className="flex flex-wrap gap-2">
          {category &&
            (onViewInConcept ? (
              <ConceptChip
                label={t(category.name, language)}
                onClick={() => onViewInConcept(category.id)}
                selected
              />
            ) : (
              <Chip className="border-navy/20 bg-bg">{t(category.name, language)}</Chip>
            ))}
        </div>
      </div>

      {relatedConcepts.length > 0 && onViewInConcept && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.relatedConcepts, language)}
          </p>
          <div className="flex flex-wrap gap-2">
            {relatedConcepts.map((concept) => (
              <ConceptChip
                key={concept.id}
                label={t(concept.name, language)}
                onClick={() => onViewInConcept?.(concept.id)}
              />
            ))}
          </div>
        </div>
      )}

      {relatedMisconceptions.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.relatedMisconceptions, language)}
          </p>
          <div className="flex flex-wrap gap-2">
            {relatedMisconceptions.map((related) => (
              <MisconceptionChip
                key={related.id}
                label={t(related.title, language)}
                tone="related"
                onClick={() => onSelectRelatedMisconception(related.id)}
              />
            ))}
          </div>
        </div>
      )}

      {relatedQuestions.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.relatedQuestions, language)}
          </p>
          <ul className="divide-y divide-border">
            {relatedQuestions.map((question) => (
              <li key={question.id}>
                <div className="flex flex-col gap-2 py-2">
                  <button
                    type="button"
                    onClick={() => onSelectRelatedQuestion(question.id)}
                    className="w-full cursor-pointer text-left text-sm hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                  >
                    <span className="font-medium text-navy-deep">{question.number}</span>
                    <span className="ml-2 text-muted">
                      {question.type === "short_answer"
                        ? t(uiText.filterShortAnswer, language)
                        : t(uiText.filterMultipleChoice, language)}
                    </span>
                  </button>
                  {onViewInConcept && (
                    <div>
                      <ConceptChip
                        label={
                          categories.find((c) => c.id === question.categoryId)?.name[language] ??
                          t(uiText.konsepTitle, language)
                        }
                        onClick={() => onViewInConcept(question.categoryId)}
                      />
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {verificationContext && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
            {t(uiText.drawerVerification, language)}
          </p>
          <MisconceptionCheck check={check} />
        </div>
      )}
    </div>
  );
}
