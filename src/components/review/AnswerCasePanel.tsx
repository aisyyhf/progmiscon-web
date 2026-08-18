import type { Question, StudentAnswer } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { misconceptionLabel } from "../../utils/misconceptionLabel";
import { getQuestionOptionMisconceptionIds } from "../../utils/questionMetadata";
import { cn } from "../../utils/cn";
import { AnswerCaseNavigator } from "./AnswerCaseNavigator";
import { AnswerStatusBar } from "./AnswerStatusBar";
import { AnswerVisualization } from "./AnswerVisualization";
import { PseudocodeBlock } from "./PseudocodeBlock";
import { ArrowRight, BrainCircuit } from "lucide-react";

export function AnswerCasePanel({
  question,
  answers,
  selectedAnswerId,
  onSelectAnswer,
  filterMisconceptionId,
  onFilterMisconception,
  availableMisconceptionIds,
  onSelectMisconception,
}: {
  question: Question;
  answers: StudentAnswer[];
  selectedAnswerId: string;
  onSelectAnswer: (answerId: string) => void;
  filterMisconceptionId: string | undefined;
  onFilterMisconception: (misconceptionId: string | undefined) => void;
  availableMisconceptionIds: string[];
  onSelectMisconception: (misconceptionId: string) => void;
}) {
  const { language } = useLanguage();
  const answer = answers.find((item) => item.id === selectedAnswerId);
  const { misconceptions } = useMisconceptionsByIds(answer?.studentMisconceptionIds ?? []);

  const selectedOption =
    question.type === "multiple_choice"
      ? question.options?.find((option) => option.id === answer?.selectedOptionId)
      : undefined;
  const selectedOptionMisconceptionIds = selectedOption
    ? getQuestionOptionMisconceptionIds(selectedOption)
    : [];
  const { misconceptions: filterMisconceptions } = useMisconceptionsByIds([
    ...new Set([
      ...availableMisconceptionIds,
      ...selectedOptionMisconceptionIds,
    ]),
  ]);
  const selectedOptionMisconceptions = selectedOptionMisconceptionIds
    .map((id) => filterMisconceptions.find((item) => item.id === id))
    .filter((item) => item !== undefined);

  const reasonsByMisconception = new Map(
    (answer?.misconceptionReasons ?? []).map((item) => [item.misconceptionId, [item.reason]]),
  );

  return (
    <section className="relative min-w-0">
      <div className="flex min-h-16 items-center justify-between gap-4 border-b border-brand/10 px-5 py-3 sm:px-7 lg:px-8">
        <h2 className="text-xl font-extrabold leading-none tracking-[-0.02em] text-navy-deep sm:text-2xl">
          {language === "id" ? "Jawaban" : "Answer"}
        </h2>
        {answers.length > 0 && answer && (
          <AnswerCaseNavigator
            caseIds={answers.map((item) => item.id)}
            selectedCaseId={selectedAnswerId}
            onSelectCase={onSelectAnswer}
          />
        )}
      </div>

      <div className="border-b border-brand/10 px-5 py-3 sm:px-7 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="shrink-0 text-[11px] font-bold leading-7 text-muted">
            {language === "id" ? "Filter miskonsepsi" : "Misconception filter"}
          </p>
          <div
            role="group"
            aria-label={language === "id" ? "Filter miskonsepsi jawaban" : "Answer misconception filter"}
            className="flex flex-wrap items-center gap-1.5"
          >
            <button
              type="button"
              onClick={() => onFilterMisconception(undefined)}
              aria-pressed={!filterMisconceptionId}
              className={cn(
                "min-h-7 cursor-pointer rounded-full border px-3 py-1 text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                !filterMisconceptionId
                  ? "border-brand bg-brand text-white"
                  : "border-brand/15 bg-white/70 text-muted hover:border-brand/35 hover:text-brand",
              )}
            >
              {language === "id" ? "Semua" : "All"}
            </button>
            {filterMisconceptions.map((misconception) => (
              <button
                key={misconception.id}
                type="button"
                onClick={() => onFilterMisconception(misconception.id)}
                aria-label={misconceptionLabel(misconception, language)}
                aria-pressed={filterMisconceptionId === misconception.id}
                title={misconceptionLabel(misconception, language)}
                className={cn(
                  "min-h-7 cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  filterMisconceptionId === misconception.id
                    ? "border-brand bg-brand text-white"
                    : "border-brand/15 bg-white/70 text-brand hover:border-brand/35 hover:bg-white",
                )}
              >
                {misconception.id}
              </button>
            ))}
          </div>
        </div>
      </div>

      {answers.length === 0 || !answer ? (
        <div className="px-5 py-8 text-sm text-muted sm:px-7 lg:px-8">
          {language === "id"
            ? "Belum ada variasi jawaban yang dipetakan ke miskonsepsi ini pada soal tersebut."
            : "No answer variations have been mapped to this misconception for this question."}
        </div>
      ) : (
        <div className="p-5 sm:p-7 lg:p-8">
          <div className="grid gap-6">
            <div className="min-w-0 space-y-6">
              <div>
                {question.type === "multiple_choice" && (
                  <p className="academic-label mb-2">{t(uiText.selectedOptionLabel, language)}</p>
                )}
                <div className="min-w-0 space-y-0.5">
                  <div className="min-w-0 overflow-hidden rounded-lg border border-navy-deep/15 shadow-sm">
                    {question.type === "multiple_choice" ? (
                      <div className="bg-bg p-5">
                        {selectedOption ? (
                          <div>
                            <p className="text-sm text-navy-deep">
                              <span className="font-medium">{selectedOption.label}.</span>{" "}
                              {t(selectedOption.text, language)}
                            </p>
                            {selectedOptionMisconceptions.length > 0 && (
                              <div className="mt-2 text-xs text-muted">
                                {language === "id" ? "Opsi ini memicu" : "This option triggers"}{" "}
                                <ul className="mt-1 space-y-1">
                                  {selectedOptionMisconceptions.map((misconception) => (
                                    <li key={misconception.id}>
                                      <button
                                        type="button"
                                        onClick={() => onSelectMisconception(misconception.id)}
                                        className="cursor-pointer text-left font-medium text-brand underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                                      >
                                        {misconceptionLabel(misconception, language)}
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <PseudocodeBlock code={answer.answerText ?? ""} />
                    )}
                  </div>
                  <AnswerStatusBar status={answer.status} />
                </div>
              </div>

              <section className="border-t border-brand/10 pt-5">
                <h3 className="flex items-center gap-2 text-base font-bold text-navy-deep">
                  <BrainCircuit size={17} strokeWidth={2} className="shrink-0 text-brand" aria-hidden="true" />
                  <span>{language === "id" ? "Miskonsepsi pada Jawaban" : "Misconceptions in This Answer"}</span>
                </h3>
                {misconceptions.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {t(answer.status === "correct" ? uiText.emptyCorrectAnswerMisconceptions : uiText.emptyIncorrectAnswerMisconceptions, language)}
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {misconceptions.map((misconception) => {
                      const reasons = reasonsByMisconception.get(misconception.id) ?? [];
                      return (
                        <article key={misconception.id} className="rounded-r-lg border-l-2 border-brand/55 bg-white/70 px-4 py-3.5">
                          <button
                            type="button"
                            onClick={() => onSelectMisconception(misconception.id)}
                            className="group flex w-full cursor-pointer items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <span className="text-sm font-semibold text-navy-deep transition-colors group-hover:text-brand">
                              {misconceptionLabel(misconception, language)}
                            </span>
                            <ArrowRight size={16} strokeWidth={2} className="shrink-0 text-muted transition-[color,transform] group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden="true" />
                          </button>
                          <div className="mt-3 border-t border-border pt-3">
                            <p className="text-xs font-bold text-muted">{language === "id" ? "Alasan" : "Reason"}</p>
                            {reasons.length > 0 ? (
                              <ul className="mt-1.5 space-y-1 text-sm leading-6 text-navy-deep">
                                {reasons.map((reason, reasonIndex) => (
                                  <li key={reasonIndex}>{t(reason, language)}</li>
                                ))}
                              </ul>
                            ) : (
                              <p className="mt-1.5 text-sm leading-6 text-muted">
                                {language === "id"
                                  ? "Jawaban ini menunjukkan pola yang cocok dengan miskonsepsi tersebut."
                                  : "This answer shows a pattern that matches the mapped misconception."}
                              </p>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <AnswerVisualization key={answer.id} />
          </div>
        </div>
      )}
    </section>
  );
}
