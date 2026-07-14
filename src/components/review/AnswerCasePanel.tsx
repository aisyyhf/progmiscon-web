import type { Question, StudentAnswer } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { MisconceptionChip } from "../misconception/MisconceptionChip";
import { AnswerCaseNavigator, answerCaseLabel } from "./AnswerCaseNavigator";
import { AnswerStatusBar } from "./AnswerStatusBar";
import { AnswerVisualization } from "./AnswerVisualization";

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
    <div className="rounded-lg border border-border bg-white p-6">
      <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full sm:max-w-xs">
          <label htmlFor="answer-misconception-filter" className="block text-[11px] font-medium text-muted">
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
            className="mt-1 h-9 w-full cursor-pointer rounded-md border border-border bg-bg px-2.5 text-sm text-navy-deep transition-colors hover:border-navy/35 hover:bg-white focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
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
        <div className="pt-5 text-sm text-muted">
          {language === "id"
            ? "Belum ada variasi jawaban yang dipetakan ke miskonsepsi ini pada soal tersebut."
            : "No answer variations have been mapped to this misconception for this question."}
        </div>
      ) : (
        <div className="space-y-6 pt-4">
          <p className="text-sm font-medium text-navy-deep">
            {answerCaseLabel(getCaseIndex(answer.id), answers.length, language)}
          </p>

          <div>
            {question.type === "multiple_choice" && (
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t(uiText.selectedOptionLabel, language)}
              </p>
            )}
            <div className="overflow-hidden rounded-md border border-border">
              <div className="bg-bg p-4">
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
                          className="cursor-pointer font-medium text-brand underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                        >
                          {t(selectedOptionMisconception.title, language)}
                        </button>
                        .
                      </p>
                    )}
                  </div>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs text-navy-deep">
                    {answer.answerText}
                  </pre>
                )}
              </div>
              <AnswerStatusBar status={answer.status} />
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              {language === "id" ? "Miskonsepsi pada Jawaban" : "Misconceptions in This Answer"}
            </p>
            {misconceptions.length === 0 ? (
              <p className="text-sm text-muted">
                {t(
                  answer.status === "correct"
                    ? uiText.emptyCorrectAnswerMisconceptions
                    : uiText.emptyIncorrectAnswerMisconceptions,
                  language,
                )}
              </p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {misconceptions.map((misconception) => (
                    <MisconceptionChip
                      key={misconception.id}
                      label={t(misconception.title, language)}
                      tone="student"
                      onClick={() => onSelectMisconception(misconception.id)}
                    />
                  ))}
                </div>
                {answer.incorrectElements.length > 0 ? (
                  <div className="border-l-2 border-border pl-3">
                    <p className="text-xs font-medium text-navy-deep">
                      {language === "id" ? "Alasan" : "Reason"}
                    </p>
                    <ul className="mt-1 space-y-1 text-sm leading-6 text-muted">
                      {answer.incorrectElements.map((element, index) => (
                        <li key={index}>{t(element, language)}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm leading-6 text-muted">
                    {language === "id"
                      ? "Jawaban ini menunjukkan pola yang cocok dengan miskonsepsi tersebut."
                      : "This answer shows a pattern that matches the mapped misconception."}
                  </p>
                )}
              </div>
            )}
          </div>

          <AnswerVisualization key={answer.id} />
        </div>
      )}
    </div>
  );
}
