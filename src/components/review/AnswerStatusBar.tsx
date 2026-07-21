import type { AnswerStatus } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { CheckCircle2, XCircle } from "lucide-react";

export function AnswerStatusBar({ status }: { status: AnswerStatus }) {
  const { language } = useLanguage();
  const correct = status === "correct";
  const Icon = correct ? CheckCircle2 : XCircle;

  return (
    <div
      className={`flex items-center gap-2.5 rounded-md border px-4 py-3 text-white ${
        correct
          ? "border-correct bg-correct"
          : "border-brand-deep bg-brand"
      }`}
    >
      <Icon size={18} strokeWidth={2.3} className="shrink-0" aria-hidden="true" />
      <p className="text-xs text-white">
        <span className="font-semibold">
          {language === "id" ? "Status jawaban: " : "Answer status: "}
        </span>
        <span className="font-bold">
          {correct
            ? language === "id"
              ? "Jawaban Benar"
              : "Correct Answer"
            : language === "id"
              ? "Jawaban Salah"
              : "Incorrect Answer"}
        </span>
      </p>
    </div>
  );
}
