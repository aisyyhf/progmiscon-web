import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-navy-deep shadow-[0_1px_0_rgba(30,41,59,0.04)]",
        className,
      )}
    >
      {children}
    </span>
  );
}
