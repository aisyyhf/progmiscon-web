import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-brand bg-brand text-white shadow-[0_1px_2px_rgba(153,0,0,0.14)] hover:bg-brand/90",
  secondary: "border border-border bg-white text-navy hover:border-navy/50 hover:bg-bg",
  ghost: "border border-transparent bg-transparent text-navy hover:bg-navy/5",
  danger: "border border-incorrect-border bg-incorrect-bg text-incorrect hover:bg-incorrect-bg/70",
};

export function Button({ variant = "secondary", className, children, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
        "disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer hover:-translate-y-px active:translate-y-0",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
