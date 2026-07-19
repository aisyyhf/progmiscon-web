import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-brand bg-brand text-white hover:border-brand-deep hover:bg-brand-deep",
  secondary: "border border-border bg-white text-navy hover:border-navy/35 hover:bg-neutral",
  ghost: "border border-transparent bg-transparent text-navy hover:bg-neutral",
  danger: "border border-incorrect-border bg-incorrect-bg text-incorrect hover:border-incorrect hover:bg-incorrect-bg",
};

export function Button({ variant = "secondary", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-2 rounded-md px-3.5 py-2 text-sm font-semibold transition-colors",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        "disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
