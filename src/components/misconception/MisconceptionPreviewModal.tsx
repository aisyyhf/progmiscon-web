import { useEffect, useState } from "react";
import { useAssessments } from "../../hooks/useAssessments";
import { useCategories } from "../../hooks/useCategories";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconception } from "../../hooks/useMisconceptions";
import { useQuestionsByIds } from "../../hooks/useQuestions";
import { t, uiText } from "../../utils/translation";
import { Button } from "../common/Button";
import { MisconceptionCompare } from "./MisconceptionCompare";

export function MisconceptionPreviewModal({
  open,
  misconceptionId,
  onClose,
  onOpenMisconceptionPage,
  onSelectRelatedQuestion,
}: {
  open: boolean;
  misconceptionId?: string;
  onClose: () => void;
  onOpenMisconceptionPage: (misconceptionId: string) => void;
  onSelectRelatedQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();
  const { misconception } = useMisconception(misconceptionId);
  const { categories } = useCategories();
  const { assessments } = useAssessments();
  const { questions } = useQuestionsByIds(misconception?.relatedQuestionIds ?? []);
  const [showQuestions, setShowQuestions] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowQuestions(false);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, misconceptionId, onClose]);

  if (!open || !misconception) return null;

  const category = categories.find((item) => item.id === misconception.categoryId);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        aria-label={language === "id" ? "Tutup modal" : "Close modal"}
        className="absolute inset-0 cursor-default bg-navy-deep/35"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="misconception-preview-title"
        className="relative max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-lg border border-border bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div>
            {category && (
              <p className="text-[11px] font-medium uppercase tracking-wide text-gold">
                {t(category.name, language)}
              </p>
            )}
            <h2 id="misconception-preview-title" className="mt-1 text-xl font-bold text-navy-deep">
              {t(misconception.title, language)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === "id" ? "Tutup" : "Close"}
            className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:bg-bg hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
          >
            x
          </button>
        </div>

        <div className="mt-5 space-y-5">
          <MisconceptionCompare wrong={misconception.wrong} correct={misconception.correct} compact />

          <section>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {language === "id" ? "Koreksi Singkat" : "Short Fix"}
            </p>
            <p className="mt-1 text-sm leading-6 text-navy-deep">{t(misconception.fix, language)}</p>
          </section>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button variant="primary" onClick={() => onOpenMisconceptionPage(misconception.id)}>
              {t(uiText.openMisconceptionPage, language)} →
            </Button>
            <Button variant="secondary" onClick={() => setShowQuestions((current) => !current)}>
              {t(uiText.viewRelatedQuestions, language)}
            </Button>
          </div>

          {showQuestions && (
            <section className="border-t border-border pt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t(uiText.relatedQuestions, language)}
              </p>
              {questions.length === 0 ? (
                <p className="text-sm text-muted">{t(uiText.noQuestions, language)}</p>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border">
                  {questions.map((question) => {
                    const assessment = assessments.find((item) => item.id === question.assessmentId);
                    const questionCategory = categories.find((item) => item.id === question.categoryId);
                    const typeLabel =
                      question.type === "short_answer"
                        ? t(uiText.filterShortAnswer, language)
                        : t(uiText.filterMultipleChoice, language);
                    return (
                      <li key={question.id}>
                        <button
                          type="button"
                          onClick={() => onSelectRelatedQuestion(question.id)}
                          className="w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        >
                          <p className="text-xs font-medium uppercase tracking-wide text-muted">
                            {[
                              assessment ? t(assessment.title, language) : "",
                              question.number,
                              questionCategory ? t(questionCategory.name, language) : "",
                              typeLabel,
                            ]
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
          )}
        </div>
      </section>
    </div>
  );
}
