import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white hover:bg-brand/90 border border-brand shadow-[0_1px_2px_rgba(153,0,0,0.12)]",
  secondary: "bg-surface text-navy border border-border hover:border-navy/50 hover:bg-white",
  ghost: "bg-transparent text-navy hover:bg-navy/5 border border-transparent",
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
