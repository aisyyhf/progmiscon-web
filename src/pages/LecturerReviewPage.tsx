import { useEffect, useState } from "react";
import {
  Code2,
  FileQuestion,
  History,
  Send,
} from "lucide-react";
import { AnswerStatusBar } from "../components/review/AnswerStatusBar";
import { Button } from "../components/common/Button";
import { EmptyState } from "../components/common/EmptyState";
import { MisconceptionPicker } from "../components/review/MisconceptionPicker";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";
import { useQuestions } from "../hooks/useQuestions";
import { useAllStudentAnswers } from "../hooks/useStudentAnswers";
import { useReviewTasks } from "../hooks/useReviewTasks";
import { useMisconceptions } from "../hooks/useMisconceptions";
import type {
  AnswerReviewValues,
  Language,
  Misconception,
  Question,
  QuestionReviewValues,
  ReviewTask,
  StudentAnswer,
} from "../types";
import { cn } from "../utils/cn";
import { getQuestionReference } from "../utils/questionReference";
import { prioritizeMisconceptions, sortReviewTasks } from "../utils/reviewPriority";
import { t } from "../utils/translation";
import {
  getReviewProgress,
  saveAnswerReview,
  saveQuestionReview,
} from "../services/reviewPersistenceRepository";
import { Link } from "react-router-dom";

type ReviewMode = "question" | "answer";

