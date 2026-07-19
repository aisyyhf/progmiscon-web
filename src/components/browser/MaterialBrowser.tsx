import type { Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { EmptyState } from "../common/EmptyState";
import { ArrowRight, BookOpenCheck, FileCode2 } from "lucide-react";

export function MaterialBrowser({
  categories,
  selectedCategoryId,
  onSelectCategory,
  questions,
  onSelectQuestion,
}: {
  categories: Category[];
  selectedCategoryId: string | undefined;
  onSelectCategory: (categoryId: string) => void;
  questions: Question[];
  onSelectQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();

  return (
    <div className="scroll-reveal space-y-6">
      <nav
        aria-label={language === "id" ? "Topik materi" : "Material topics"}
        className="hide-scrollbar overflow-x-auto rounded-lg bg-white p-2 shadow-[0_8px_24px_rgba(30,41,59,0.055)] md:overflow-visible"
      >
        <div className="flex min-w-max gap-1.5 md:min-w-0 md:flex-wrap">
          {categories.map((category) => {
            const active = category.id === selectedCategoryId;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                aria-current={active}
                className={cn(
                  "shrink-0 cursor-pointer rounded-md px-4 py-2.5 text-left text-sm font-semibold transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  active
                    ? "bg-navy text-white shadow-sm"
                    : "text-muted hover:bg-neutral hover:text-navy-deep",
                )}
              >
                {t(category.name, language)}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0">
        {questions.length === 0 ? (
          <EmptyState message={t(uiText.noQuestions, language)} />
        ) : (
          <div>
            <div className="mb-4">
              <p className="text-base font-bold text-navy-deep">
                {language === "id" ? "Soal dalam topik ini" : "Questions in this topic"}
              </p>
              <p className="mt-0.5 text-sm text-muted">
                {questions.length} {language === "id" ? "soal tersedia" : "questions available"}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
            {questions.map((question) => (
              <button
                key={question.id}
                type="button"
                onClick={() => onSelectQuestion(question.id)}
                className="group flex min-h-56 w-full cursor-pointer flex-col rounded-lg bg-white p-5 text-left shadow-[0_7px_24px_rgba(30,41,59,0.055)] transition-[transform,box-shadow] hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(30,41,59,0.09)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-neutral text-navy">
                    <FileCode2 size={18} strokeWidth={2} aria-hidden="true" />
                  </span>
                  <span className="text-xs font-medium text-muted">
                    {question.questionMisconceptionIds.length} {language === "id" ? "miskonsepsi" : "misconceptions"}
                  </span>
                </div>
                <p className="mt-5 line-clamp-3 text-base font-bold leading-6 text-navy-deep transition-colors group-hover:text-brand">
                  {t(question.prompt, language)}
                </p>
                {question.expectedConcepts.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {question.expectedConcepts.slice(0, 2).map((concept) => (
                      <span key={t(concept, language)} className="rounded bg-neutral px-2 py-1 text-xs font-medium text-muted">
                        {t(concept, language)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-auto flex items-center justify-between border-t border-border/70 pt-4">
                  <span className="flex items-center gap-2 text-sm font-semibold text-brand">
                    <BookOpenCheck size={16} strokeWidth={2} aria-hidden="true" />
                    {language === "id" ? "Buka soal" : "Open question"}
                  </span>
                  <ArrowRight size={16} strokeWidth={2} className="text-brand transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </div>
              </button>
            ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
