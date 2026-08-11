import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import { useQuestions, useQuestionsByCategories } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { MaterialBrowser } from "../components/browser/MaterialBrowser";

export function MateriPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    searchParams.getAll("category"),
  );

  const { questions, loading } = useQuestionsByCategories(selectedCategoryIds);
  const { questions: allQuestions, loading: allQuestionsLoading } = useQuestions();
  const { answers, loading: answersLoading } = useAllStudentAnswers();
  const answerCountByQuestionId = useMemo(() => {
    const counts = new Map<string, number>();
    answers.forEach((answer) => {
      counts.set(answer.questionId, (counts.get(answer.questionId) ?? 0) + 1);
    });
    return counts;
  }, [answers]);

  const updateSelectedCategories = (categoryIds: string[]) => {
    setSelectedCategoryIds(categoryIds);
    const nextSearchParams = new URLSearchParams();
    categoryIds.forEach((categoryId) => nextSearchParams.append("category", categoryId));
    setSearchParams(nextSearchParams);
  };

  const handleToggleCategory = (categoryId: string) => {
    updateSelectedCategories(
      selectedCategoryIds.includes(categoryId)
        ? selectedCategoryIds.filter((id) => id !== categoryId)
        : [...selectedCategoryIds, categoryId],
    );
  };

  return (
    <div className="mx-auto max-w-[1240px]">
      <MaterialBrowser
        categories={categories}
        selectedCategoryIds={selectedCategoryIds}
        onToggleCategory={handleToggleCategory}
        onResetCategories={() => updateSelectedCategories([])}
        questions={questions}
        totalQuestionCount={allQuestions.length}
        loading={loading || allQuestionsLoading}
        answerCountByQuestionId={answerCountByQuestionId}
        answersLoading={answersLoading}
        onSelectQuestion={(questionId) => navigate(`/question/${questionId}`)}
      />
    </div>
  );
}
