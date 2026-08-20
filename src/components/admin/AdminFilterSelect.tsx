import { ChevronDown } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn";

type AdminFilterSelectProps = ComponentPropsWithoutRef<"select"> & {
  label: string;
};

export function AdminFilterSelect({
  children,
  className,
  label,
  ...props
}: AdminFilterSelectProps) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <select
        {...props}
        className={cn(
          "h-10 w-full cursor-pointer appearance-none rounded-lg border border-border bg-white py-2 pl-3 pr-10 text-left text-sm leading-5 text-navy-deep outline-none focus:border-brand focus:ring-2 focus:ring-brand/15",
          className,
        )}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted"
        size={16}
        strokeWidth={1.9}
        aria-hidden="true"
      />
    </label>
  );
}
