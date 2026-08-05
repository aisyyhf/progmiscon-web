import type {
  Language,
  Misconception,
  Question,
  Student,
  StudentAnswer,
} from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { getQuestionReference } from "../../utils/questionReference";
import { t } from "../../utils/translation";
import { EmptyState } from "../common/EmptyState";
import {
  ParentQuestionBackAction,
  QuestionContextAccordion,
  SiblingNavigator,
} from "./AnswerWorkspaceNavigation";
import { MisconceptionReasonCards } from "./MisconceptionReasonCards";
import { PseudocodeBlock } from "./PseudocodeBlock";

function unavailable(language: Language, indonesian: string, english: string) {
  return language === "id" ? indonesian : english;
}

export function PsAnswerEvidenceWorkspace({
  question,
  answers,
  activeAnswerId,
  students,
  misconceptions,
  error,
  onSelectAnswer,
  onBackToQuestion,
}: {
  question: Question;
  answers: StudentAnswer[];
  activeAnswerId?: string;
  students: Student[];
  misconceptions: Misconception[];
  error?: string;
  onSelectAnswer: (answerId: string) => void;
  onBackToQuestion: () => void;
}) {
  const { language } = useLanguage();
  const activeAnswer =
    answers.find((answer) => answer.id === activeAnswerId) ?? answers[0];
  const activeIndex = activeAnswer
    ? answers.findIndex((answer) => answer.id === activeAnswer.id)
    : -1;
  const student = activeAnswer
    ? students.find((item) => item.id === activeAnswer.studentId)
    : undefined;
  const studentName = student?.displayName.trim();
  const studentIdentifier =
    activeAnswer && !activeAnswer.studentId.startsWith("anonymous-")
      ? activeAnswer.studentId
      : "";
  const linkedMisconceptions = activeAnswer
    ? activeAnswer.studentMisconceptionIds
        .map((id) => misconceptions.find((item) => item.id === id))
        .filter((item): item is Misconception => Boolean(item))
    : [];
  const generalReasons = activeAnswer?.explanation &&
    t(activeAnswer.explanation, language).trim()
    ? [activeAnswer.explanation]
    : (activeAnswer?.incorrectElements ?? []);
  const questionReference = getQuestionReference(question);

  return (
    <div className="scroll-reveal review-folder-content">
      <section className="review-folder-primary overflow-hidden rounded-lg border border-border bg-white">
        <div className="px-5 py-5 md:px-7 md:py-6">
          <ParentQuestionBackAction
            language={language}
            onClick={onBackToQuestion}
          />

          <header className="flex flex-col gap-4 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-bold text-navy-deep">
                {activeAnswer
                  ? studentName ||
                    unavailable(
                      language,
                      "Nama mahasiswa belum tersedia",
                      "Student name is not available yet",
                    )
                  : language === "id"
                    ? "Evidence Jawaban PS"
                    : "PS Answer Evidence"}
              </p>
              {activeAnswer && (
                <p className="mt-1 text-xs text-muted">
                  {studentIdentifier ||
                    unavailable(
                      language,
                      "Identitas mahasiswa belum tersedia",
                      "Student identifier is not available yet",
                    )}
                </p>
              )}
            </div>

            {activeAnswer && (
              <div className="flex min-w-0 flex-col items-start gap-2 sm:items-end">
                <p className="max-w-full break-all text-xs tabular-nums text-muted">
                  <span className="font-mono">{activeAnswer.id}</span>
                  <span aria-hidden="true"> · </span>
                  {question.week
                    ? `${language === "id" ? "Minggu" : "Week"} ${question.week}`
                    : unavailable(
                        language,
                        "Minggu belum tersedia",
                        "Week is not available yet",
                      )}
                </p>
                <SiblingNavigator
                  kind="evidence"
                  index={activeIndex}
                  total={answers.length}
                  language={language}
                  onPrevious={() =>
                    activeIndex > 0 && onSelectAnswer(answers[activeIndex - 1].id)
                  }
                  onNext={() =>
                    activeIndex < answers.length - 1 &&
                    onSelectAnswer(answers[activeIndex + 1].id)
                  }
                />
              </div>
            )}
          </header>

          <QuestionContextAccordion
            id={`ps-question-context-${question.id}`}
            label={language === "id" ? "Konteks soal PS" : "PS question context"}
          >
            <p className="whitespace-pre-wrap text-sm leading-7 text-navy-deep">
              {t(question.prompt, language)}
            </p>
            {questionReference.pseudocode && (
              <div className="mt-4 overflow-hidden rounded-md">
                <PseudocodeBlock code={questionReference.pseudocode} />
              </div>
            )}
          </QuestionContextAccordion>
        </div>

        {error ? (
          <p
            role="alert"
            className="mx-5 mb-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect md:mx-7 md:mb-7"
          >
            {error}
          </p>
        ) : !activeAnswer ? (
          <div className="border-t border-border p-5 md:p-7">
            <EmptyState
              message={unavailable(
                language,
                "Belum ada evidence jawaban untuk soal ini",
                "There is no answer evidence for this question yet",
              )}
            />
          </div>
        ) : (
          <div className="grid gap-6 border-t border-border p-5 md:p-7">
            <section aria-labelledby="evidence-answer-title">
              <h3 id="evidence-answer-title" className="academic-label">
                {language === "id" ? "Jawaban mahasiswa" : "Student answer"}
              </h3>
              <pre className="mt-3 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-navy-deep p-4 font-mono text-xs leading-6 text-white">
                {activeAnswer.answerText ||
                  unavailable(
                    language,
                    "Jawaban mahasiswa belum tersedia",
                    "Student answer is not available yet",
                  )}
              </pre>
            </section>

            <div className="border-t border-border pt-5">
              <MisconceptionReasonCards
                misconceptions={linkedMisconceptions}
                generalReasons={generalReasons}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
