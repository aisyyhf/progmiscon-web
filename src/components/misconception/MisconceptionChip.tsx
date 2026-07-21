import { cn } from "../../utils/cn";

type MisconceptionChipTone = "question" | "student" | "related";

export function MisconceptionChip({
  label,
  onClick,
  selected,
  tone = "question",
  className,
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
  tone?: MisconceptionChipTone;
  className?: string;
}) {
  const toneClasses: Record<MisconceptionChipTone, { idle: string; selected: string }> = {
    question: {
      idle: "border-border bg-white text-navy-deep hover:border-brand/45 hover:bg-brand-soft/35",
      selected: "border-brand bg-brand-soft text-brand",
    },
    student: {
      idle: "border-brand/25 bg-brand-soft/70 text-brand-deep hover:border-brand/55 hover:bg-brand-soft",
      selected: "border-brand bg-brand-soft text-brand-deep",
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
        "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-semibold transition-all",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "hover:-translate-y-0.5 active:translate-y-0 active:shadow-none",
        selected ? toneClasses[tone].selected : toneClasses[tone].idle,
        className,
      )}
    >
      <span>{label}</span>
      <span aria-hidden="true" className="text-[11px] opacity-80">
        {"\u2192"}
      </span>
    </button>
  );
}
