import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { useAssessments } from "../hooks/useAssessments";
import { useCategories } from "../hooks/useCategories";
import { useQuestionsByAssessment } from "../hooks/useQuestions";
import { t, uiText } from "../utils/translation";
import { AssessmentBrowser } from "../components/browser/AssessmentBrowser";

export function UjianPage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { assessments } = useAssessments();
  const { categories } = useCategories();

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!selectedAssessmentId && assessments.length > 0) {
      setSelectedAssessmentId(assessments[0].id);
    }
  }, [assessments, selectedAssessmentId]);

  const { questions } = useQuestionsByAssessment(selectedAssessmentId);

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-7">
        <h1 className="page-title">
          {t(uiText.ujianTitle, language)}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t(uiText.ujianDescription, language)}</p>
      </div>

      <AssessmentBrowser
        assessments={assessments}
        selectedAssessmentId={selectedAssessmentId}
        onSelectAssessment={setSelectedAssessmentId}
        questions={questions}
        categories={categories}
        onSelectQuestion={(questionId) => navigate(`/review/${questionId}`)}
      />
    </div>
  );
}
