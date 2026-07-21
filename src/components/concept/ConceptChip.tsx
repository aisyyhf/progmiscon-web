import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function ConceptChip({
  label,
  onClick,
  selected,
  icon,
  showArrow = true,
}: {
  label: string;
  onClick: () => void;
  selected?: boolean;
  icon?: ReactNode;
  showArrow?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={selected}
      className={cn(
        "inline-flex cursor-pointer items-center gap-2 rounded-md border px-3.5 py-2 text-xs font-semibold transition-all",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "hover:-translate-y-0.5 active:translate-y-0",
        selected
          ? "border-navy bg-navy text-white"
          : "border-navy/20 bg-white text-navy-deep hover:border-brand/35 hover:bg-brand-soft/40",
      )}
    >
      {icon && (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-brand-soft text-brand">
          {icon}
        </span>
      )}
      <span>{label}</span>
      {showArrow && (
        <span aria-hidden="true" className="text-[11px] opacity-75">
          {"\u2192"}
        </span>
      )}
    </button>
  );
}
