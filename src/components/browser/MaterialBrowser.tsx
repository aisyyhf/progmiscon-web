import type { Assessment, Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { EmptyState } from "../common/EmptyState";

export function MaterialBrowser({
  categories,
  selectedCategoryId,
  onSelectCategory,
  questions,
  assessments,
  onSelectQuestion,
}: {
  categories: Category[];
  selectedCategoryId: string | undefined;
  onSelectCategory: (categoryId: string) => void;
  questions: Question[];
  assessments: Assessment[];
  onSelectQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[240px_1fr]">
      <nav aria-label="Materi" className="space-y-1">
        {categories.map((category) => {
          const active = category.id === selectedCategoryId;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onSelectCategory(category.id)}
              aria-current={active}
              className={cn(
                "block w-full cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                active
                  ? "border-navy bg-navy text-white shadow-[0_1px_2px_rgba(15,23,42,0.10)]"
                  : "border-transparent text-navy-deep hover:border-gold/45 hover:bg-surface hover:shadow-sm",
              )}
            >
              {t(category.name, language)}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        {questions.length === 0 ? (
          <EmptyState message={t(uiText.noQuestions, language)} />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {questions.map((question) => {
              const assessment = assessments.find((item) => item.id === question.assessmentId);
              const typeLabel =
                question.type === "short_answer"
                  ? t(uiText.filterShortAnswer, language)
                  : t(uiText.filterMultipleChoice, language);

              return (
                <button
                  key={question.id}
                  type="button"
                  onClick={() => onSelectQuestion(question.id)}
                  className="group flex min-h-36 w-full cursor-pointer flex-col justify-between rounded-lg border border-border bg-surface p-5 text-left transition hover:-translate-y-0.5 hover:border-gold hover:shadow-[0_8px_22px_rgba(15,23,42,0.06)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-0"
                >
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {[assessment ? t(assessment.title, language) : "", question.number, typeLabel]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <p className="mt-3 line-clamp-3 text-sm leading-6 text-navy-deep">
                      {t(question.prompt, language)}
                    </p>
                  </div>
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <span className="rounded-full border border-gold/30 bg-gold-soft/35 px-2.5 py-1 text-[11px] text-navy-deep">
                      {question.questionMisconceptionIds.length}{" "}
                      {language === "id" ? "miskonsepsi" : "misconceptions"}
                    </span>
                    <span className="text-sm font-medium text-navy transition group-hover:text-gold">
                      {language === "id" ? "Buka" : "Open"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
