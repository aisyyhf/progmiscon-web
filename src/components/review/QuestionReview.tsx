import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useQuestion, useQuestions } from "../../hooks/useQuestions";
import { useAssessments } from "../../hooks/useAssessments";
import { useCategories } from "../../hooks/useCategories";
import { useMisconceptions } from "../../hooks/useMisconceptions";
import { useStudentAnswers } from "../../hooks/useStudentAnswers";
import { t, uiText } from "../../utils/translation";
import { buildConcepts } from "../../utils/concepts";
import { Breadcrumb } from "../layout/Breadcrumb";
import { QuestionPanel } from "./QuestionPanel";
import { AnswerCasePanel } from "./AnswerCasePanel";
import { MisconceptionPreviewModal } from "../misconception/MisconceptionPreviewModal";

export function QuestionReview({ questionId }: { questionId: string }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { question } = useQuestion(questionId);
  const { assessments } = useAssessments();
  const { categories } = useCategories();
  const { misconceptions } = useMisconceptions();
  const { questions: allQuestions } = useQuestions();
  const { answers } = useStudentAnswers(questionId);

  const [selectedAnswerId, setSelectedAnswerId] = useState<string | undefined>(undefined);
  const [filterMisconceptionId, setFilterMisconceptionId] = useState<string | undefined>(undefined);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedMisconceptionId, setSelectedMisconceptionId] = useState<string | undefined>(undefined);

  const requestedAnswerId = searchParams.get("case") ?? undefined;

  const concepts = useMemo(
    () => buildConcepts(categories, allQuestions, misconceptions),
    [categories, allQuestions, misconceptions],
  );

  const availableMisconceptionIds = useMemo(() => {
    const ids = new Set<string>(question?.questionMisconceptionIds ?? []);
    answers.forEach((answer) => answer.studentMisconceptionIds.forEach((id) => ids.add(id)));
    return [...ids];
  }, [answers, question?.questionMisconceptionIds]);

  const filteredAnswers = useMemo(
    () =>
      filterMisconceptionId
        ? answers.filter((answer) => answer.studentMisconceptionIds.includes(filterMisconceptionId))
        : answers,
    [answers, filterMisconceptionId],
  );

  useEffect(() => {
    if (filteredAnswers.length === 0) {
      setSelectedAnswerId(undefined);
      return;
    }
    if (selectedAnswerId && filteredAnswers.some((answer) => answer.id === selectedAnswerId)) return;
    if (requestedAnswerId && filteredAnswers.some((answer) => answer.id === requestedAnswerId)) {
      setSelectedAnswerId(requestedAnswerId);
      return;
    }
    setSelectedAnswerId(filteredAnswers[0]?.id);
  }, [filteredAnswers, selectedAnswerId, requestedAnswerId]);

  if (!question) return null;

  const assessment = assessments.find((a) => a.id === question.assessmentId);
  const category = categories.find((c) => c.id === question.categoryId);

  const openPreview = (misconceptionId: string) => {
    setSelectedMisconceptionId(misconceptionId);
    setModalOpen(true);
  };

  return (
    <div>
      <Breadcrumb
        items={[
          { label: t(uiText.breadcrumbMateri, language), to: "/materi" },
          {
            label: category ? t(category.name, language) : "",
            to: category ? `/materi?category=${category.id}` : undefined,
          },
          {
            label: `${assessment ? t(assessment.title, language).split(" ")[0] : ""} ${question.number}`,
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <QuestionPanel
          question={question}
          assessment={assessment}
          category={category}
          concepts={concepts}
          onSelectConcept={(conceptId) => navigate(`/konsep/${conceptId}`)}
          onSelectMisconception={openPreview}
        />
        {selectedAnswerId ? (
          <AnswerCasePanel
            question={question}
            answers={filteredAnswers}
            selectedAnswerId={selectedAnswerId}
            onSelectAnswer={setSelectedAnswerId}
            filterMisconceptionId={filterMisconceptionId}
            onFilterMisconception={setFilterMisconceptionId}
            availableMisconceptionIds={availableMisconceptionIds}
            concepts={concepts}
            onSelectConcept={(conceptId) => navigate(`/konsep/${conceptId}`)}
            onSelectMisconception={openPreview}
          />
        ) : (
          <AnswerCasePanel
            question={question}
            answers={[]}
            selectedAnswerId=""
            onSelectAnswer={setSelectedAnswerId}
            filterMisconceptionId={filterMisconceptionId}
            onFilterMisconception={setFilterMisconceptionId}
            availableMisconceptionIds={availableMisconceptionIds}
            concepts={concepts}
            onSelectConcept={(conceptId) => navigate(`/konsep/${conceptId}`)}
            onSelectMisconception={openPreview}
          />
        )}
      </div>

      <MisconceptionPreviewModal
        open={modalOpen}
        misconceptionId={selectedMisconceptionId}
        onClose={() => setModalOpen(false)}
        onSelectRelatedQuestion={(nextQuestionId) => {
          setModalOpen(false);
          navigate(`/question/${nextQuestionId}`);
        }}
        onOpenMisconceptionPage={(misconceptionId) => {
          setModalOpen(false);
          navigate(`/miskonsepsi/${misconceptionId}?fromQuestion=${questionId}${selectedAnswerId ? `&fromCase=${selectedAnswerId}` : ""}`);
        }}
      />
    </div>
  );
}
