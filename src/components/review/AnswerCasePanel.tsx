import type { Question, StudentAnswer } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { MisconceptionChip } from "../misconception/MisconceptionChip";
import { AnswerCaseNavigator, answerCaseLabel } from "./AnswerCaseNavigator";
import { AnswerStatusBar } from "./AnswerStatusBar";
import { AnswerVisualization } from "./AnswerVisualization";
import { Filter, MessageSquareText } from "lucide-react";

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

  return (
    <section className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-white">
      <div className="flex flex-col gap-3 border-b border-border bg-neutral px-5 py-4 sm:flex-row sm:items-end sm:justify-between md:px-7">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="answer-misconception-filter" className="flex items-center gap-2 text-xs font-semibold text-muted">
            <Filter size={14} strokeWidth={2} aria-hidden="true" />
            {filterMisconceptionId
              ? language === "id"
                ? "Miskonsepsi aktif"
                : "Active misconception"
              : language === "id"
                ? "Filter miskonsepsi"
                : "Misconception filter"}
          </label>
          <select
            id="answer-misconception-filter"
            value={filterMisconceptionId ?? ""}
            onChange={(event) => onFilterMisconception(event.target.value || undefined)}
            className="academic-input mt-2 h-10 cursor-pointer px-3 text-sm"
          >
            <option value="">{language === "id" ? "Semua jawaban" : "All answers"}</option>
            {filterMisconceptions.map((misconception) => (
              <option key={misconception.id} value={misconception.id}>
                {t(misconception.title, language)}
              </option>
            ))}
          </select>
        </div>
        {answers.length > 0 && answer && (
          <AnswerCaseNavigator
            caseIds={answers.map((item) => item.id)}
            selectedCaseId={selectedAnswerId}
            onSelectCase={onSelectAnswer}
          />
        )}
      </div>

      {answers.length === 0 || !answer ? (
        <div className="px-5 py-8 text-sm text-muted md:px-7">
          {language === "id"
            ? "Belum ada variasi jawaban yang dipetakan ke miskonsepsi ini pada soal tersebut."
            : "No answer variations have been mapped to this misconception for this question."}
        </div>
      ) : (
        <div className="p-5 md:p-7">
          <div className="mb-5 flex items-center gap-2">
            <MessageSquareText size={18} strokeWidth={2} className="text-brand" aria-hidden="true" />
            <p className="text-base font-bold text-navy-deep">
              {answerCaseLabel(getCaseIndex(answer.id), answers.length, language)}
            </p>
          </div>

          <div className="grid gap-6">
            <div className="space-y-6">
              <div>
                {question.type === "multiple_choice" && (
                  <p className="academic-label mb-2">{t(uiText.selectedOptionLabel, language)}</p>
                )}
                <div className="overflow-hidden rounded-lg border border-border">
                  <div className="bg-bg p-5">
                    {question.type === "multiple_choice" && selectedOption ? (
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
                    ) : (
                      <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-navy-deep">{answer.answerText}</pre>
                    )}
                  </div>
                  <AnswerStatusBar status={answer.status} />
                </div>
              </div>

              <section className="rounded-lg bg-neutral p-5">
                <p className="academic-label mb-2">
                  {language === "id" ? "Miskonsepsi pada Jawaban" : "Misconceptions in This Answer"}
                </p>
                {misconceptions.length === 0 ? (
                  <p className="text-sm leading-6 text-muted">
                    {t(answer.status === "correct" ? uiText.emptyCorrectAnswerMisconceptions : uiText.emptyIncorrectAnswerMisconceptions, language)}
                  </p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {misconceptions.map((misconception) => (
                        <MisconceptionChip key={misconception.id} label={t(misconception.title, language)} tone="student" onClick={() => onSelectMisconception(misconception.id)} />
                      ))}
                    </div>
                    {answer.incorrectElements.length > 0 ? (
                      <div className="border-l-2 border-brand/25 pl-3">
                        <p className="text-xs font-semibold text-navy-deep">{language === "id" ? "Alasan" : "Reason"}</p>
                        <ul className="mt-1 space-y-1 text-sm leading-6 text-muted">
                          {answer.incorrectElements.map((element, index) => <li key={index}>{t(element, language)}</li>)}
                        </ul>
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        {language === "id" ? "Jawaban ini menunjukkan pola yang cocok dengan miskonsepsi tersebut." : "This answer shows a pattern that matches the mapped misconception."}
                      </p>
                    )}
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
