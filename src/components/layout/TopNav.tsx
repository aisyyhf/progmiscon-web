import { Link } from "react-router-dom";
import { NavTabs } from "../navigation/NavTabs";
import { LanguageToggle } from "../navigation/LanguageToggle";
import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { useLanguage } from "../../hooks/useLanguage";

export function TopNav() {
  const { language } = useLanguage();
  const { isLecturer, logout } = useLecturerAuth();

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/95 shadow-[0_1px_0_rgba(30,41,59,0.04)] backdrop-blur">
      <div className="mx-auto grid h-16 max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:px-8">
        <Link
          to="/home"
          className="justify-self-start font-serif-brand text-lg font-semibold tracking-tight text-brand transition-colors hover:text-brand/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          Progmiscon
        </Link>
        <div className="hidden justify-self-center md:block">
          <NavTabs />
        </div>
        <div className="flex items-center gap-2 justify-self-end">
          <LanguageToggle />
          {isLecturer ? (
            <details className="group relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium text-navy transition-colors hover:bg-bg hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold [&::-webkit-details-marker]:hidden">
                {language === "id" ? "Dosen" : "Lecturer"}
                <span aria-hidden="true" className="text-[10px] text-muted transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 min-w-32 rounded-md border border-border bg-white p-1.5 shadow-[0_8px_24px_rgba(30,41,59,0.12)]">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full cursor-pointer rounded px-3 py-2 text-left text-xs font-medium text-muted transition-colors hover:bg-bg hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold"
                >
                  {language === "id" ? "Keluar" : "Logout"}
                </button>
              </div>
            </details>
          ) : (
            <Link
              to="/dosen/login"
              className="inline-flex rounded-md border border-brand/35 bg-white px-2 py-1.5 text-xs font-medium text-brand transition hover:border-brand/70 hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold sm:px-2.5"
            >
              {language === "id" ? "Akun Dosen" : "Lecturer Account"}
            </Link>
          )}
        </div>
      </div>
      <div className="overflow-x-auto border-t border-border px-6 py-1.5 md:hidden">
        <NavTabs />
      </div>
    </header>
  );
}
