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
      idle: "border-gold/70 bg-gold-soft/35 text-navy-deep hover:border-gold hover:bg-gold-soft/70",
      selected: "border-gold bg-gold-soft text-navy-deep",
    },
    student: {
      idle: "border-incorrect/35 bg-incorrect-bg/60 text-incorrect hover:border-incorrect/70 hover:bg-incorrect-bg",
      selected: "border-incorrect bg-incorrect-bg text-incorrect",
    },
    related: {
      idle: "border-navy/20 bg-bg text-navy-deep hover:border-navy/45 hover:bg-white",
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
