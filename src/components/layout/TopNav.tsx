import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import {
  ChevronDown,
  History,
  LogOut,
  Menu,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import { NavTabs } from "../navigation/NavTabs";
import { useNavLinks } from "../navigation/useNavLinks";
import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";

export function TopNav() {
  const { language } = useLanguage();
  const { isLecturer, isAdmin, profile, logout } = useLecturerAuth();
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

  const brandLink = (
    <Link
      to="/"
      className="group inline-flex items-center gap-2.5 text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
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

  if (location.pathname === "/") {
    return (
      <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex min-h-16 max-w-[1240px] flex-wrap items-center gap-3 px-4 py-2 sm:flex-nowrap sm:px-6 lg:px-8">
          {brandLink}
          <div className="order-2 flex w-full flex-col gap-2 min-[360px]:flex-row sm:order-none sm:ml-auto sm:w-auto">
            <Link
              to="/dosen/login"
              className="inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-none sm:px-4 sm:text-sm"
            >
              {language === "id" ? "Masuk sebagai Dosen" : "Lecturer Sign In"}
            </Link>
            <Link
              to="/materi"
              className="inline-flex min-h-10 flex-1 items-center justify-center whitespace-nowrap rounded-md border border-border bg-white px-3 py-2 text-xs font-semibold text-navy-deep transition-colors hover:border-brand/35 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:flex-none sm:px-4 sm:text-sm"
            >
              {language === "id"
                ? "Jelajahi sebagai Pengunjung"
                : "Explore as a Visitor"}
            </Link>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur-md">
      <div className="relative mx-auto flex h-16 max-w-[1240px] items-center gap-4 px-4 sm:px-6 lg:px-8">
        {brandLink}

        <div className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
          <NavTabs />
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:flex">
          {isLecturer && (
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

                  {isAdmin && (
                    <Link
                      to="/admin"
                      className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-xs font-semibold text-muted transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                    >
                      <ShieldCheck size={14} strokeWidth={2} aria-hidden="true" />
                      Admin Progmiscon
                    </Link>
                  )}

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
          className="ml-auto inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-navy-deep transition-colors hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
        >
          {menuOpen ? <X size={20} strokeWidth={2} aria-hidden="true" /> : <Menu size={20} strokeWidth={2} aria-hidden="true" />}
        </button>
      </div>

      <div
        id="mobile-nav-panel"
        inert={!menuOpen}
        className={cn(
          "overflow-hidden border-t border-border bg-white transition-[max-height] duration-300 ease-out lg:hidden",
          menuOpen ? "max-h-[85vh] overflow-y-auto" : "max-h-0",
        )}
      >
        <nav className="flex flex-col px-4 py-2" aria-label={language === "id" ? "Navigasi utama" : "Main navigation"}>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={
                link.to === "/dashboard" ||
                link.to === "/review" ||
                link.to === "/review/riwayat"
              }
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

        {isLecturer && (
          <div className="border-t border-border px-4 py-4">
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
                {isAdmin && (
                  <Link
                    to="/admin"
                    className="flex min-h-12 items-center gap-2.5 rounded-md px-3 text-sm font-semibold text-navy-deep hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <ShieldCheck size={16} strokeWidth={2} aria-hidden="true" />
                    Admin Progmiscon
                  </Link>
                )}
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
          </div>
        )}
      </div>
    </header>
  );
}
