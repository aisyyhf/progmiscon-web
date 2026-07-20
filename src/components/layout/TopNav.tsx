import { Link } from "react-router-dom";
import { ChevronDown, History, LogOut, UserRound } from "lucide-react";
import { NavTabs } from "../navigation/NavTabs";
import { LanguageToggle } from "../navigation/LanguageToggle";
import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { useLanguage } from "../../hooks/useLanguage";

export function TopNav() {
  const { language } = useLanguage();
  const { isLecturer, profile, logout } = useLecturerAuth();

  const lecturerName =
    profile?.fullName.trim() || (language === "id" ? "Dosen" : "Lecturer");

  const lecturerFirstName =
    lecturerName.split(/\s+/)[0] || (language === "id" ? "Dosen" : "Lecturer");

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 shadow-[0_1px_12px_rgba(30,41,59,0.04)] backdrop-blur-md">
      <div className="mx-auto grid h-[68px] max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-8">
        <Link
          to="/home"
          className="group inline-flex items-center gap-2.5 justify-self-start text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
            <img
              src="/progmiscon-logo.png"
              alt=""
              className="h-full w-full scale-[1.4] object-cover contrast-200"
            />
          </span>
          <span className="text-lg font-bold text-navy-deep transition-colors group-hover:text-brand">
            Progmiscon
          </span>
        </Link>

        <div className="hidden justify-self-center md:block">
          <NavTabs />
        </div>

        <div className="flex items-center gap-2.5 justify-self-end">
          <LanguageToggle />
          {isLecturer ? (
            <details className="group relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg bg-neutral px-2.5 py-2 text-xs font-semibold text-navy transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-brand shadow-sm">
                  <UserRound size={14} strokeWidth={2} aria-hidden="true" />
                </span>
                {lecturerFirstName}
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className="text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-1.5 shadow-[0_18px_45px_rgba(30,41,59,0.14)]">
                <div className="border-b border-border px-3 py-3">
                  <p className="truncate text-sm font-bold text-navy-deep">
                    {lecturerName}
                  </p>

                  {profile?.email && (
                    <p className="mt-1 truncate text-xs text-muted">
                      {profile.email}
                    </p>
                  )}
                </div>

                <div className="py-1.5">
                  <Link
                    to="/review/riwayat"
                    className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-semibold text-muted transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                  >
                    <History size={14} strokeWidth={2} aria-hidden="true" />
                    {language === "id"
                      ? "Riwayat Review Saya"
                      : "My Review History"}
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      void logout().catch((error) => {
                        console.error("[Progmiscon] Logout gagal", error);
                      });
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-semibold text-muted transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                  >
                    <LogOut size={14} strokeWidth={2} aria-hidden="true" />
                    {language === "id" ? "Keluar" : "Logout"}
                  </button>
                </div>
              </div>
            </details>
          ) : (
            <Link
              to="/dosen/login"
              className="inline-flex items-center gap-2 rounded-lg border border-brand/25 bg-brand-soft/55 px-3 py-2 text-xs font-semibold text-brand transition-colors hover:border-brand/45 hover:bg-brand-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <UserRound size={14} strokeWidth={2} aria-hidden="true" />
              {language === "id" ? "Akun Dosen" : "Lecturer Account"}
            </Link>
          )}
        </div>
      </div>

      <div className="hide-scrollbar overflow-x-auto border-t border-border bg-white px-2 py-1 md:hidden">
        <NavTabs />
      </div>
    </header>
  );
}
