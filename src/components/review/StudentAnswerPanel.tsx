import type { Concept, Question, Student, StudentAnswer } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { useMisconceptionsByIds } from "../../hooks/useMisconceptions";
import { t, uiText } from "../../utils/translation";
import { findConceptByText } from "../../utils/concepts";
import { answerStatusLabel } from "../../utils/status";
import { Chip } from "../common/Chip";
import { ConceptChip } from "../concept/ConceptChip";
import { StatusPill } from "../common/StatusPill";
import { MisconceptionChip } from "../misconception/MisconceptionChip";
import { AnswerChecksMatrix } from "./AnswerChecksMatrix";
import { StudentNavigator } from "./StudentNavigator";
import { EmptyState } from "../common/EmptyState";

export function StudentAnswerPanel({
  question,
  allStudents,
  selectedStudentId,
  onSelectStudent,
  studentIds,
  answer,
  concepts,
  onSelectConcept,
  onSelectMisconception,
}: {
  question: Question;
  allStudents: Student[];
  selectedStudentId: string;
  onSelectStudent: (studentId: string) => void;
  studentIds: string[];
  answer: StudentAnswer | undefined;
  concepts: Concept[];
  onSelectConcept: (conceptId: string) => void;
  onSelectMisconception: (misconceptionId: string) => void;
}) {
  const { language } = useLanguage();
  const { misconceptions } = useMisconceptionsByIds(answer?.studentMisconceptionIds ?? []);
  const selectedStudent = allStudents.find((s) => s.id === selectedStudentId);

  const selectedOption =
    question.type === "multiple_choice"
      ? question.options?.find((option) => option.id === answer?.selectedOptionId)
      : undefined;

  return (
    <div className="rounded-lg border border-border bg-white p-6">
      <StudentNavigator
        allStudents={allStudents}
        selectedStudentId={selectedStudentId}
        onSelectStudent={onSelectStudent}
        filteredStudentIds={studentIds}
      />

      <div className="mt-6 border-t border-border pt-5">
        {!answer ? (
          <EmptyState message={t(uiText.noQuestions, language)} />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-navy-deep">
                {t(uiText.student, language)}{" "}
                <span className="font-medium">{selectedStudent?.displayName}</span>
              </p>
              <StatusPill
                tone={answer.status === "correct" ? "correct" : "incorrect"}
                label={answerStatusLabel(answer.status, language)}
                symbol={answer.status === "correct" ? "✓" : "✕"}
              />
            </div>

            <div>
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                {question.type === "multiple_choice"
                  ? t(uiText.selectedOptionLabel, language)
                  : t(uiText.studentAnswerLabel, language)}
              </p>
              {question.type === "multiple_choice" && selectedOption ? (
                <p className="text-sm text-navy-deep">
                  <span className="font-medium">{selectedOption.label}.</span>{" "}
                  {t(selectedOption.text, language)}
                </p>
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
                {t(uiText.studentMisconceptions, language)}
              </p>
              {misconceptions.length === 0 ? (
                <p className="text-sm text-muted">
                  {t(
                    answer.status === "correct"
                      ? uiText.emptyCorrectStudentMisconceptions
                      : uiText.emptyIncorrectStudentMisconceptions,
                    language,
                  )}
                </p>
              ) : (
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
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
