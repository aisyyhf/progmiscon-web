import { Link } from "react-router-dom";
import { NavTabs } from "../navigation/NavTabs";
import { LanguageToggle } from "../navigation/LanguageToggle";
import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { useLanguage } from "../../hooks/useLanguage";

export function TopNav() {
  const { language } = useLanguage();
  const { isLecturer, logout } = useLecturerAuth();

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-border bg-surface/95 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur">
      <div className="mx-auto flex h-full max-w-[1240px] items-center justify-between px-6 md:px-8">
        <Link
          to="/home"
          className="font-serif-brand text-lg font-semibold tracking-tight text-navy-deep transition-colors hover:text-gold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold"
        >
          Progmiscon
        </Link>
        <div className="hidden md:block">
          <NavTabs />
        </div>
        <div className="flex items-center gap-3">
          {isLecturer ? (
            <div className="flex items-center gap-2">
              <span className="hidden rounded-md border border-brand/20 bg-brand-soft/50 px-2.5 py-1.5 text-xs font-medium text-brand sm:inline-flex">
                {language === "id" ? "Dosen" : "Lecturer"}
              </span>
              <button
                type="button"
                onClick={logout}
                className="cursor-pointer rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-muted hover:border-gold/50 hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                {language === "id" ? "Keluar" : "Logout"}
              </button>
            </div>
          ) : (
            <Link
              to="/dosen/login"
              className="inline-flex rounded-md border border-border bg-white px-2.5 py-1.5 text-xs font-medium text-navy-deep transition hover:border-brand/50 hover:bg-brand-soft/40 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
            >
              {language === "id" ? "Masuk Dosen" : "Lecturer Login"}
            </Link>
          )}
          <LanguageToggle />
        </div>
      </div>
      <div className="border-t border-border px-6 py-1.5 md:hidden">
        <NavTabs />
      </div>
    </header>
  );
}
