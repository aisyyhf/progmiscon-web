import { cn } from "../../utils/cn";

export function ConceptChip({
  label,
  onClick,
  selected,
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        "hover:-translate-y-0.5 active:translate-y-0",
        selected
          ? "border-navy bg-navy text-white"
          : "border-navy/20 bg-white text-navy-deep hover:border-navy/45 hover:bg-bg",
      )}
    >
      <span>{label}</span>
      <span aria-hidden="true" className="text-[11px] opacity-75">
        →
      </span>
    </button>
  );
}
