import { useId, useRef } from "react";
import { X } from "lucide-react";
import type { Misconception, StudentAnswer } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { misconceptionLabel } from "../../utils/misconceptionLabel";
import { PseudocodeBlock } from "./PseudocodeBlock";

function looksLikePseudocode(value: string) {
  return (
    value.includes("\n") ||
    /(?:←|<-|:=|\b(?:algoritma|begin|end|for|if|jika|print|read|return|while)\b)/i.test(
      value,
    )
  );
}

export function StructuredEvidenceList({
  answers,
  misconceptions,
}: {
  answers: readonly StudentAnswer[];
  misconceptions: readonly Misconception[];
}) {
  const { language } = useLanguage();
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
        const answerText =
          answer.studentAnswer?.trim() || answer.answerText?.trim() || "";

        return (
          <li
            key={answer.id}
            className="min-w-0 rounded-md border border-border bg-white px-4 py-3 text-xs leading-5 text-navy-deep"
          >
            <dl className="grid gap-3">
              {answerText && (
                <div>
                  <dt className="font-medium text-muted">
                    {language === "id" ? "Jawaban" : "Answer"}
                  </dt>
                  <dd className="mt-1 min-w-0">
                    {looksLikePseudocode(answerText) ? (
                      <div className="min-w-0 overflow-hidden rounded-md border border-navy-deep/20">
                        <PseudocodeBlock code={answerText} />
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap break-words">{answerText}</p>
                    )}
                  </dd>
                </div>
              )}
              {misconceptionId && (
                <div>
                  <dt className="font-medium text-muted">
                    {language === "id" ? "Miskonsepsi" : "Misconception"}
                  </dt>
                  <dd className="mt-0.5">
                    {misconception
                      ? misconceptionLabel(misconception, language)
                      : misconceptionId}
                  </dd>
                </div>
              )}
              {explanation && (
                <div>
                  <dt className="font-medium text-muted">
                    {language === "id" ? "Penjelasan" : "Explanation"}
                  </dt>
                  <dd className="mt-0.5 font-normal">{explanation}</dd>
                </div>
              )}
            </dl>
          </li>
        );
      })}
    </ul>
  );
}

export function MisconceptionEvidenceDialog({
  answers,
  misconception,
}: {
  answers: readonly StudentAnswer[];
  misconception: Misconception;
}) {
  const { language } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  if (answers.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="inline-flex min-h-8 items-center rounded-md border border-brand/25 bg-white px-2.5 py-1 text-[11px] font-medium leading-4 text-brand transition-colors hover:border-brand/45 hover:bg-brand-soft/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        Evidence ({answers.length})
      </button>
      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-xl border border-[#ccbab0] bg-white p-0 text-black shadow-2xl backdrop:bg-black/35"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-base font-semibold leading-6 text-navy-deep">
              {language === "id" ? "Evidence miskonsepsi" : "Misconception evidence"}
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              {misconceptionLabel(misconception, language)}
            </p>
          </div>
          <button
            type="button"
            aria-label={language === "id" ? "Tutup modal" : "Close dialog"}
            onClick={() => dialogRef.current?.close()}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-neutral hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X size={17} aria-hidden="true" />
          </button>
        </div>
        <div className="max-h-[calc(100dvh-7rem)] overflow-y-auto px-4 pb-5 sm:px-5">
          <StructuredEvidenceList
            answers={answers}
            misconceptions={[misconception]}
          />
        </div>
      </dialog>
    </>
  );
}
