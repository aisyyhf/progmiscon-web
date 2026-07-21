import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useQuestions } from "../../hooks/useQuestions";
import { useCategories } from "../../hooks/useCategories";
import { useMisconceptions } from "../../hooks/useMisconceptions";
import { useAllStudentAnswers } from "../../hooks/useStudentAnswers";
import { t, uiText } from "../../utils/translation";
import { buildConcepts } from "../../utils/concepts";
import { getAnswerVariations, getMatchingAnswers, getRelatedQuestions } from "../../utils/misconceptionExploration";
import { Breadcrumb } from "../layout/Breadcrumb";
import { QuestionPanel } from "./QuestionPanel";
import { AnswerCasePanel } from "./AnswerCasePanel";

export function QuestionReview({ questionId }: { questionId: string }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { categories } = useCategories();
  const { misconceptions } = useMisconceptions();
  const { questions: allQuestions } = useQuestions();
  const { answers: allAnswers } = useAllStudentAnswers();
  const answerVariations = useMemo(() => getAnswerVariations(allAnswers), [allAnswers]);

  const [activeQuestionId, setActiveQuestionId] = useState(questionId);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | undefined>(undefined);
  const [filterMisconceptionId, setFilterMisconceptionId] = useState<string | undefined>(undefined);

  const requestedAnswerId = searchParams.get("case") ?? undefined;
  const question = allQuestions.find((item) => item.id === activeQuestionId);
  const answers = useMemo(
    () => answerVariations.filter((answer) => answer.questionId === activeQuestionId),
    [activeQuestionId, answerVariations],
  );
  const selectedMisconception = misconceptions.find((item) => item.id === filterMisconceptionId);

  const concepts = useMemo(
    () => buildConcepts(categories, allQuestions, misconceptions),
    [categories, allQuestions, misconceptions],
  );

  const availableMisconceptionIds = useMemo(() => {
    const ids = new Set<string>(question?.questionMisconceptionIds ?? []);
    answers.forEach((answer) => answer.studentMisconceptionIds.forEach((id) => ids.add(id)));
    return [...ids];
  }, [answers, question?.questionMisconceptionIds]);

  const relatedQuestions = useMemo(() => {
    if (!filterMisconceptionId || !selectedMisconception) return [];
    return getRelatedQuestions(
      allQuestions,
      answerVariations,
      filterMisconceptionId,
      selectedMisconception.relatedQuestionIds,
    );
  }, [allQuestions, answerVariations, filterMisconceptionId, selectedMisconception]);

  const relatedAnswerCount = useMemo(
    () =>
      filterMisconceptionId
        ? getMatchingAnswers(answerVariations, filterMisconceptionId).filter((answer) =>
            relatedQuestions.some((question) => question.id === answer.questionId),
          ).length
        : 0,
    [answerVariations, filterMisconceptionId, relatedQuestions],
  );

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

  const category = categories.find((c) => c.id === question.categoryId);
  const relatedQuestionIndex = relatedQuestions.findIndex((item) => item.id === activeQuestionId);

  const resetExploration = () => {
    setFilterMisconceptionId(undefined);
    setActiveQuestionId(questionId);
    setSelectedAnswerId(undefined);
  };

  const selectMisconception = (misconceptionId: string | undefined) => {
    if (!misconceptionId) {
      resetExploration();
      return;
    }

    const misconception = misconceptions.find((item) => item.id === misconceptionId);
    const nextRelatedQuestions = misconception
      ? getRelatedQuestions(allQuestions, answerVariations, misconceptionId, misconception.relatedQuestionIds)
      : [];
    const currentQuestionHasMatch = nextRelatedQuestions.some((item) => item.id === activeQuestionId);
    const firstRelatedQuestion = nextRelatedQuestions[0];

    setFilterMisconceptionId(misconceptionId);
    setSelectedAnswerId(undefined);
    if (!currentQuestionHasMatch && firstRelatedQuestion) setActiveQuestionId(firstRelatedQuestion.id);
  };

  const changeRelatedQuestion = (offset: number) => {
    const nextQuestion = relatedQuestions[relatedQuestionIndex + offset];
    if (!nextQuestion) return;
    setActiveQuestionId(nextQuestion.id);
    setSelectedAnswerId(undefined);
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
            label: language === "id" ? "Soal" : "Question",
          },
        ]}
      />

      {selectedMisconception && (
        <section className="mb-5 flex flex-col gap-4 rounded-lg bg-navy px-5 py-4 text-white sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white/65">
              {language === "id" ? "Eksplorasi Miskonsepsi" : "Misconception Exploration"}
            </p>
            <h1 className="mt-1 break-words text-base font-bold text-white">
              {t(selectedMisconception.title, language)}
            </h1>
            <p className="mt-1 text-sm tabular-nums text-white/70">
              {language === "id"
                ? `${relatedQuestions.length} soal terkait / ${relatedAnswerCount} variasi jawaban`
                : `${relatedQuestions.length} related questions / ${relatedAnswerCount} answer variations`}
            </p>
          </div>
          <button
            type="button"
            onClick={resetExploration}
            className="shrink-0 cursor-pointer self-start rounded-md bg-white/10 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/18 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:self-auto"
          >
            {language === "id" ? "Keluar dari Eksplorasi" : "Exit Exploration"}
          </button>
        </section>
      )}

      <div className="scroll-reveal grid grid-cols-1 gap-5 xl:grid-cols-2 xl:items-start">
        <QuestionPanel
          question={question}
          concepts={concepts}
          onSelectConcept={(conceptId) => navigate(`/konsep/${conceptId}`)}
          onSelectMisconception={selectMisconception}
          relatedQuestionIndex={filterMisconceptionId ? relatedQuestionIndex : undefined}
          relatedQuestionTotal={filterMisconceptionId ? relatedQuestions.length : undefined}
          onPreviousQuestion={() => changeRelatedQuestion(-1)}
          onNextQuestion={() => changeRelatedQuestion(1)}
        />
        {selectedAnswerId ? (
          <AnswerCasePanel
            question={question}
            answers={filteredAnswers}
            selectedAnswerId={selectedAnswerId}
            onSelectAnswer={setSelectedAnswerId}
            filterMisconceptionId={filterMisconceptionId}
            onFilterMisconception={selectMisconception}
            availableMisconceptionIds={availableMisconceptionIds}
            onSelectMisconception={selectMisconception}
          />
        ) : (
          <AnswerCasePanel
            question={question}
            answers={[]}
            selectedAnswerId=""
            onSelectAnswer={setSelectedAnswerId}
            filterMisconceptionId={filterMisconceptionId}
            onFilterMisconception={selectMisconception}
            availableMisconceptionIds={availableMisconceptionIds}
            onSelectMisconception={selectMisconception}
          />
        )}
      </div>
    </div>
  );
}
