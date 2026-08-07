import type { ReactNode } from "react";
import { BookOpen, GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";

type AuthPageLayoutProps = {
  title: string;
  subtitle: string;
  accountPrompt: string;
  accountLinkLabel: string;
  accountLinkTo: string;
  children: ReactNode;
};

export function AuthPageLayout({
  title,
  subtitle,
  accountPrompt,
  accountLinkLabel,
  accountLinkTo,
  children,
}: AuthPageLayoutProps) {
  return (
    <div className="auth-canvas relative isolate min-h-[100dvh] overflow-hidden px-4 py-4 sm:px-6 md:grid md:place-items-center md:py-5">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <BookOpen
          strokeWidth={1}
          className="absolute -bottom-20 -right-20 size-72 rotate-[-8deg] text-brand/[0.055] sm:size-96"
        />
        <GraduationCap
          strokeWidth={1}
          className="absolute -left-14 bottom-8 hidden size-60 rotate-12 text-brand/[0.045] sm:block"
        />
      </div>

      <section className="relative mx-auto flex w-full max-w-[29rem] flex-col items-center">
        <Link
          to="/home"
          className="group inline-flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          aria-label="Progmiscon"
        >
          <span className="flex size-10 items-center justify-center rounded-lg border border-brand/10 bg-brand-soft text-brand shadow-[0_6px_16px_rgba(143,28,32,0.07)]">
            <GraduationCap
              size={22}
              strokeWidth={2}
              aria-hidden="true"
            />
          </span>
          <span className="text-base font-extrabold tracking-[-0.025em]">
            <span className="text-brand">Prog</span>
            <span className="text-navy-deep">miscon</span>
          </span>
        </Link>

        <header className="mt-3 text-center">
          <h1 className="auth-title text-balance text-[1.9rem] font-bold leading-tight tracking-[-0.025em] text-navy-deep sm:text-[2.1rem]">
            {title}
          </h1>
          <p className="mx-auto mt-1.5 max-w-md text-pretty text-sm leading-5 text-muted">
            {subtitle}
          </p>
        </header>

        <div className="relative mt-4 w-full overflow-hidden rounded-xl border border-[#eadbd8] bg-white/95 px-5 pb-5 pt-5 shadow-[0_18px_48px_rgba(104,43,45,0.11)] sm:px-6 sm:pb-6">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-brand"
          />
          {children}
        </div>

        <p className="mt-3 text-center text-sm leading-5 text-muted">
          {accountPrompt}{" "}
          <Link
            to={accountLinkTo}
            className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {accountLinkLabel}
          </Link>
        </p>
      </section>
    </div>
  );
}
