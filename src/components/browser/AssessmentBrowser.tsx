import type { Assessment, Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { QuestionList } from "./QuestionList";

export function AssessmentBrowser({
  assessments,
  selectedAssessmentId,
  onSelectAssessment,
  questions,
  categories,
  onSelectQuestion,
}: {
  assessments: Assessment[];
  selectedAssessmentId: string | undefined;
  onSelectAssessment: (assessmentId: string) => void;
  questions: Question[];
  categories: Category[];
  onSelectQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-[280px_1fr] md:items-start">
      <nav aria-label="Ujian" className="space-y-1 rounded-lg border border-border bg-white p-4 md:sticky md:top-24">
        <p className="mb-3 text-lg font-bold text-navy-deep">
          {language === "id" ? "Daftar Ujian" : "Assessment List"}
        </p>
        {assessments.map((assessment) => {
          const active = assessment.id === selectedAssessmentId;
          return (
            <button
              key={assessment.id}
              type="button"
              onClick={() => onSelectAssessment(assessment.id)}
              aria-current={active}
              className={cn(
                "block w-full cursor-pointer rounded-md px-3 py-2.5 text-left text-sm font-medium transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                active
                  ? "bg-brand text-white"
                  : "text-muted hover:bg-neutral hover:text-navy-deep",
              )}
            >
              {t(assessment.title, language)}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0">
        <QuestionList
          questions={questions}
          assessments={assessments}
          categories={categories}
          onSelect={onSelectQuestion}
          showFilters={false}
          primaryMetaMode="category"
        />
      </div>
    </div>
  );
}
