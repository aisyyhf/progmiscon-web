import { useMemo, useState } from "react";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { answerCaseLabel } from "../components/review/AnswerCaseNavigator";
import { AnswerStatusBar } from "../components/review/AnswerStatusBar";
import { MisconceptionPicker } from "../components/review/MisconceptionPicker";
import { mockReviewTasks } from "../data/mockReviewTasks";
import { useLanguage } from "../hooks/useLanguage";
import { useQuestions } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { t } from "../utils/translation";
import { prioritizeMisconceptions, sortReviewTasks } from "../utils/reviewPriority";

export function LecturerReviewPage() {
  const { language } = useLanguage();
  const { questions } = useQuestions();
  const { answers } = useAllStudentAnswers();
  const { misconceptions } = useMisconceptions();
  const [remainingTasks, setRemainingTasks] = useState(() => sortReviewTasks(mockReviewTasks));
  const [decision, setDecision] = useState<"agree" | "disagree">("agree");
  const [selectedMisconceptionId, setSelectedMisconceptionId] = useState("");
  const [note, setNote] = useState("");

  const task = remainingTasks[0];
  const question = questions.find((item) => item.id === task?.questionId);
  const answer = answers.find((item) => item.id === task?.answerCaseId);
  const suggestedMisconception = misconceptions.find((item) => item.id === task?.suggestedMisconceptionId);
  const questionAnswers = answers.filter((item) => item.questionId === task?.questionId);
  const answerIndex = questionAnswers.findIndex((item) => item.id === answer?.id);
  const selectedOption = question?.options?.find((option) => option.id === answer?.selectedOptionId);

  const recommendedMisconceptions = useMemo(
    () =>
      prioritizeMisconceptions(misconceptions, [
        ...(question?.questionMisconceptionIds ?? []),
        ...(answer?.studentMisconceptionIds ?? []),
        task?.suggestedMisconceptionId ?? "",
      ]),
    [
      answer?.studentMisconceptionIds,
      misconceptions,
      question?.questionMisconceptionIds,
      task?.suggestedMisconceptionId,
    ],
  );

  if (!task || !question || !answer || !suggestedMisconception) {
    return <EmptyState message={language === "id" ? "Tidak ada item review tersisa." : "No review items remaining."} />;
  }

  const handleSubmit = () => {
    setRemainingTasks((current) => current.slice(1));
    setDecision("agree");
    setSelectedMisconceptionId("");
    setNote("");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="font-serif-brand text-3xl font-semibold text-navy-deep">Review</h1>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <main className="rounded-lg border border-border bg-white p-6">
          <section>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {language === "id" ? "Soal" : "Question"}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-navy-deep">{t(question.prompt, language)}</p>
          </section>

          <section className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {answerCaseLabel(answerIndex, questionAnswers.length, language)}
            </p>
            <div className="mt-2 overflow-hidden rounded-md border border-border">
              <div className="bg-bg p-4">
                {selectedOption ? (
                  <p className="text-sm text-navy-deep">
                    <span className="font-medium">{selectedOption.label}.</span> {t(selectedOption.text, language)}
                  </p>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs text-navy-deep">{answer.answerText}</pre>
                )}
              </div>
              <AnswerStatusBar status={answer.status} />
            </div>
          </section>

          <section className="mt-6 border-l-4 border-brand bg-brand-soft/50 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-brand">
              {language === "id" ? "Miskonsepsi saat ini" : "Current misconception"}
            </p>
            <h2 className="mt-1 text-xl font-semibold leading-7 text-navy-deep">
              {t(suggestedMisconception.title, language)}
            </h2>
            <div className="mt-4 border-t border-brand/15 pt-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
                {language === "id" ? "Alasan" : "Reason"}
              </p>
              <p className="mt-1 text-sm leading-6 text-navy-deep/80">{t(task.explanation, language)}</p>
            </div>
          </section>
        </main>

        <aside className="rounded-lg border border-border bg-white p-6">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {language === "id" ? "Keputusan dosen" : "Lecturer decision"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDecision("agree")}
              aria-pressed={decision === "agree"}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                decision === "agree"
                  ? "border-correct-border bg-correct-bg text-correct"
                  : "border-border bg-white text-muted hover:border-correct-border hover:text-navy-deep"
              }`}
            >
              {language === "id" ? "Setuju" : "Agree"}
            </button>
            <button
              type="button"
              onClick={() => setDecision("disagree")}
              aria-pressed={decision === "disagree"}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold ${
                decision === "disagree"
                  ? "border-incorrect-border bg-incorrect-bg text-incorrect"
                  : "border-border bg-white text-muted hover:border-incorrect-border hover:text-navy-deep"
              }`}
            >
              {language === "id" ? "Tidak Setuju" : "Disagree"}
            </button>
          </div>

          {decision === "disagree" && (
            <div className="mt-4 space-y-3">
              <MisconceptionPicker
                misconceptions={misconceptions}
                recommended={recommendedMisconceptions}
                value={selectedMisconceptionId}
                onChange={setSelectedMisconceptionId}
              />
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={language === "id" ? "Catatan opsional" : "Optional note"}
                className="min-h-24 w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-navy-deep placeholder:text-muted/70 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          )}

          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={decision === "disagree" && !selectedMisconceptionId}
            className="mt-5 w-full justify-center"
          >
            {language === "id" ? "Kirim Review" : "Submit Review"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
