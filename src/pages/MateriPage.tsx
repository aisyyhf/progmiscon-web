import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { useCategories } from "../hooks/useCategories";
import { useAssessments } from "../hooks/useAssessments";
import { useQuestionsByCategory } from "../hooks/useQuestions";
import { t, uiText } from "../utils/translation";
import { MaterialBrowser } from "../components/browser/MaterialBrowser";

export function MateriPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { categories } = useCategories();
  const { assessments } = useAssessments();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(
    searchParams.get("category") ?? undefined,
  );

  useEffect(() => {
    if (!selectedCategoryId && categories.length > 0) {
      setSelectedCategoryId(categories[0].id);
    }
  }, [categories, selectedCategoryId]);

  const { questions } = useQuestionsByCategory(selectedCategoryId);

  const handleSelectCategory = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSearchParams({ category: categoryId });
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-serif-brand text-2xl font-semibold text-navy-deep">
          {t(uiText.materiTitle, language)}
        </h1>
        <p className="mt-1 text-sm text-muted">{t(uiText.materiDescription, language)}</p>
      </div>

      <MaterialBrowser
        categories={categories}
        selectedCategoryId={selectedCategoryId}
        onSelectCategory={handleSelectCategory}
        questions={questions}
        assessments={assessments}
        onSelectQuestion={(questionId) => navigate(`/question/${questionId}`)}
      />
    </div>
  );
}
