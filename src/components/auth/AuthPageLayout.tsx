import type { ReactNode } from "react";
import { GraduationCap } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";

type AuthPageLayoutProps = {
  title: string;
  subtitle: string;
  accountPrompt: string;
  accountLinkLabel: string;
  accountLinkTo: string;
  children: ReactNode;
};

function BrandLink() {
  return (
    <Link
      to="/home"
      className="group inline-flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      aria-label="Progmiscon"
    >
      <span className="flex size-10 items-center justify-center rounded-lg border border-brand/10 bg-brand-soft text-brand shadow-[0_6px_16px_rgba(143,28,32,0.07)]">
        <GraduationCap size={22} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="text-base font-extrabold tracking-[-0.025em]">
        <span className="text-brand">Prog</span>
        <span className="text-navy-deep">miscon</span>
      </span>
    </Link>
  );
}

export function AuthPageLayout({
  title,
  subtitle,
  accountPrompt,
  accountLinkLabel,
  accountLinkTo,
  children,
}: AuthPageLayoutProps) {
  const { language } = useLanguage();

  return (
    <div className="auth-canvas relative isolate min-h-[100dvh] overflow-hidden px-4 py-4 sm:px-6 lg:grid lg:place-items-center lg:p-5">
      <section className="relative mx-auto grid w-full max-w-[70rem] overflow-hidden rounded-2xl border border-[#eadbd8] bg-white shadow-[0_24px_70px_rgba(104,43,45,0.11)] lg:min-h-[590px] lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="relative hidden overflow-hidden border-r border-brand/10 bg-[#f7eeec] p-8 lg:flex lg:flex-col">
          <div
            aria-hidden="true"
            className="absolute -left-28 -top-28 size-72 rounded-full bg-white/45 blur-2xl"
          />

          <div className="relative">
            <BrandLink />
          </div>

          <div className="relative mt-8">
            <h2 className="auth-title max-w-sm text-[1.9rem] font-bold leading-[1.12] tracking-[-0.025em] text-navy-deep">
              {language === "id"
                ? "Review yang lebih terarah"
                : "A clearer review workflow"}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
              {language === "id"
                ? "Hubungkan jawaban mahasiswa dengan pola miskonsepsi yang perlu diperbaiki"
                : "Connect student answers to the misconception patterns that need attention"}
            </p>
          </div>

          <figure className="relative -mx-8 -mb-8 mt-auto pt-5">
            <img
              src="/home-academic-collaboration.webp"
              alt={
                language === "id"
                  ? "Dosen dan mahasiswa meninjau peta miskonsepsi"
                  : "A lecturer and students reviewing misconception maps"
              }
              width={1536}
              height={1024}
              className="h-[285px] w-full object-cover object-center mix-blend-multiply"
            />
          </figure>
        </aside>

        <div className="flex items-center justify-center bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-8">
          <div className="w-full max-w-[27rem]">
            <div className="lg:hidden">
              <BrandLink />
            </div>

            <header className="mt-5 text-left lg:mt-0">
              <h1 className="auth-title text-balance text-[2rem] font-bold leading-tight tracking-[-0.025em] text-navy-deep sm:text-[2.2rem]">
                {title}
              </h1>
              <p className="mt-2 max-w-md text-pretty text-sm leading-5 text-muted">
                {subtitle}
              </p>
            </header>

            <div className="mt-5 border-t-[3px] border-brand pt-5">
              {children}
            </div>

            <p className="mt-4 text-sm leading-5 text-muted">
              {accountPrompt}{" "}
              <Link
                to={accountLinkTo}
                className="font-semibold text-brand underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {accountLinkLabel}
              </Link>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
