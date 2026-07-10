import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-white px-3 py-1 text-xs text-navy-deep",
        className,
      )}
    >
      {children}
    </span>
  );
}
