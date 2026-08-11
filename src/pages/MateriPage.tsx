import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import { useQuestionsByCategories } from "../hooks/useQuestions";
import { MaterialBrowser } from "../components/browser/MaterialBrowser";

export function MateriPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();

  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    searchParams.getAll("category"),
  );

  useEffect(() => {
    if (selectedCategoryIds.length === 0 && categories.length > 0) {
      setSelectedCategoryIds([categories[0].id]);
    }
  }, [categories, selectedCategoryIds.length]);

  const { questions, loading } = useQuestionsByCategories(selectedCategoryIds);

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
        onResetCategories={() => updateSelectedCategories(categories[0] ? [categories[0].id] : [])}
        questions={questions}
        loading={loading}
        onSelectQuestion={(questionId) => navigate(`/question/${questionId}`)}
      />
    </div>
  );
}
