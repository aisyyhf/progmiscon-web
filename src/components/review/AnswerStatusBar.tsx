import type { AnswerStatus } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { CheckCircle2, XCircle } from "lucide-react";

export function AnswerStatusBar({ status }: { status: AnswerStatus }) {
  const { language } = useLanguage();
  const correct = status === "correct";
  const Icon = correct ? CheckCircle2 : XCircle;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3.5 ${
        correct
          ? "border-correct-border bg-correct-bg text-correct"
          : "border-incorrect-border bg-incorrect-bg text-incorrect"
      }`}
    >
      <p className="flex items-center gap-2 text-xs font-bold">
        <Icon size={17} strokeWidth={2.2} aria-hidden="true" />
        {language === "id" ? "Status jawaban" : "Answer status"}
      </p>
      <p className="text-base font-bold">
        {correct
          ? language === "id"
            ? "Jawaban Benar"
            : "Correct Answer"
          : language === "id"
            ? "Jawaban Salah"
            : "Incorrect Answer"}
      </p>
    </div>
  );
}
