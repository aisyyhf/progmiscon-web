import type {
  Language,
  Misconception,
  Question,
  Student,
  StudentAnswer,
} from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { misconceptionLabel } from "../../utils/misconceptionLabel";
import { t } from "../../utils/translation";
import { Button } from "../common/Button";
import { EmptyState } from "../common/EmptyState";

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
  const sourceSystem = activeAnswer?.sourceSystem ?? question.sourceSystem;
  const sourceKey = activeAnswer?.sourceKey ?? question.sourceKey;

  return (
    <div className="scroll-reveal">
      <Button
        type="button"
        variant="secondary"
        onClick={onBackToQuestion}
        className="mb-4"
      >
        {language === "id" ? "Kembali ke soal ini" : "Back to this question"}
      </Button>

      <section className="overflow-hidden rounded-lg border border-border bg-white">
        <header className="border-b border-border px-5 py-5 md:px-7">
          <h2 className="text-lg font-bold text-navy-deep">
            {language === "id" ? "Evidence Jawaban PS" : "PS Answer Evidence"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {language === "id"
              ? "Baca jawaban mahasiswa sebagai evidence. Tidak ada tindakan review pada workspace ini."
              : "Read student answers as evidence. This workspace has no review actions."}
          </p>
        </header>

        <section className="border-b border-border bg-neutral px-5 py-4 md:px-7">
          <p className="academic-label">
            {language === "id" ? "Konteks soal PS" : "PS question context"}
          </p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-navy-deep">
            {t(question.prompt, language)}
          </p>
        </section>

        {error ? (
          <p
            role="alert"
            className="m-5 rounded-md border border-incorrect-border bg-incorrect-bg px-4 py-3 text-sm text-incorrect md:m-7"
          >
            {error}
          </p>
        ) : !activeAnswer ? (
          <div className="p-5 md:p-7">
            <EmptyState
              message={unavailable(
                language,
                "Belum ada evidence jawaban untuk soal ini",
                "There is no answer evidence for this question yet",
              )}
            />
          </div>
        ) : (
          <div className="p-5 md:p-7">
            <nav
              aria-label={
                language === "id" ? "Navigasi evidence" : "Evidence navigation"
              }
              className="flex flex-col gap-3 rounded-md border border-border bg-bg p-3 sm:flex-row sm:items-center"
            >
              <Button
                type="button"
                variant="secondary"
                disabled={activeIndex <= 0}
                onClick={() => onSelectAnswer(answers[activeIndex - 1].id)}
              >
                {language === "id" ? "Sebelumnya" : "Previous"}
              </Button>
              <label className="min-w-0 flex-1">
                <span className="sr-only">
                  {language === "id" ? "Pilih evidence" : "Select evidence"}
                </span>
                <select
                  value={activeAnswer.id}
                  onChange={(event) => onSelectAnswer(event.target.value)}
                  className="academic-input min-h-10 px-3 py-2 text-sm"
                >
                  {answers.map((answer, index) => (
                    <option key={answer.id} value={answer.id}>
                      {language === "id" ? "Evidence" : "Evidence"} {index + 1}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-center text-sm font-semibold tabular-nums text-muted sm:min-w-20">
                {activeIndex + 1} {language === "id" ? "dari" : "of"} {answers.length}
              </p>
              <Button
                type="button"
                variant="secondary"
                disabled={activeIndex >= answers.length - 1}
                onClick={() => onSelectAnswer(answers[activeIndex + 1].id)}
              >
                {language === "id" ? "Berikutnya" : "Next"}
              </Button>
            </nav>

            <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
              <div className="min-w-0 space-y-6">
                <section aria-labelledby="evidence-student-title">
                  <h3 id="evidence-student-title" className="academic-label">
                    {language === "id" ? "Identitas mahasiswa" : "Student identity"}
                  </h3>
                  <p className="mt-2 text-base font-bold text-navy-deep">
                    {studentName ||
                      unavailable(
                        language,
                        "Nama mahasiswa belum tersedia",
                        "Student name is not available yet",
                      )}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {studentIdentifier ||
                      unavailable(
                        language,
                        "Identitas mahasiswa belum tersedia",
                        "Student identifier is not available yet",
                      )}
                  </p>
                </section>

                <section className="border-t border-border pt-5" aria-labelledby="evidence-answer-title">
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

                <section className="border-t border-border pt-5" aria-labelledby="evidence-explanation-title">
                  <h3 id="evidence-explanation-title" className="academic-label">
                    {language === "id"
                      ? "Penjelasan atau deskripsi evidence"
                      : "Explanation or evidence description"}
                  </h3>
                  {activeAnswer.explanation &&
                  t(activeAnswer.explanation, language).trim() ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-navy-deep">
                      {t(activeAnswer.explanation, language)}
                    </p>
                  ) : activeAnswer.incorrectElements.length > 0 ? (
                    <ul className="mt-2 space-y-2 text-sm leading-6 text-navy-deep">
                      {activeAnswer.incorrectElements.map((item, index) => (
                        <li key={`${activeAnswer.id}-description-${index}`}>
                          {t(item, language)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      {unavailable(
                        language,
                        "Penjelasan belum tersedia",
                        "Explanation is not available yet",
                      )}
                    </p>
                  )}
                </section>

                <section className="border-t border-border pt-5" aria-labelledby="evidence-misconception-title">
                  <h3 id="evidence-misconception-title" className="academic-label">
                    {language === "id" ? "Miskonsepsi terkait" : "Associated misconceptions"}
                  </h3>
                  {linkedMisconceptions.length > 0 ? (
                    <ul className="mt-3 space-y-2">
                      {linkedMisconceptions.map((item) => (
                        <li
                          key={item.id}
                          className="rounded-md bg-brand-soft/65 px-4 py-3 text-sm font-semibold leading-6 text-navy-deep"
                        >
                          {misconceptionLabel(item, language)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-muted">
                      {unavailable(
                        language,
                        "Belum ada miskonsepsi teridentifikasi",
                        "No misconceptions have been identified yet",
                      )}
                    </p>
                  )}
                </section>
              </div>

              <aside className="rounded-md border border-border bg-bg p-4 lg:sticky lg:top-24">
                <h3 className="text-sm font-bold text-navy-deep">
                  {language === "id" ? "Metadata evidence" : "Evidence metadata"}
                </h3>
                <dl className="mt-4 space-y-4 text-sm">
                  <div>
                    <dt className="text-xs font-semibold text-muted">
                      {language === "id" ? "ID jawaban" : "Answer ID"}
                    </dt>
                    <dd className="mt-1 break-all font-mono text-xs text-navy-deep">
                      {activeAnswer.id}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">
                      {language === "id" ? "Minggu" : "Week"}
                    </dt>
                    <dd className="mt-1 text-navy-deep">
                      {question.week ||
                        unavailable(
                          language,
                          "Minggu belum tersedia",
                          "Week is not available yet",
                        )}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">
                      {language === "id" ? "Sumber" : "Source"}
                    </dt>
                    <dd className="mt-1 break-words text-navy-deep">
                      {sourceSystem ||
                        unavailable(
                          language,
                          "Sumber belum tersedia",
                          "Source is not available yet",
                        )}
                    </dd>
                  </div>
                  {sourceKey && (
                    <div>
                      <dt className="text-xs font-semibold text-muted">
                        {language === "id" ? "Kunci sumber" : "Source key"}
                      </dt>
                      <dd className="mt-1 break-all font-mono text-xs text-navy-deep">
                        {sourceKey}
                      </dd>
                    </div>
                  )}
                </dl>
              </aside>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
