import type { Question, StudentAnswer } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { groupMisconceptionReasons } from "../../utils/misconceptionReasons";
import { AnswerCaseNavigator, answerCaseLabel } from "./AnswerCaseNavigator";
import { AnswerStatusBar } from "./AnswerStatusBar";
import { AnswerVisualization } from "./AnswerVisualization";
import { PseudocodeBlock } from "./PseudocodeBlock";
import { ArrowRight } from "lucide-react";

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
  const { misconceptions: filterMisconceptions } = useMisconceptionsByIds(availableMisconceptionIds);

  const selectedOption =
    question.type === "multiple_choice"
      ? question.options?.find((option) => option.id === answer?.selectedOptionId)
      : undefined;
  const selectedOptionMisconception = selectedOption?.misconceptionId
    ? filterMisconceptions.find((item) => item.id === selectedOption.misconceptionId)
    : undefined;

  const getCaseIndex = (answerId: string) => answers.findIndex((item) => item.id === answerId);
  const misconceptionReasonGroups = groupMisconceptionReasons(
    misconceptions.length,
    answer?.incorrectElements ?? [],
  );

  return (
    <section className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 py-3 md:px-7">
        <h2 className="text-lg font-bold text-navy-deep">
          {answer
            ? answerCaseLabel(getCaseIndex(answer.id), answers.length, language)
            : language === "id"
              ? "Jawaban"
              : "Answer"}
        </h2>
        {answers.length > 0 && answer && (
          <AnswerCaseNavigator
            caseIds={answers.map((item) => item.id)}
            selectedCaseId={selectedAnswerId}
            onSelectCase={onSelectAnswer}
          />
        )}
      </div>

      <div className="border-b border-border px-5 py-3 md:px-7">
        <div className="w-full">
          <label htmlFor="answer-misconception-filter" className="block text-sm font-semibold text-navy-deep">
            {language === "id" ? "Filter miskonsepsi" : "Misconception filter"}
          </label>
          <select
            id="answer-misconception-filter"
            value={filterMisconceptionId ?? ""}
            onChange={(event) => onFilterMisconception(event.target.value || undefined)}
            className="academic-input mt-2 h-10 cursor-pointer px-3 text-[13px]"
          >
            <option value="">{language === "id" ? "Semua jawaban" : "All answers"}</option>
            {filterMisconceptions.map((misconception) => (
              <option key={misconception.id} value={misconception.id}>
                {t(misconception.title, language)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {answers.length === 0 || !answer ? (
        <div className="px-5 py-8 text-sm text-muted md:px-7">
          {language === "id"
            ? "Belum ada variasi jawaban yang dipetakan ke miskonsepsi ini pada soal tersebut."
            : "No answer variations have been mapped to this misconception for this question."}
        </div>
      ) : (
        <div className="p-5 md:p-7">
          <div className="grid gap-6">
            <div className="space-y-6">
              <div>
                {question.type === "multiple_choice" && (
                  <p className="academic-label mb-2">{t(uiText.selectedOptionLabel, language)}</p>
                )}
                <div className="space-y-3">
                  <div className="overflow-hidden rounded-lg border border-border">
                    {question.type === "multiple_choice" ? (
                      <div className="bg-bg p-5">
                        {selectedOption ? (
                          <div>
                            <p className="text-sm text-navy-deep">
                              <span className="font-medium">{selectedOption.label}.</span>{" "}
                              {t(selectedOption.text, language)}
                            </p>
                            {selectedOptionMisconception && (
                              <p className="mt-2 text-xs text-muted">
                                {language === "id" ? "Opsi ini memicu" : "This option triggers"}{" "}
                                <button
                                  type="button"
                                  onClick={() => onSelectMisconception(selectedOptionMisconception.id)}
                                  className="cursor-pointer font-medium text-brand underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                                >
                                  {t(selectedOptionMisconception.title, language)}
                                </button>
                                .
                              </p>
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

              <section className="rounded-lg border border-border bg-white p-5">
                <h3 className="text-base font-bold text-navy-deep">
                  {language === "id" ? "Miskonsepsi pada Jawaban" : "Misconceptions in This Answer"}
                </h3>
                {misconceptions.length === 0 ? (
                  <p className="mt-3 text-sm leading-6 text-muted">
                    {t(answer.status === "correct" ? uiText.emptyCorrectAnswerMisconceptions : uiText.emptyIncorrectAnswerMisconceptions, language)}
                  </p>
                ) : (
                  <div className="mt-3 grid gap-3">
                    {misconceptions.map((misconception, misconceptionIndex) => {
                      const reasons = misconceptionReasonGroups[misconceptionIndex] ?? [];
                      return (
                        <article key={misconception.id} className="rounded-lg border border-border bg-bg p-4">
                          <button
                            type="button"
                            onClick={() => onSelectMisconception(misconception.id)}
                            className="group flex w-full cursor-pointer items-center justify-between gap-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                          >
                            <span className="text-sm font-semibold text-navy-deep transition-colors group-hover:text-brand">
                              {t(misconception.title, language)}
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
