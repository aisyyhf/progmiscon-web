import { cn } from "../../utils/cn";

type Tone = "correct" | "incorrect" | "warning" | "muted";

const toneClasses: Record<Tone, string> = {
  correct: "border-correct-border bg-correct-bg text-correct",
  incorrect: "border-incorrect-border bg-incorrect-bg text-incorrect",
  warning: "border-warning-border bg-warning-bg text-warning",
  muted: "border-border bg-white text-muted",
};

export function StatusPill({
  tone,
  label,
  symbol,
}: {
  tone: Tone;
  label: string;
  symbol?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold",
        toneClasses[tone],
      )}
    >
      {symbol && <span aria-hidden="true">{symbol}</span>}
      {label}
    </span>
  );
}
