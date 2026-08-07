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
    <div className="auth-canvas relative isolate min-h-[100dvh] overflow-hidden px-4 py-6 sm:px-6 md:grid md:place-items-center md:py-8">
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
          className="group flex flex-col items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
          aria-label="Progmiscon"
        >
          <span className="flex size-12 items-center justify-center overflow-hidden rounded-xl border border-brand/10 bg-brand-soft shadow-[0_8px_20px_rgba(143,28,32,0.08)]">
            <img
              src="/progmiscon-logo.png"
              alt=""
              className="size-full scale-[1.5] object-cover mix-blend-multiply"
            />
          </span>
          <span className="text-sm font-extrabold tracking-[-0.02em]">
            <span className="text-brand">Prog</span>
            <span className="text-navy-deep">miscon</span>
          </span>
        </Link>

        <header className="mt-4 text-center">
          <h1 className="auth-title text-balance text-[2rem] font-bold leading-tight tracking-[-0.025em] text-navy-deep sm:text-[2.2rem]">
            {title}
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-pretty text-sm leading-6 text-muted">
            {subtitle}
          </p>
        </header>

        <div className="relative mt-6 w-full overflow-hidden rounded-xl border border-[#eadbd8] bg-white/95 px-5 pb-6 pt-7 shadow-[0_18px_48px_rgba(104,43,45,0.11)] sm:px-7 sm:pb-7">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-[3px] bg-brand"
          />
          {children}
        </div>

        <p className="mt-5 text-center text-sm leading-6 text-muted">
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
