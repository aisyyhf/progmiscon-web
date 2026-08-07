import type { ReactNode } from "react";
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
      className="group inline-flex items-center gap-2.5 text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      aria-label="Progmiscon"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
        <img
          src="/progmiscon-logo.png"
          alt=""
          className="h-full w-full scale-[1.4] object-cover contrast-200"
        />
      </span>
      <span className="text-lg font-bold tracking-tight">
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
    <div className="auth-canvas relative isolate min-h-[100dvh] overflow-hidden">
      <section className="grid min-h-[100dvh] w-full overflow-hidden bg-white lg:grid-cols-[0.88fr_1.12fr]">
        <aside className="hidden overflow-hidden border-r border-border bg-neutral p-8 lg:flex lg:flex-col">
          <div>
            <BrandLink />
          </div>

          <div className="mt-6 xl:mt-8">
            <h2 className="auth-title max-w-sm text-[1.9rem] font-bold leading-[1.12] tracking-[-0.025em] text-navy-deep">
              {language === "id"
                ? "Review miskonsepsi lebih terarah"
                : "A clearer misconception review"}
            </h2>
            <p className="mt-3 max-w-sm text-sm leading-6 text-muted">
              {language === "id"
                ? "Tinjau hubungan antara soal, jawaban, dan miskonsepsi dalam satu ruang review"
                : "Review relationships between questions, answers, and misconceptions in one workspace"}
            </p>
          </div>

          <figure className="-mx-8 -mb-8 mt-auto pt-3 xl:pt-5">
            <img
              src="/home-misconception-map.webp"
              alt={
                language === "id"
                  ? "Mahasiswa membandingkan alur jawaban yang salah dan yang sudah diperbaiki"
                  : "A student compares an incorrect answer path with a corrected one"
              }
              width={1448}
              height={1086}
              className="h-[clamp(15rem,36dvh,20rem)] w-full object-cover object-center"
            />
          </figure>
        </aside>

        <div className="flex items-center justify-center bg-white px-5 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-6 xl:py-8">
          <div className="w-full max-w-[27rem]">
            <div className="lg:hidden">
              <BrandLink />
            </div>

            <header className="mt-4 text-left lg:mt-0">
              <h1 className="auth-title text-balance text-[2rem] font-bold leading-tight tracking-[-0.025em] text-navy-deep sm:text-[2.2rem]">
                {title}
              </h1>
              <p className="mt-2 max-w-md text-pretty text-sm leading-5 text-muted">
                {subtitle}
              </p>
            </header>

            <div className="mt-4 border-t border-border pt-4">
              {children}
            </div>

            <p className="mt-3 text-sm leading-5 text-muted">
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
