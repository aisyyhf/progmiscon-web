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
    <div className="grid grid-cols-1 gap-8 md:grid-cols-[260px_1fr]">
      <nav aria-label="Ujian" className="space-y-1">
        {assessments.map((assessment) => {
          const active = assessment.id === selectedAssessmentId;
          return (
            <button
              key={assessment.id}
              type="button"
              onClick={() => onSelectAssessment(assessment.id)}
              aria-current={active}
              className={cn(
                "block w-full cursor-pointer rounded-md border px-3 py-2 text-left text-sm transition",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                active
                  ? "border-navy bg-navy text-white shadow-[0_1px_2px_rgba(15,23,42,0.10)]"
                  : "border-transparent text-navy-deep hover:border-navy/30 hover:bg-surface hover:shadow-sm",
              )}
            >
              {t(assessment.title, language)}
            </button>
          );
        })}
      </nav>

      <div>
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
