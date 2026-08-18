import { useMemo, useState } from "react";
import type { Assessment, Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";
import {
  filterQuestionsByAssessmentKind,
  filterQuestionsByType,
  type AssessmentKindFilter,
  type QuestionTypeFilter,
} from "../../utils/filters";
import { QuestionRow } from "./QuestionRow";
import { EmptyState } from "../common/EmptyState";
import { getMaterialQuestionIdentifier } from "../../utils/materialQuestionFilters";

const kindFilters: { value: AssessmentKindFilter; label: { id: string; en: string } }[] = [
  { value: "all", label: uiText.filterAll },
  { value: "uts", label: uiText.filterUts },
  { value: "uas", label: uiText.filterUas },
  { value: "quiz", label: uiText.filterQuiz },
  { value: "practice", label: uiText.filterPractice },
];

const typeFilters: { value: QuestionTypeFilter; label: { id: string; en: string } }[] = [
  { value: "all", label: uiText.filterAll },
  { value: "short_answer", label: uiText.filterShortAnswer },
  { value: "multiple_choice", label: uiText.filterMultipleChoice },
];

function FilterGroup<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: { id: string; en: string } }[];
  value: T;
  onChange: (value: T) => void;
}) {
  const { language } = useLanguage();
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "cursor-pointer rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            value === option.value
              ? "border-brand bg-brand text-white"
              : "border-border bg-white text-muted hover:border-navy/35 hover:bg-bg hover:text-navy-deep",
          )}
        >
          {t(option.label, language)}
        </button>
      ))}
    </div>
  );
}

export function QuestionList({
  questions,
  assessments,
  categories,
  onSelect,
  showFilters = false,
  primaryMetaMode = "assessment",
}: {
  questions: Question[];
  assessments: Assessment[];
  categories: Category[];
  onSelect: (questionId: string) => void;
  showFilters?: boolean;
  primaryMetaMode?: "assessment" | "category";
}) {
  const { language } = useLanguage();
  const [kindFilter, setKindFilter] = useState<AssessmentKindFilter>("all");
  const [typeFilter, setTypeFilter] = useState<QuestionTypeFilter>("all");

  const filtered = useMemo(() => {
    let result = questions;
    if (showFilters) {
      result = filterQuestionsByAssessmentKind(result, assessments, kindFilter);
      result = filterQuestionsByType(result, typeFilter);
    }
    return result;
  }, [questions, assessments, kindFilter, typeFilter, showFilters]);

  return (
    <div>
      {showFilters && (
        <div className="mb-5 space-y-2">
          <FilterGroup options={kindFilters} value={kindFilter} onChange={setKindFilter} />
          <FilterGroup options={typeFilters} value={typeFilter} onChange={setTypeFilter} />
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message={t(uiText.noQuestions, language)} />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-white">
          {filtered.map((question) => {
            const assessment = assessments.find((a) => a.id === question.assessmentId);
            const category = categories.find((c) => c.id === question.categoryId);
            const typeLabel =
              question.type === "short_answer"
                ? t(uiText.filterShortAnswer, language)
                : t(uiText.filterMultipleChoice, language);

            const metaItems =
              primaryMetaMode === "assessment"
                ? [assessment ? t(assessment.title, language) : "", getMaterialQuestionIdentifier(question), typeLabel]
                : [getMaterialQuestionIdentifier(question), category ? t(category.name, language) : "", typeLabel];

            return (
              <QuestionRow
                key={question.id}
                metaItems={metaItems.filter(Boolean)}
                title={t(question.title, language)}
                description={question.shortDescription ? t(question.shortDescription, language).trim() : undefined}
                misconceptionCount={
                  primaryMetaMode === "assessment" ? question.questionMisconceptionIds.length : undefined
                }
                onClick={() => onSelect(question.id)}
              />
            );
          })}
        </ul>
      )}
    </div>
  );
}