function PresenceToggle({
  value,
  onChange,
  language,
  label,
  yesDisabled = false,
}: {
  value: boolean | null;
  onChange: (value: boolean) => void;
  language: Language;
  label: string;
  yesDisabled?: boolean;
}) {
  const options = [
    { value: false, label: language === "id" ? "Tidak ada" : "None" },
    { value: true, label: language === "id" ? "Ada" : "Yes" },
  ] as const;

  return (
    <div className="mt-3 grid grid-cols-2 gap-1 rounded-md border border-border bg-neutral p-1" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          disabled={option.value && yesDisabled}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-9 cursor-pointer rounded px-3 py-2 text-xs font-semibold transition-[background-color,color,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed disabled:opacity-40",
            value === option.value
              ? option.value
                ? "bg-white text-brand shadow-[0_2px_8px_rgba(30,41,59,0.08)]"
                : "bg-white text-navy-deep shadow-[0_2px_8px_rgba(30,41,59,0.08)]"
              : "text-muted hover:bg-white/60 hover:text-navy-deep",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ReviewCompletedState({
  mode,
  language,
}: {
  mode: ReviewMode;
  language: Language;
}) {
  const isQuestion = mode === "question";

  return (
    <section className="rounded-xl border border-border bg-white px-6 py-10 text-center shadow-[0_8px_28px_rgba(30,41,59,0.05)]">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">
        <History
          size={22}
          strokeWidth={2}
          aria-hidden="true"
        />
      </span>

      <h2 className="mt-4 text-lg font-bold text-navy-deep">
        {language === "id"
          ? `Tidak ada validasi ${
              isQuestion ? "soal" : "jawaban"
            } yang tersedia saat ini`
          : `No ${
              isQuestion ? "question" : "answer"
            } validations are currently available`}
      </h2>

      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
        {language === "id"
          ? `Semua ${
              isQuestion ? "soal" : "jawaban"
            } yang tersedia untuk akun Anda telah ditinjau. Hasil review dapat dilihat melalui Riwayat Review Saya.`
          : `All available ${
              isQuestion ? "questions" : "answers"
            } for your account have been reviewed. Your submissions are available in My Review History.`}
      </p>

      <Link
        to="/review/riwayat"
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <History
          size={16}
          strokeWidth={2}
          aria-hidden="true"
        />
        {language === "id"
          ? "Lihat Riwayat Review Saya"
          : "View My Review History"}
      </Link>
    </section>
  );
}

export function LecturerReviewPage() {
  const { language } = useLanguage();
  const { user } = useLecturerAuth();
  const { questions, loading: questionsLoading } = useQuestions();
  const { answers, loading: answersLoading } = useAllStudentAnswers();
  const { misconceptions, loading: misconceptionsLoading } = useMisconceptions();
  const { tasks: answerTasks, loading: reviewTasksLoading } = useReviewTasks();
  const [mode, setMode] = useState<ReviewMode>("question");
  const [reviewedQuestionIds, setReviewedQuestionIds] = useState<string[]>([]);
  const [reviewedAnswerIds, setReviewedAnswerIds] = useState<string[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState("");

  useEffect(() => {
    let active = true;

    const loadProgress = async () => {
      if (!user) {
        if (active) {
          setReviewedQuestionIds([]);
          setReviewedAnswerIds([]);
          setProgressLoading(false);
        }
        return;
      }

      setProgressLoading(true);
      setProgressError("");

      try {
        const progress = await getReviewProgress(user.id);
        if (!active) return;
        setReviewedQuestionIds(progress.questionIds);
        setReviewedAnswerIds(progress.answerIds);
      } catch (error) {
        if (!active) return;
        console.error("[Progmiscon] Progres review gagal dimuat", error);
        setProgressError(
          error instanceof Error
            ? error.message
            : "Progres review belum dapat dimuat.",
        );
      } finally {
        if (active) setProgressLoading(false);
      }
    };

    void loadProgress();

    return () => {
      active = false;
    };
  }, [user]);

  const questionTask = questions.find(
    (question) => !reviewedQuestionIds.includes(question.id),
  );
  const answerTask = sortReviewTasks(answerTasks).find(
    (task) => !reviewedAnswerIds.includes(task.answerCaseId),
  );
  const answerQuestion = questions.find(
    (question) => question.id === answerTask?.questionId,
  );
  const answer = answers.find(
    (item) => item.id === answerTask?.answerCaseId,
  );
  const suggestedMisconception = misconceptions.find(
    (item) => item.id === answerTask?.suggestedMisconceptionId,
  );
  const loading =
    questionsLoading ||
    answersLoading ||
    misconceptionsLoading ||
    reviewTasksLoading ||
    progressLoading;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="page-title">Review</h1>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
          {language === "id"
            ? "Validasi hubungan antara soal, jawaban mahasiswa, dan miskonsepsi."
            : "Validate the relationship between questions, student answers, and misconceptions."}
        </p>
      </header>

      {progressError && (
        <p
          role="alert"
          className="mb-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect"
        >
          {progressError}
        </p>
      )}

      <div
        className="mb-6 grid w-full grid-cols-2 gap-1 rounded-lg border border-border bg-neutral p-1 sm:w-fit"
        role="tablist"
        aria-label={language === "id" ? "Jenis validasi" : "Validation type"}
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "question"}
          aria-controls="question-validation-panel"
          onClick={() => setMode("question")}
          className={cn(
            "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-[background-color,color,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-w-44",
            mode === "question"
              ? "bg-white text-brand shadow-[0_2px_8px_rgba(30,41,59,0.08)]"
              : "text-muted hover:bg-white/60 hover:text-navy-deep",
          )}
        >
          <FileQuestion size={17} strokeWidth={2} aria-hidden="true" />
          <span>{language === "id" ? "Validasi Soal" : "Question Validation"}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={mode === "answer"}
          aria-controls="answer-validation-panel"
          onClick={() => setMode("answer")}
          className={cn(
            "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-[background-color,color,box-shadow] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-w-44",
            mode === "answer"
              ? "bg-white text-brand shadow-[0_2px_8px_rgba(30,41,59,0.08)]"
              : "text-muted hover:bg-white/60 hover:text-navy-deep",
          )}
        >
          <Code2 size={17} strokeWidth={2} aria-hidden="true" />
          <span>{language === "id" ? "Validasi Jawaban" : "Answer Validation"}</span>
        </button>
      </div>

      <section id="question-validation-panel" role="tabpanel" hidden={mode !== "question"}>
        {loading ? (
          <EmptyState message={language === "id" ? "Memuat tugas validasi..." : "Loading validation tasks..."} />
        ) : questionTask ? (
          <QuestionValidationWorkspace
            key={questionTask.id}
            question={questionTask}
            misconceptions={misconceptions}
            onSubmit={async (values) => {
              if (!user) throw new Error("Sesi dosen tidak ditemukan.");
              await saveQuestionReview(user.id, questionTask.id, values);
              setReviewedQuestionIds((current) =>
                current.includes(questionTask.id)
                  ? current
                  : [...current, questionTask.id],
              );
            }}
          />
        ) : (
          <ReviewCompletedState
            mode="question"
            language={language}
          />
        )}
      </section>

      <section id="answer-validation-panel" role="tabpanel" hidden={mode !== "answer"}>
        {loading ? (
          <EmptyState message={language === "id" ? "Memuat tugas validasi..." : "Loading validation tasks..."} />
        ) : answerTask && answerQuestion && answer && suggestedMisconception ? (
          <AnswerValidationWorkspace
            key={answerTask.id}
            task={answerTask}
            question={answerQuestion}
            answer={answer}
            misconceptions={misconceptions}
            onSubmit={async (values) => {
              if (!user) throw new Error("Sesi dosen tidak ditemukan.");
              await saveAnswerReview(
                user.id,
                answer.id,
                answerQuestion.id,
                values,
              );
              setReviewedAnswerIds((current) =>
                current.includes(answer.id)
                  ? current
                  : [...current, answer.id],
              );
            }}
          />
        ) : (
          <ReviewCompletedState
            mode="answer"
            language={language}
          />
        )}
      </section>
    </div>
  );
}

function QuestionValidationWorkspace({
  question,
  misconceptions,
  onSubmit,
}: {
  question: Question;
  misconceptions: Misconception[];
  onSubmit: (values: QuestionReviewValues) => Promise<void>;
}) {
  const { language } = useLanguage();
  const reference = getQuestionReference(question);
  const recommended = prioritizeMisconceptions(misconceptions, question.questionMisconceptionIds);
  const currentMisconceptionIds = new Set(recommended.map((item) => item.id));
  const addableMisconceptions = misconceptions.filter((item) => !currentMisconceptionIds.has(item.id));
  const similarMisconceptions = prioritizeMisconceptions(
    addableMisconceptions,
    recommended.flatMap((item) => item.relatedMisconceptionIds),
  );
  const [hasIncorrectMisconceptions, setHasIncorrectMisconceptions] = useState<boolean | null>(null);
  const [removedMisconceptionIds, setRemovedMisconceptionIds] = useState<string[]>([]);
  const [removalReason, setRemovalReason] = useState("");
  const [hasAdditionalMisconceptions, setHasAdditionalMisconceptions] = useState<boolean | null>(null);
  const [additionalMisconceptionIds, setAdditionalMisconceptionIds] = useState<string[]>([]);
  const [additionReason, setAdditionReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const canSubmit =
    hasIncorrectMisconceptions !== null &&
    hasAdditionalMisconceptions !== null &&
    (!hasIncorrectMisconceptions || (removedMisconceptionIds.length > 0 && removalReason.trim().length > 0)) &&
    (!hasAdditionalMisconceptions || (additionalMisconceptionIds.length > 0 && additionReason.trim().length > 0));

  const handleSubmit = async () => {
    if (
      !canSubmit ||
      submitting ||
      hasIncorrectMisconceptions === null ||
      hasAdditionalMisconceptions === null
    ) {
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      await onSubmit({
        hasIncorrectMisconceptions,
        removedMisconceptionIds: hasIncorrectMisconceptions
          ? removedMisconceptionIds
          : [],
        removalReason: hasIncorrectMisconceptions
          ? removalReason.trim()
          : null,
        hasAdditionalMisconceptions,
        additionalMisconceptionIds: hasAdditionalMisconceptions
          ? additionalMisconceptionIds
          : [],
        additionReason: hasAdditionalMisconceptions
          ? additionReason.trim()
          : null,
        note: note.trim() || null,
      });
    } catch (error) {
      console.error("[Progmiscon] Validasi soal gagal disimpan", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Validasi soal belum dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scroll-reveal">
      <section className="mb-4 flex items-center gap-4 rounded-lg bg-white px-5 py-4 shadow-[0_8px_24px_rgba(30,41,59,0.05)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <FileQuestion size={20} strokeWidth={2} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold text-brand">{language === "id" ? "VALIDASI SOAL" : "QUESTION VALIDATION"}</p>
          <p className="mt-1 text-sm text-muted">
            {language === "id"
              ? "Menilai kemungkinan miskonsepsi pada soal"
              : "Assessing possible misconceptions in a question"}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <article className="min-w-0 overflow-hidden rounded-lg bg-white p-5 shadow-[0_8px_28px_rgba(30,41,59,0.06)] md:p-7">
          <section className="rounded-lg bg-neutral p-5">
            <p className="academic-label">{language === "id" ? "Soal" : "Question"}</p>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-xl font-bold leading-8 text-navy-deep">
              {t(question.prompt, language)}
            </p>
          </section>

          {question.options && (
            <section className="mt-6">
              <p className="academic-label mb-2">{language === "id" ? "Pilihan jawaban" : "Answer options"}</p>
              <ul className="space-y-2">
                {question.options.map((option) => (
                  <li
                    key={option.id}
                    className={cn(
                      "flex items-start gap-2 rounded-md border px-4 py-3 text-sm",
                      option.isCorrect ? "border-correct-border bg-correct-bg/55" : "border-border bg-white",
                    )}
                  >
                    <span className="font-semibold text-navy-deep">{option.label}.</span>
                    <span className="text-navy-deep">{t(option.text, language)}</span>
                    {option.isCorrect && (
                      <span className="ml-auto shrink-0 text-xs font-semibold text-correct">
                        {language === "id" ? "Jawaban acuan" : "Reference answer"}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {reference.pseudocode && (
            <section className="mt-6 border-t border-border pt-5">
              <p className="academic-label mb-2">{language === "id" ? "Pseudocode acuan" : "Reference pseudocode"}</p>
              <pre className="whitespace-pre-wrap rounded-md border border-border bg-neutral px-4 py-3 font-mono text-xs leading-6 text-navy-deep">
                {reference.pseudocode}
              </pre>
            </section>
          )}

          <section className="mt-6 border-t border-border pt-5">
            <p className="academic-label mb-2">{language === "id" ? "Konsep yang diuji" : "Assessed concepts"}</p>
            <div className="flex flex-wrap gap-2">
              {question.expectedConcepts.map((concept) => (
                <span key={t(concept, language)} className="rounded-md bg-neutral px-2.5 py-1.5 text-xs font-medium text-navy-deep">
                  {t(concept, language)}
                </span>
              ))}
            </div>
          </section>
        </article>

        <aside className="rounded-lg bg-white p-5 shadow-[0_8px_28px_rgba(30,41,59,0.06)] md:p-6 lg:sticky lg:top-24">
          <p className="text-base font-bold text-navy-deep">
            {language === "id" ? "Form validasi soal" : "Question validation form"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {language === "id"
              ? "Tinjau daftar kemungkinan miskonsepsi pada soal ini."
              : "Review the possible misconceptions listed for this question."}
          </p>

          <div className="mt-6 space-y-6">
            <section aria-labelledby="remove-misconception-question">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p id="remove-misconception-question" className="text-sm font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi yang tidak seharusnya dicantumkan?"
                      : "Are any misconceptions listed that should not be included?"}
                  </p>
                  <PresenceToggle
                    value={hasIncorrectMisconceptions}
                    onChange={setHasIncorrectMisconceptions}
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi yang tidak seharusnya dicantumkan?"
                        : "Are any misconceptions listed that should not be included?"
                    }
                    yesDisabled={recommended.length === 0}
                  />
                </div>
              </div>

              {hasIncorrectMisconceptions && (
                <div className="ml-9 mt-4 space-y-4 rounded-md border border-border bg-neutral/60 p-3">
                  <fieldset>
                    <legend className="text-xs font-semibold leading-5 text-navy-deep">
                      {language === "id" ? "Pilih yang perlu dihapus" : "Select items to remove"}
                    </legend>
                    <div className="mt-2 space-y-2">
                      {recommended.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-white px-3 py-2.5 text-sm leading-5 text-navy-deep">
                          <input
                            type="checkbox"
                            checked={removedMisconceptionIds.includes(item.id)}
                            onChange={(event) =>
                              setRemovedMisconceptionIds((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                          />
                          <span>{t(item.title, language)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label htmlFor="removal-reason" className="block text-xs font-semibold text-navy-deep">
                    {language === "id" ? "Alasan" : "Reason"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
                  </label>
                  <textarea
                    id="removal-reason"
                    value={removalReason}
                    onChange={(event) => setRemovalReason(event.target.value)}
                    aria-required="true"
                    placeholder={language === "id" ? "Jelaskan mengapa perlu dihapus" : "Explain why it should be removed"}
                    className="academic-input min-h-20 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-6" aria-labelledby="add-misconception-question">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p id="add-misconception-question" className="text-sm font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi lain yang perlu ditambahkan?"
                      : "Should any other misconceptions be added?"}
                  </p>
                  <PresenceToggle
                    value={hasAdditionalMisconceptions}
                    onChange={setHasAdditionalMisconceptions}
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi lain yang perlu ditambahkan?"
                        : "Should any other misconceptions be added?"
                    }
                    yesDisabled={addableMisconceptions.length === 0}
                  />
                </div>
              </div>

              {hasAdditionalMisconceptions && (
                <div className="ml-9 mt-4 space-y-4 rounded-md border border-border bg-neutral/60 p-3">
                  <MisconceptionPicker
                    misconceptions={addableMisconceptions}
                    recommended={similarMisconceptions}
                    value={additionalMisconceptionIds}
                    onChange={setAdditionalMisconceptionIds}
                    variant="selection"
                    label={language === "id" ? "Miskonsepsi yang ditambahkan" : "Misconceptions to add"}
                    helper={language === "id" ? "Anda dapat memilih lebih dari satu." : "You may select more than one."}
                  />

                  <label htmlFor="addition-reason" className="block text-xs font-semibold text-navy-deep">
                    {language === "id" ? "Alasan" : "Reason"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
                  </label>
                  <textarea
                    id="addition-reason"
                    value={additionReason}
                    onChange={(event) => setAdditionReason(event.target.value)}
                    aria-required="true"
                    placeholder={language === "id" ? "Jelaskan mengapa perlu ditambahkan" : "Explain why it should be added"}
                    className="academic-input min-h-20 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-6" aria-labelledby="additional-comment-label">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <label id="additional-comment-label" htmlFor="question-validation-note" className="block text-sm font-semibold text-navy-deep">
                    {language === "id" ? "Komentar tambahan" : "Additional comment"}
                  </label>
                  <textarea
                    id="question-validation-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={language === "id" ? "Komentar opsional" : "Optional comment"}
                    className="academic-input mt-3 min-h-24 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              </div>
            </section>
          </div>

          {submitError && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2.5 text-xs leading-5 text-incorrect"
            >
              {submitError}
            </p>
          )}

          {!canSubmit && (
            <p id="question-validation-help" className="mt-5 text-xs leading-5 text-muted">
              {language === "id"
                ? "Jawab kedua pertanyaan dan lengkapi pilihan serta alasan jika memilih Ada."
                : "Answer both questions and complete the selection and reason when choosing Yes."}
            </p>
          )}

          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            aria-describedby={!canSubmit ? "question-validation-help" : undefined}
            className="mt-4 w-full justify-center"
          >
            <Send size={16} strokeWidth={2} aria-hidden="true" />
            {submitting
              ? language === "id"
                ? "Menyimpan..."
                : "Saving..."
              : language === "id"
                ? "Simpan & lanjut"
                : "Save & continue"}
          </Button>
        </aside>
      </div>
    </div>
  );
}

function AnswerValidationWorkspace({
  task,
  question,
  answer,
  misconceptions,
  onSubmit,
}: {
  task: ReviewTask;
  question: Question;
  answer: StudentAnswer;
  misconceptions: Misconception[];
  onSubmit: (values: AnswerReviewValues) => Promise<void>;
}) {
  const { language } = useLanguage();
  const selectedOption = question.options?.find((option) => option.id === answer.selectedOptionId);
  const linkedMisconceptions = prioritizeMisconceptions(misconceptions, [
    task.suggestedMisconceptionId,
    ...answer.studentMisconceptionIds,
  ]);
  const linkedMisconceptionIds = new Set(linkedMisconceptions.map((item) => item.id));
  const addableMisconceptions = misconceptions.filter((item) => !linkedMisconceptionIds.has(item.id));
  const similarMisconceptions = prioritizeMisconceptions(
    addableMisconceptions,
    linkedMisconceptions.flatMap((item) => item.relatedMisconceptionIds),
  );
  const [hasMismatchedMisconceptions, setHasMismatchedMisconceptions] = useState<boolean | null>(null);
  const [removedMisconceptionIds, setRemovedMisconceptionIds] = useState<string[]>([]);
  const [removalReason, setRemovalReason] = useState("");
  const [hasAdditionalMisconceptions, setHasAdditionalMisconceptions] = useState<boolean | null>(null);
  const [additionalMisconceptionIds, setAdditionalMisconceptionIds] = useState<string[]>([]);
  const [additionReason, setAdditionReason] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const canSubmit =
    hasMismatchedMisconceptions !== null &&
    hasAdditionalMisconceptions !== null &&
    (!hasMismatchedMisconceptions || (removedMisconceptionIds.length > 0 && removalReason.trim().length > 0)) &&
    (!hasAdditionalMisconceptions || (additionalMisconceptionIds.length > 0 && additionReason.trim().length > 0));

  const handleSubmit = async () => {
    if (
      !canSubmit ||
      submitting ||
      hasMismatchedMisconceptions === null ||
      hasAdditionalMisconceptions === null
    ) {
      return;
    }

    setSubmitError("");
    setSubmitting(true);

    try {
      await onSubmit({
        hasMismatchedMisconceptions,
        removedMisconceptionIds: hasMismatchedMisconceptions
          ? removedMisconceptionIds
          : [],
        removalReason: hasMismatchedMisconceptions
          ? removalReason.trim()
          : null,
        hasAdditionalMisconceptions,
        additionalMisconceptionIds: hasAdditionalMisconceptions
          ? additionalMisconceptionIds
          : [],
        additionReason: hasAdditionalMisconceptions
          ? additionReason.trim()
          : null,
        note: note.trim() || null,
      });
    } catch (error) {
      console.error("[Progmiscon] Validasi jawaban gagal disimpan", error);
      setSubmitError(
        error instanceof Error
          ? error.message
          : "Validasi jawaban belum dapat disimpan.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="scroll-reveal">
      <section className="mb-4 flex items-center gap-4 rounded-lg bg-white px-5 py-4 shadow-[0_8px_24px_rgba(30,41,59,0.05)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Code2 size={20} strokeWidth={2} aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-bold text-brand">{language === "id" ? "VALIDASI JAWABAN" : "ANSWER VALIDATION"}</p>
          <p className="mt-1 text-sm text-muted">
            {language === "id"
              ? "Menilai pola miskonsepsi pada jawaban"
              : "Assessing misconception patterns in an answer"}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
        <article className="min-w-0 overflow-hidden rounded-lg bg-white p-5 shadow-[0_8px_28px_rgba(30,41,59,0.06)] md:p-7">
          <section className="rounded-lg bg-neutral p-5">
            <p className="academic-label">{language === "id" ? "Soal sebagai konteks" : "Question context"}</p>
            <p className="mt-2 max-w-3xl whitespace-pre-wrap text-base font-semibold leading-7 text-navy-deep">
              {t(question.prompt, language)}
            </p>
          </section>

          <section className="mt-6">
            <p className="mb-2 text-sm font-bold text-navy-deep">
              {language === "id" ? "Variasi jawaban" : "Answer variation"}
            </p>
            <div className="overflow-hidden rounded-md border border-border">
              <div className="bg-bg p-5">
                {selectedOption ? (
                  <p className="text-sm text-navy-deep">
                    <span className="font-medium">{selectedOption.label}.</span> {t(selectedOption.text, language)}
                  </p>
                ) : (
                  <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-navy-deep">{answer.answerText}</pre>
                )}
              </div>
              <AnswerStatusBar status={answer.status} />
            </div>
          </section>

          <section className="mt-6 border-t border-border pt-5">
            <p className="academic-label">
              {language === "id" ? "Miskonsepsi yang dikaitkan saat ini" : "Currently linked misconceptions"}
            </p>
            <ul className="mt-3 space-y-2">
              {linkedMisconceptions.map((item) => (
                <li key={item.id} className="rounded-md bg-brand-soft/65 px-4 py-3 text-sm font-semibold leading-5 text-navy-deep">
                  {t(item.title, language)}
                </li>
              ))}
            </ul>
          </section>
        </article>

        <aside className="rounded-lg bg-white p-5 shadow-[0_8px_28px_rgba(30,41,59,0.06)] md:p-6 lg:sticky lg:top-24">
          <p className="text-base font-bold text-navy-deep">
            {language === "id" ? "Form validasi jawaban" : "Answer validation form"}
          </p>
          <p className="mt-1 text-sm leading-6 text-muted">
            {language === "id"
              ? "Nilai label berdasarkan pola yang terlihat pada variasi jawaban ini."
              : "Evaluate labels based on the pattern visible in this answer variation."}
          </p>

          <div className="mt-6 space-y-6">
            <section aria-labelledby="remove-answer-misconception-question">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  1
                </span>
                <div className="min-w-0 flex-1">
                  <p id="remove-answer-misconception-question" className="text-sm font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi yang saat ini dikaitkan dengan jawaban ini, tetapi tidak sesuai dengan pola jawabannya?"
                      : "Are any misconceptions currently linked to this answer inconsistent with its pattern?"}
                  </p>
                  <PresenceToggle
                    value={hasMismatchedMisconceptions}
                    onChange={setHasMismatchedMisconceptions}
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi yang saat ini dikaitkan dengan jawaban ini, tetapi tidak sesuai dengan pola jawabannya?"
                        : "Are any misconceptions currently linked to this answer inconsistent with its pattern?"
                    }
                    yesDisabled={linkedMisconceptions.length === 0}
                  />
                </div>
              </div>

              {hasMismatchedMisconceptions && (
                <div className="ml-9 mt-4 space-y-4 rounded-md border border-border bg-neutral/60 p-3">
                  <fieldset>
                    <legend className="text-xs font-semibold leading-5 text-navy-deep">
                      {language === "id" ? "Pilih miskonsepsi yang sebaiknya dilepas" : "Select misconceptions to unlink"}
                    </legend>
                    <div className="mt-2 space-y-2">
                      {linkedMisconceptions.map((item) => (
                        <label key={item.id} className="flex cursor-pointer items-start gap-2.5 rounded-md border border-border bg-white px-3 py-2.5 text-sm leading-5 text-navy-deep">
                          <input
                            type="checkbox"
                            checked={removedMisconceptionIds.includes(item.id)}
                            onChange={(event) =>
                              setRemovedMisconceptionIds((current) =>
                                event.target.checked
                                  ? [...current, item.id]
                                  : current.filter((id) => id !== item.id),
                              )
                            }
                            className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                          />
                          <span>{t(item.title, language)}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label htmlFor="answer-removal-reason" className="block text-xs font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Mengapa miskonsepsi tersebut tidak sesuai dengan pola jawaban ini?"
                      : "Why is this misconception inconsistent with the answer pattern?"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
                  </label>
                  <textarea
                    id="answer-removal-reason"
                    value={removalReason}
                    onChange={(event) => setRemovalReason(event.target.value)}
                    aria-required="true"
                    placeholder={language === "id" ? "Tuliskan alasan" : "Write a reason"}
                    className="academic-input min-h-20 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-6" aria-labelledby="add-answer-misconception-question">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  2
                </span>
                <div className="min-w-0 flex-1">
                  <p id="add-answer-misconception-question" className="text-sm font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Apakah ada miskonsepsi lain yang perlu dikaitkan dengan jawaban ini?"
                      : "Should any other misconceptions be linked to this answer?"}
                  </p>
                  <PresenceToggle
                    value={hasAdditionalMisconceptions}
                    onChange={setHasAdditionalMisconceptions}
                    language={language}
                    label={
                      language === "id"
                        ? "Apakah ada miskonsepsi lain yang perlu dikaitkan dengan jawaban ini?"
                        : "Should any other misconceptions be linked to this answer?"
                    }
                    yesDisabled={addableMisconceptions.length === 0}
                  />
                </div>
              </div>

              {hasAdditionalMisconceptions && (
                <div className="ml-9 mt-4 space-y-4 rounded-md border border-border bg-neutral/60 p-3">
                  <MisconceptionPicker
                    misconceptions={addableMisconceptions}
                    recommended={similarMisconceptions}
                    value={additionalMisconceptionIds}
                    onChange={setAdditionalMisconceptionIds}
                    variant="selection"
                    label={language === "id" ? "Miskonsepsi yang dikaitkan" : "Misconceptions to link"}
                    helper={language === "id" ? "Anda dapat memilih lebih dari satu." : "You may select more than one."}
                  />

                  <label htmlFor="answer-addition-reason" className="block text-xs font-semibold leading-5 text-navy-deep">
                    {language === "id"
                      ? "Mengapa miskonsepsi tersebut sesuai dengan pola jawaban ini?"
                      : "Why does this misconception match the answer pattern?"}
                    <span aria-hidden="true" className="ml-1 text-brand">*</span>
                  </label>
                  <textarea
                    id="answer-addition-reason"
                    value={additionReason}
                    onChange={(event) => setAdditionReason(event.target.value)}
                    aria-required="true"
                    placeholder={language === "id" ? "Tuliskan alasan" : "Write a reason"}
                    className="academic-input min-h-20 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              )}
            </section>

            <section className="border-t border-border pt-6" aria-labelledby="answer-additional-comment-label">
              <div className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-xs font-bold text-brand" aria-hidden="true">
                  3
                </span>
                <div className="min-w-0 flex-1">
                  <label id="answer-additional-comment-label" htmlFor="answer-validation-note" className="block text-sm font-semibold text-navy-deep">
                    {language === "id" ? "Komentar tambahan" : "Additional comment"}
                  </label>
                  <textarea
                    id="answer-validation-note"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder={
                      language === "id"
                        ? "Tuliskan catatan lain mengenai jawaban atau pemetaan miskonsepsinya."
                        : "Write another note about the answer or its misconception mapping."
                    }
                    className="academic-input mt-3 min-h-24 px-3 py-2.5 text-sm placeholder:text-muted/65"
                  />
                </div>
              </div>
            </section>
          </div>

          {submitError && (
            <p
              role="alert"
              className="mt-5 rounded-md border border-incorrect-border bg-incorrect-bg px-3 py-2.5 text-xs leading-5 text-incorrect"
            >
              {submitError}
            </p>
          )}

          {!canSubmit && (
            <p id="answer-validation-help" className="mt-5 text-xs leading-5 text-muted">
              {language === "id"
                ? "Jawab kedua pertanyaan dan lengkapi pilihan serta alasan jika memilih Ada."
                : "Answer both questions and complete the selection and reason when choosing Yes."}
            </p>
          )}

          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            aria-describedby={!canSubmit ? "answer-validation-help" : undefined}
            className="mt-4 w-full justify-center"
          >
            <Send size={16} strokeWidth={2} aria-hidden="true" />
            {submitting
              ? language === "id"
                ? "Menyimpan..."
                : "Saving..."
              : language === "id"
                ? "Simpan & lanjut"
                : "Save & continue"}
          </Button>
        </aside>
      </div>
    </div>
  );
}
