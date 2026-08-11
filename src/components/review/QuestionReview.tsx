import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useQuestions } from "../../hooks/useQuestions";
import { useMisconceptions } from "../../hooks/useMisconceptions";
import { useAllStudentAnswers } from "../../hooks/useStudentAnswers";
import {
  answerHasMisconception,
  getAnswerVariations,
  getRelatedQuestions,
} from "../../utils/misconceptionExploration";
import { misconceptionLabel } from "../../utils/misconceptionLabel";
import { getQuestionOptionMisconceptionIds } from "../../utils/questionMetadata";
import { QuestionPanel } from "./QuestionPanel";
import { AnswerCasePanel } from "./AnswerCasePanel";
import {
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  ChevronRight,
  ListChecks,
  LogOut,
  SearchCheck,
} from "lucide-react";

export function QuestionReview({ questionId }: { questionId: string }) {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

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

  const availableMisconceptionIds = useMemo(() => {
    const ids = new Set<string>(question?.questionMisconceptionIds ?? []);
    question?.options?.forEach((option) =>
      getQuestionOptionMisconceptionIds(option).forEach((id) => ids.add(id)),
    );
    answers.forEach((answer) => answer.studentMisconceptionIds.forEach((id) => ids.add(id)));
    return [...ids];
  }, [answers, question]);

  const relatedQuestions = useMemo(() => {
    if (!filterMisconceptionId || !selectedMisconception) return [];
    return getRelatedQuestions(
      allQuestions,
      answerVariations,
      filterMisconceptionId,
      selectedMisconception.relatedQuestionIds,
    );
  }, [allQuestions, answerVariations, filterMisconceptionId, selectedMisconception]);

  const filteredAnswers = useMemo(
    () =>
      filterMisconceptionId
        ? answers.filter((answer) =>
            answerHasMisconception(answer, filterMisconceptionId, question),
          )
        : answers,
    [answers, filterMisconceptionId, question],
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

  const questionCode = question.sourceCode?.trim() || question.id;
  const normalQuestionIndex = allQuestions.findIndex((item) => item.id === activeQuestionId);
  const relatedQuestionIndex = relatedQuestions.findIndex((item) => item.id === activeQuestionId);
  const navigationQuestions = selectedMisconception ? relatedQuestions : allQuestions;
  const navigationIndex = selectedMisconception ? relatedQuestionIndex : normalQuestionIndex;
  const previousQuestion = navigationIndex > 0 ? navigationQuestions[navigationIndex - 1] : undefined;
  const nextQuestion =
    navigationIndex >= 0 && navigationIndex < navigationQuestions.length - 1
      ? navigationQuestions[navigationIndex + 1]
      : undefined;

  const resetExploration = () => {
    setFilterMisconceptionId(undefined);
    setActiveQuestionId(questionId);
    setSelectedAnswerId(undefined);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const changeQuestion = (nextQuestionId: string) => {
    setSelectedAnswerId(undefined);
    if (selectedMisconception) {
      setActiveQuestionId(nextQuestionId);
    } else {
      navigate(`/question/${nextQuestionId}`);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const previousCode = previousQuestion?.sourceCode?.trim() || previousQuestion?.id;
  const nextCode = nextQuestion?.sourceCode?.trim() || nextQuestion?.id;

  return (
    <div className="scroll-reveal">
      {!selectedMisconception && (
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center justify-end gap-1.5 text-xs font-semibold text-muted">
          <button
            type="button"
            onClick={() => navigate("/materi")}
            className="cursor-pointer transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {language === "id" ? "Katalog Soal" : "Question Catalog"}
          </button>
          <ChevronRight size={13} className="text-slate-300" aria-hidden="true" />
          <span className="font-mono text-navy-deep">{questionCode}</span>
        </nav>
      )}

      <div>
        {selectedMisconception && (
          <section className="grid gap-5 border-y border-brand-deep bg-brand px-5 py-4 text-white sm:px-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8">
            <div className="flex min-w-0 items-center gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/35 bg-white/10">
                <SearchCheck size={21} strokeWidth={2} aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-white/75">
                  {language === "id" ? "Mode Telusuri Miskonsepsi" : "Misconception Tracing Mode"}
                </p>
                <h1 className="mt-1 break-words text-base font-bold leading-6 text-white sm:text-lg">
                  {misconceptionLabel(selectedMisconception, language)}
                </h1>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 sm:pl-[3.75rem] lg:justify-end lg:pl-0">
              <span className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-white/30 bg-white/10 px-3 text-sm font-bold leading-none tabular-nums text-white">
                <ListChecks size={16} strokeWidth={2} aria-hidden="true" />
                {language === "id"
                  ? `${relatedQuestions.length} soal terkait`
                  : `${relatedQuestions.length} related questions`}
              </span>
              <button
                type="button"
                onClick={resetExploration}
                className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-bold leading-none text-white transition-colors hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <LogOut size={15} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                <span>{language === "id" ? "Kembali ke semua soal" : "Back to all questions"}</span>
              </button>
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 border-b border-border lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <QuestionPanel
            question={question}
            activeMisconceptionId={filterMisconceptionId}
            onSelectMisconception={selectMisconception}
          />
          <div className="min-w-0 border-t border-border bg-brand-soft/45 lg:border-l-2 lg:border-l-brand/15 lg:border-t-0">
            <AnswerCasePanel
              question={question}
              answers={selectedAnswerId ? filteredAnswers : []}
              selectedAnswerId={selectedAnswerId ?? ""}
              onSelectAnswer={setSelectedAnswerId}
              filterMisconceptionId={filterMisconceptionId}
              onFilterMisconception={selectMisconception}
              availableMisconceptionIds={availableMisconceptionIds}
              onSelectMisconception={selectMisconception}
            />
          </div>
        </div>

        <nav
          aria-label={
            selectedMisconception
              ? language === "id"
                ? "Navigasi soal terkait"
                : "Related question navigation"
              : language === "id"
                ? "Navigasi soal"
                : "Question navigation"
          }
          className="grid min-h-20 grid-cols-1 items-center gap-3 border-b border-border bg-bg px-4 py-3 sm:grid-cols-[1fr_auto_1fr] sm:gap-4 sm:px-7"
        >
          <button
            type="button"
            disabled={!previousQuestion}
            onClick={() => previousQuestion && changeQuestion(previousQuestion.id)}
            className="group inline-flex min-w-0 cursor-pointer items-center gap-2.5 justify-self-start rounded-full bg-brand px-4 py-2.5 text-left text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-neutral disabled:text-muted disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            aria-label={
              selectedMisconception
                ? language === "id"
                  ? `Soal terkait sebelumnya${previousCode ? `, ${previousCode}` : ""}`
                  : `Previous related question${previousCode ? `, ${previousCode}` : ""}`
                : language === "id"
                  ? `Soal sebelumnya${previousCode ? `, ${previousCode}` : ""}`
                  : `Previous question${previousCode ? `, ${previousCode}` : ""}`
            }
          >
            <ArrowLeft size={17} className="shrink-0 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
            <span className="inline-flex min-w-0 items-baseline gap-2 whitespace-nowrap">
              <span className="text-xs font-semibold">
                {selectedMisconception
                  ? language === "id"
                    ? "Soal terkait sebelumnya"
                    : "Previous related question"
                  : language === "id"
                    ? "Soal sebelumnya"
                    : "Previous question"}
              </span>
              <span className="font-mono text-xs font-extrabold text-white/80 group-disabled:text-muted">{previousCode ?? "—"}</span>
            </span>
          </button>

          {selectedMisconception && relatedQuestionIndex >= 0 && (
            <div className="col-span-2 row-start-2 flex items-center justify-center gap-2 text-xs font-bold tabular-nums text-muted sm:col-span-1 sm:row-start-auto">
              <BookOpenCheck size={15} className="text-brand" aria-hidden="true" />
              {language === "id"
                ? `Soal terkait ${relatedQuestionIndex + 1} dari ${relatedQuestions.length}`
                : `Related question ${relatedQuestionIndex + 1} of ${relatedQuestions.length}`}
            </div>
          )}

          <button
            type="button"
            disabled={!nextQuestion}
            onClick={() => nextQuestion && changeQuestion(nextQuestion.id)}
            className="group inline-flex min-w-0 cursor-pointer items-center gap-2.5 justify-self-end rounded-full bg-brand px-4 py-2.5 text-right text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:bg-neutral disabled:text-muted disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:col-start-3"
            aria-label={
              selectedMisconception
                ? language === "id"
                  ? `Soal terkait berikutnya${nextCode ? `, ${nextCode}` : ""}`
                  : `Next related question${nextCode ? `, ${nextCode}` : ""}`
                : language === "id"
                  ? `Soal berikutnya${nextCode ? `, ${nextCode}` : ""}`
                  : `Next question${nextCode ? `, ${nextCode}` : ""}`
            }
          >
            <span className="inline-flex min-w-0 items-baseline gap-2 whitespace-nowrap">
              <span className="text-xs font-semibold">
                {selectedMisconception
                  ? language === "id"
                    ? "Soal terkait berikutnya"
                    : "Next related question"
                  : language === "id"
                    ? "Soal berikutnya"
                    : "Next question"}
              </span>
              <span className="font-mono text-xs font-extrabold text-white/80 group-disabled:text-muted">{nextCode ?? "—"}</span>
            </span>
            <ArrowRight size={17} className="shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}
