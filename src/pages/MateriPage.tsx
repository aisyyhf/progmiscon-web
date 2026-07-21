import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LibraryBig } from "lucide-react";
import { useLanguage } from "../hooks/useLanguage";
import { useCategories } from "../hooks/useCategories";
import { useQuestionsByCategory } from "../hooks/useQuestions";
import { t, uiText } from "../utils/translation";
import { MaterialBrowser } from "../components/browser/MaterialBrowser";

export function MateriPage() {
  const { language } = useLanguage();
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
      <div className="mb-7 flex items-start gap-4">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <LibraryBig size={22} strokeWidth={2} aria-hidden="true" />
        </span>
        <div>
          <h1 className="page-title">{t(uiText.materiTitle, language)}</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {t(uiText.materiDescription, language)}
          </p>
        </div>
      </div>

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
