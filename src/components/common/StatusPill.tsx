import { cn } from "../../utils/cn";

type Tone = "correct" | "incorrect" | "muted";

const toneClasses: Record<Tone, string> = {
  correct: "bg-correct-bg text-correct border-correct/30",
  incorrect: "bg-incorrect-bg text-incorrect border-incorrect/30",
  muted: "bg-white text-muted border-border",
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
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium",
        toneClasses[tone],
      )}
    >
      {symbol && <span aria-hidden="true">{symbol}</span>}
      {label}
    </span>
  );
}
