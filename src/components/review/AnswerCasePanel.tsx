import type { Concept, Question, StudentAnswer } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { findConceptByText } from "../../utils/concepts";
import { answerStatusLabel } from "../../utils/status";
import { cn } from "../../utils/cn";
import { Chip } from "../common/Chip";
import { ConceptChip } from "../concept/ConceptChip";
import { StatusPill } from "../common/StatusPill";
import { MisconceptionChip } from "../misconception/MisconceptionChip";
import { AnswerChecksMatrix } from "./AnswerChecksMatrix";
import { AnswerCaseNavigator, answerCaseLabel } from "./AnswerCaseNavigator";
import { AnswerVisualization } from "./AnswerVisualization";

export function AnswerCasePanel({
  question,
  answers,
  selectedAnswerId,
  onSelectAnswer,
  filterMisconceptionId,
  onFilterMisconception,
  availableMisconceptionIds,
  concepts,
  onSelectConcept,
  onSelectMisconception,
}: {
  question: Question;
  answers: StudentAnswer[];
  selectedAnswerId: string;
  onSelectAnswer: (answerId: string) => void;
  filterMisconceptionId: string | undefined;
  onFilterMisconception: (misconceptionId: string | undefined) => void;
  availableMisconceptionIds: string[];
  concepts: Concept[];
  onSelectConcept: (conceptId: string) => void;
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
      <div className="border-b border-border pb-5">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted">
          {language === "id" ? "Berdasarkan Miskonsepsi" : "By Misconception"}
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onFilterMisconception(undefined)}
            aria-pressed={!filterMisconceptionId}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
              !filterMisconceptionId
                ? "border-brand bg-brand text-white"
                : "border-border bg-white text-muted hover:border-brand/50 hover:text-navy-deep",
            )}
          >
            {language === "id" ? "Semua Jawaban" : "All Answers"}
          </button>
          {filterMisconceptions.map((misconception) => (
            <button
              key={misconception.id}
              type="button"
              onClick={() => onFilterMisconception(misconception.id)}
              aria-pressed={filterMisconceptionId === misconception.id}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                filterMisconceptionId === misconception.id
                  ? "border-brand bg-brand text-white"
                  : "border-border bg-white text-muted hover:border-brand/50 hover:text-navy-deep",
              )}
            >
              {t(misconception.title, language)}
            </button>
          ))}
        </div>
      </div>

      {answers.length === 0 || !answer ? (
        <div className="pt-5 text-sm text-muted">
          {language === "id"
            ? "Tidak ada variasi jawaban dengan miskonsepsi ini."
            : "No answer variations match this misconception."}
        </div>
      ) : (
        <div className="space-y-6 pt-5">
          <AnswerCaseNavigator
            caseIds={answers.map((item) => item.id)}
            selectedCaseId={selectedAnswerId}
            onSelectCase={onSelectAnswer}
            getCaseIndex={getCaseIndex}
          />

          <div className="flex items-center justify-between gap-4">
            <p className="text-sm font-medium text-navy-deep">
              {answerCaseLabel(getCaseIndex(answer.id), language)}
            </p>
            <StatusPill tone={answer.status === "correct" ? "correct" : "incorrect"} label={answerStatusLabel(answer.status, language)} />
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
              {question.type === "multiple_choice"
                ? t(uiText.selectedOptionLabel, language)
                : t(uiText.anonymousAnswerLabel, language)}
            </p>
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
              <pre className="whitespace-pre-wrap rounded-md bg-bg px-3 py-2 font-mono text-xs text-navy-deep">
                {answer.answerText}
              </pre>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              {language === "id" ? "Pemeriksaan Jawaban" : "Answer Checks"}
            </p>
            <AnswerChecksMatrix checks={answer.checks} />
          </div>

          {answer.masteredConcepts.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t(uiText.masteredConcepts, language)}
              </p>
              <div className="flex flex-wrap gap-2">
                {answer.masteredConcepts.map((concept) => {
                  const resolvedConcept = findConceptByText(concepts, concept);
                  return (
                    <ConceptChip
                      key={resolvedConcept?.id ?? t(concept, language)}
                      label={t(concept, language)}
                      onClick={() => onSelectConcept(resolvedConcept?.id ?? question.categoryId)}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {answer.incorrectElements.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
                {t(uiText.incorrectElements, language)}
              </p>
              <div className="flex flex-wrap gap-2">
                {answer.incorrectElements.map((element, index) => (
                  <Chip key={index} className="border-incorrect/30 bg-incorrect-bg text-incorrect">
                    {t(element, language)}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          <div className="border-t border-border pt-5">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              {language === "id" ? "Miskonsepsi pada Variasi Jawaban" : "Misconceptions in This Answer Variation"}
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
                <p className="text-sm leading-6 text-muted">
                  {language === "id"
                    ? "Variasi jawaban ini menunjukkan pola yang cocok dengan miskonsepsi tersebut."
                    : "This answer variation shows a pattern that matches the mapped misconception."}
                </p>
              </div>
            )}
          </div>

          <AnswerVisualization />
        </div>
      )}
    </div>
  );
}
