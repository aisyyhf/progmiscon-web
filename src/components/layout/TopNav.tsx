import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { NavTabs } from "../navigation/NavTabs";
import { useNavLinks } from "../navigation/useNavLinks";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";

export function TopNav() {
  const { language } = useLanguage();
  const location = useLocation();
  const links = useNavLinks(true);
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

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-[var(--progmiscon-background)]/95 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-7 xl:gap-9">
          <Link
            to="/"
            aria-label="Progmiscon"
            className="group inline-flex shrink-0 items-center gap-2.5 text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
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
          <div className="hidden lg:block">
            <NavTabs publicOnly />
          </div>
        </div>

        <Link
          to="/dosen/login"
          className="ml-auto hidden min-h-9 items-center justify-center whitespace-nowrap rounded-md bg-brand px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:inline-flex"
        >
          {t(uiText.navLecturerLogin, language)}
        </Link>

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
          className="ml-auto inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md text-black transition-colors hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand lg:hidden"
        >
          {menuOpen ? (
            <X size={20} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Menu size={20} strokeWidth={2} aria-hidden="true" />
          )}
        </button>
      </div>

      <div
        id="mobile-nav-panel"
        inert={!menuOpen}
        className={cn(
          "overflow-hidden border-t border-border bg-[var(--progmiscon-background)] transition-[max-height] duration-300 ease-out lg:hidden",
          menuOpen
            ? "max-h-[calc(100dvh-4rem)] overflow-y-auto"
            : "max-h-0",
        )}
      >
        <nav
          className="flex flex-col px-4 py-2"
          aria-label={language === "id" ? "Navigasi utama" : "Main navigation"}
        >
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) =>
                cn(
                  "flex min-h-12 items-center rounded-md px-3 text-[15px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  isActive ? "text-brand" : "text-black hover:bg-neutral",
                )
              }
            >
              {t(link.label, language)}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border px-4 py-4">
          <Link
            to="/dosen/login"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {t(uiText.navLecturerLogin, language)}
          </Link>
        </div>
      </div>
    </header>
  );
}
