import type { Misconception, StudentAnswer } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";

export function StructuredEvidenceList({
  answers,
  misconceptions,
}: {
  answers: readonly StudentAnswer[];
  misconceptions: readonly Misconception[];
}) {
  const { language } = useLanguage();
  const unavailable = language === "id" ? "Tidak tersedia" : "Unavailable";
  const misconceptionById = new Map(
    misconceptions.map((misconception) => [misconception.id, misconception]),
  );

  return (
    <ul className="mt-3 grid min-w-0 gap-3">
      {answers.map((answer) => {
        const misconceptionId = answer.evidenceMisconceptionId?.trim() ?? "";
        const misconception = misconceptionById.get(misconceptionId);
        const explanation = answer.evidenceExplanation
          ? t(answer.evidenceExplanation, language).trim()
          : "";

        return (
          <li
            key={answer.id}
            className="min-w-0 rounded-md border border-border bg-white px-4 py-3 text-xs leading-5 text-navy-deep"
          >
            {answer.evidenceId && (
              <p className="mb-2 font-mono text-[10px] font-medium text-muted">
                #{answer.evidenceId.replace(/^#/, "")}
              </p>
            )}
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-muted">
                  {language === "id" ? "Nama siswa" : "Student name"}
                </dt>
                <dd className="mt-0.5">{answer.studentName?.trim() || unavailable}</dd>
              </div>
              <div>
                <dt className="font-semibold text-muted">
                  {language === "id" ? "Miskonsepsi" : "Misconception"}
                </dt>
                <dd className="mt-0.5">
                  {misconceptionId ? (
                    <>
                      <span className="font-mono font-medium">{misconceptionId}</span>
                      {misconception ? ` - ${t(misconception.title, language)}` : ""}
                    </>
                  ) : unavailable}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-muted">
                  {language === "id" ? "Jawaban siswa" : "Student answer"}
                </dt>
                <dd className="mt-1">
                  {answer.studentAnswer?.trim() || answer.answerText?.trim() ? (
                    <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md bg-[var(--review-secondary-soft)] px-3 py-2 font-mono font-normal leading-5 text-black">
                      {answer.studentAnswer?.trim() || answer.answerText?.trim()}
                    </pre>
                  ) : unavailable}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="font-semibold text-muted">
                  {language === "id" ? "Penjelasan" : "Explanation"}
                </dt>
                <dd className="mt-0.5 font-normal">{explanation || unavailable}</dd>
              </div>
            </dl>
          </li>
        );
      })}
    </ul>
  );
}
