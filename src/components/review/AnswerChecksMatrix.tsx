import type { AnswerCheck } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { checkKeyLabel, checkPassedLabel, checkPassedSymbol } from "../../utils/status";
import { cn } from "../../utils/cn";

export function AnswerChecksMatrix({ checks }: { checks: AnswerCheck[] }) {
  const { language } = useLanguage();

  return (
    <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2">
      {checks.map((check) => (
        <div
          key={check.key}
          className={cn(
            "flex items-center justify-between gap-3 bg-white px-4 py-3",
            check.passed ? "bg-correct-bg/40" : "bg-incorrect-bg/40",
          )}
        >
          <span className="text-sm text-navy-deep">{checkKeyLabel(check.key, language)}</span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-sm font-medium",
              check.passed ? "text-correct" : "text-incorrect",
            )}
          >
            <span aria-hidden="true">{checkPassedSymbol(check.passed)}</span>
            {checkPassedLabel(check.passed, language)}
          </span>
        </div>
      ))}
    </div>
  );
}
