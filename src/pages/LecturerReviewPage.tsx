import { useMemo, useState } from "react";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { StatusPill } from "../components/common/StatusPill";
import { AnswerChecksMatrix } from "../components/review/AnswerChecksMatrix";
import { answerCaseLabel } from "../components/review/AnswerCaseNavigator";
import { mockReviewTasks } from "../data/mockReviewTasks";
import { useLanguage } from "../hooks/useLanguage";
import { useQuestions } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { answerStatusLabel } from "../utils/status";
import { t } from "../utils/translation";
import { getPriorityStatus, sortReviewTasks } from "../utils/reviewPriority";
import type { ReviewTask } from "../types";

function priorityLabel(task: ReviewTask, language: "id" | "en") {
  const status = getPriorityStatus(task);
  const labels = {
    conflict: { id: "Konflik reviewer", en: "Reviewer conflict" },
    unreviewed: { id: "Belum direview", en: "Unreviewed" },
    one_reviewer: { id: "Satu reviewer", en: "One reviewer" },
    stable: { id: "Dua reviewer setuju", en: "Two reviewers agree" },
  };
  return labels[status][language];
}

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
  const answerIndex = answers.filter((item) => item.questionId === task?.questionId).findIndex((item) => item.id === answer?.id);
  const selectedOption = question?.options?.find((option) => option.id === answer?.selectedOptionId);

  const relatedMisconceptions = useMemo(() => {
    const ids = new Set<string>([
      ...(question?.questionMisconceptionIds ?? []),
      ...(answer?.studentMisconceptionIds ?? []),
      task?.suggestedMisconceptionId ?? "",
    ]);
    ids.delete("");
    return misconceptions.filter((item) => ids.has(item.id));
  }, [answer?.studentMisconceptionIds, misconceptions, question?.questionMisconceptionIds, task?.suggestedMisconceptionId]);

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
      <header className="mb-8">
        <p className="text-[11px] font-medium uppercase tracking-wide text-brand">
          {language === "id" ? "Validasi label miskonsepsi" : "Misconception label validation"}
        </p>
        <h1 className="mt-2 font-serif-brand text-3xl font-semibold text-navy-deep">Review</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {language === "id"
            ? "Sistem menampilkan item prioritas tertinggi terlebih dahulu: konflik reviewer, item tanpa reviewer, item dengan satu reviewer, lalu item yang sudah stabil."
            : "The system shows the highest-priority item first: reviewer conflicts, unreviewed items, one-reviewer items, then stable items."}
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <main className="rounded-lg border border-border bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{priorityLabel(task, language)}</p>
              <p className="mt-1 text-sm text-muted">
                {language === "id" ? "Jumlah review saat ini" : "Current review count"}: {task.reviewerDecisions.length}
              </p>
            </div>
            <StatusPill tone={getPriorityStatus(task) === "conflict" ? "incorrect" : "muted"} label={priorityLabel(task, language)} />
          </div>

          <section className="mt-5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {language === "id" ? "Soal" : "Question"}
            </p>
            <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-navy-deep">{t(question.prompt, language)}</p>
          </section>

          <section className="mt-6">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
              {answerCaseLabel(answerIndex, language)}
            </p>
            <div className="mt-2 rounded-md bg-bg p-4">
              {selectedOption ? (
                <p className="text-sm text-navy-deep">
                  <span className="font-medium">{selectedOption.label}.</span> {t(selectedOption.text, language)}
                </p>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-xs text-navy-deep">{answer.answerText}</pre>
              )}
            </div>
            <div className="mt-3 flex justify-end">
              <StatusPill tone={answer.status === "correct" ? "correct" : "incorrect"} label={answerStatusLabel(answer.status, language)} />
            </div>
          </section>

          <section className="mt-6">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted">
              {language === "id" ? "Pemeriksaan jawaban" : "Answer checks"}
            </p>
            <AnswerChecksMatrix checks={answer.checks} />
          </section>

          <section className="mt-6 rounded-lg border border-brand/20 bg-brand-soft/60 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand">
              {language === "id" ? "Label yang divalidasi" : "Label to validate"}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-navy-deep">{t(suggestedMisconception.title, language)}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{task.explanation}</p>
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
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium ${
                decision === "agree" ? "border-correct bg-correct-bg text-correct" : "border-border text-muted"
              }`}
            >
              {language === "id" ? "Setuju" : "Agree"}
            </button>
            <button
              type="button"
              onClick={() => setDecision("disagree")}
              aria-pressed={decision === "disagree"}
              className={`cursor-pointer rounded-md border px-3 py-2 text-sm font-medium ${
                decision === "disagree" ? "border-incorrect bg-incorrect-bg text-incorrect" : "border-border text-muted"
              }`}
            >
              {language === "id" ? "Tidak Setuju" : "Disagree"}
            </button>
          </div>

          {decision === "disagree" && (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-navy-deep" htmlFor="replacement-misconception">
                {language === "id" ? "Miskonsepsi yang lebih tepat" : "More appropriate misconception"}
              </label>
              <select
                id="replacement-misconception"
                value={selectedMisconceptionId}
                onChange={(event) => setSelectedMisconceptionId(event.target.value)}
                className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-navy-deep focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="">{language === "id" ? "Pilih label" : "Select label"}</option>
                {relatedMisconceptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {t(item.title, language)}
                  </option>
                ))}
              </select>
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
