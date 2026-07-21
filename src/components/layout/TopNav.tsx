import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ChevronDown, History, LogOut, Menu, UserRound, X } from "lucide-react";
import { NavTabs } from "../navigation/NavTabs";
import { LanguageToggle } from "../navigation/LanguageToggle";
import { useNavLinks } from "../navigation/useNavLinks";
import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";

export function TopNav() {
  const { language } = useLanguage();
  const { isLecturer, profile, logout } = useLecturerAuth();
  const location = useLocation();
  const links = useNavLinks();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const lecturerName =
    profile?.fullName.trim() || (language === "id" ? "Dosen" : "Lecturer");

  const lecturerFirstName =
    lecturerName.split(/\s+/)[0] || (language === "id" ? "Dosen" : "Lecturer");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur-md">
      <div className="mx-auto grid h-16 max-w-[1240px] grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:px-8">
        <Link
          to="/home"
          className="group inline-flex items-center gap-2.5 justify-self-start text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
            <img
              src="/progmiscon-logo.png"
              alt=""
              className="h-full w-full scale-[1.4] object-cover contrast-200"
            />
          </span>
          <span className="text-[15px] font-bold text-navy-deep transition-colors group-hover:text-brand">
            Progmiscon
          </span>
        </Link>

        <div className="hidden justify-self-center md:block">
          <NavTabs />
        </div>

        <div className="hidden items-center gap-2 justify-self-end md:flex">
          <LanguageToggle />
          {isLecturer ? (
            <details className="group relative">
              <summary className="inline-flex cursor-pointer list-none items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-semibold text-navy transition-colors hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-soft text-brand">
                  <UserRound size={14} strokeWidth={2} aria-hidden="true" />
                </span>
                {lecturerFirstName}
                <ChevronDown
                  size={13}
                  aria-hidden="true"
                  className="text-muted transition-transform group-open:rotate-180"
                />
              </summary>
              <div className="absolute right-0 top-full z-30 mt-2 w-72 rounded-lg border border-border bg-white p-1.5 shadow-[0_16px_40px_rgba(33,29,27,0.12)]">
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
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-navy-deep transition-colors hover:border-brand/35 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <UserRound size={14} strokeWidth={2} aria-hidden="true" />
              {language === "id" ? "Akun Dosen" : "Lecturer Account"}
            </Link>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMenuOpen((current) => !current)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav-panel"
          aria-label={
            menuOpen
              ? language === "id"
                ? "Tutup menu"
                : "Close menu"
              : language === "id"
                ? "Buka menu"
                : "Open menu"
          }
          className="inline-flex h-10 w-10 cursor-pointer items-center justify-center justify-self-end rounded-md text-navy-deep transition-colors hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand md:hidden"
        >
          {menuOpen ? <X size={20} strokeWidth={2} aria-hidden="true" /> : <Menu size={20} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>

      <div
        id="mobile-nav-panel"
        inert={!menuOpen}
        className={cn(
          "overflow-hidden border-t border-border bg-white transition-[max-height] duration-300 ease-out md:hidden",
          menuOpen ? "max-h-[85vh] overflow-y-auto" : "max-h-0",
        )}
      >
        <nav className="flex flex-col px-4 py-2" aria-label={language === "id" ? "Navigasi utama" : "Main navigation"}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/home"}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 items-center rounded-md px-3 text-[15px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  isActive ? "text-brand" : "text-navy-deep hover:bg-neutral",
                )
              }
            >
              {t(link.label, language)}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-4">
          {isLecturer ? (
            <div>
              <div className="px-1">
                <p className="truncate text-sm font-bold text-navy-deep">{lecturerName}</p>
                {profile?.email && <p className="mt-0.5 truncate text-xs text-muted">{profile.email}</p>}
              </div>
              <div className="mt-3 flex flex-col gap-1">
                <Link
                  to="/review/riwayat"
                  className="flex min-h-12 items-center gap-2.5 rounded-md px-3 text-sm font-semibold text-navy-deep hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <History size={16} strokeWidth={2} aria-hidden="true" />
                  {language === "id" ? "Riwayat Review Saya" : "My Review History"}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void logout().catch((error) => {
                      console.error("[Progmiscon] Logout gagal", error);
                    });
                  }}
                  className="flex min-h-12 cursor-pointer items-center gap-2.5 rounded-md px-3 text-left text-sm font-semibold text-navy-deep hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <LogOut size={16} strokeWidth={2} aria-hidden="true" />
                  {language === "id" ? "Keluar" : "Logout"}
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/dosen/login"
              className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-border text-sm font-semibold text-navy-deep hover:border-brand/35 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <UserRound size={16} strokeWidth={2} aria-hidden="true" />
              {language === "id" ? "Akun Dosen" : "Lecturer Account"}
            </Link>
          )}

          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">
              {language === "id" ? "Bahasa" : "Language"}
            </span>
            <LanguageToggle />
          </div>
        </div>
      </div>
    </header>
  );
}
