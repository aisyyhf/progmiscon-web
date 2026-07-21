import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import { useQuestionsByCategory } from "../hooks/useQuestions";
import { MaterialBrowser } from "../components/browser/MaterialBrowser";

export function MateriPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    searchParams.get("category") ?? undefined,
  );

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const { questions, loading } = useQuestionsByCategory(selectedCategoryId);

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSearchParams({ category: categoryId });
  };

  return (
    <div className="mx-auto max-w-6xl">
      <MaterialBrowser
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        questions={questions}
        loading={loading}
        onSelectQuestion={(questionId) => navigate(`/question/${questionId}`)}
      />
    </div>
  );
}
