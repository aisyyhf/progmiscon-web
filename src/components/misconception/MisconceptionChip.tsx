import { cn } from "../../utils/cn";

type MisconceptionChipTone = "question" | "student" | "related";

export function MisconceptionChip({
  label,
  onClick,
  selected,
  tone = "question",
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
  tone?: MisconceptionChipTone;
}) {
  const toneClasses: Record<MisconceptionChipTone, { idle: string; selected: string }> = {
    question: {
      idle: "border-brand/25 bg-brand-soft/45 text-navy-deep hover:border-brand/55 hover:bg-brand-soft",
      selected: "border-brand bg-brand-soft text-brand",
    },
    student: {
      idle: "border-incorrect-border bg-incorrect-bg/70 text-incorrect hover:border-incorrect-border hover:bg-incorrect-bg",
      selected: "border-incorrect-border bg-incorrect-bg text-incorrect",
    },
    related: {
      idle: "border-navy/20 bg-white text-navy-deep hover:border-navy/45 hover:bg-bg",
      selected: "border-navy bg-navy text-white",
    },
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold shadow-[0_1px_0_rgba(16,35,63,0.08)] transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        "hover:-translate-y-0.5 active:translate-y-0 active:shadow-none",
        selected ? toneClasses[tone].selected : toneClasses[tone].idle,
      )}
    >
      <span>{label}</span>
      <span aria-hidden="true" className="text-[11px] opacity-80">
        →
      </span>
    </button>
  );
}
