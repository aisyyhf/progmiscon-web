import { Menu } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { cn } from "../../utils/cn";
import { LecturerSidebar } from "./LecturerSidebar";

export const LECTURER_SIDEBAR_STORAGE_KEY =
  "progmiscon.lecturer.sidebar.v1";

function getInitialCollapsedState(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const stored = window.localStorage.getItem(LECTURER_SIDEBAR_STORAGE_KEY);
    if (stored === "collapsed") return true;
    if (stored === "expanded") return false;
    if (stored !== null) return false;
    return window.matchMedia(
      "(min-width: 768px) and (max-width: 1023px)",
    ).matches;
  } catch {
    return false;
  }
}

function lecturerContentClass(pathname: string, search: string): string {
  if (pathname === "/materi") {
    return "mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1240px] flex-1 px-4 py-4 sm:px-6 lg:px-8";
  }

  if (pathname.startsWith("/question/")) {
    return "mx-auto w-full max-w-[1440px] flex-1 px-4 pb-0 pt-6 sm:px-6 md:pt-9 lg:px-8";
  }

  if (pathname === "/review") {
    const reviewSearch = new URLSearchParams(search);
    if (reviewSearch.has("item")) {
      return "mx-auto w-full max-w-[1440px] flex-1 px-4 pb-9 pt-3 sm:px-6 md:pt-4 lg:px-8";
    }
    if (reviewSearch.has("week") && !reviewSearch.has("item")) {
      return "mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 md:pb-9 md:pt-4 lg:px-8";
    }
  }

  return "mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 md:py-9 lg:px-8";
}

export function LecturerLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { language } = useLanguage();
  const [collapsed, setCollapsed] = useState(getInitialCollapsedState);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isIndonesian = language === "id";

  useEffect(() => {
    try {
      window.localStorage.setItem(
        LECTURER_SIDEBAR_STORAGE_KEY,
        collapsed ? "collapsed" : "expanded",
      );
    } catch {
      // Local preference persistence is optional when storage is unavailable.
    }
  }, [collapsed]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [drawerOpen]);

  return (
    <div className="lecturer-shell flex min-h-dvh bg-bg">
      <div
        className={cn(
          "lecturer-sidebar-width sticky top-0 z-30 hidden h-dvh shrink-0 overflow-visible md:block",
          collapsed ? "w-[72px]" : "w-52",
        )}
      >
        <LecturerSidebar
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="lecturer-ui sticky top-0 z-20 flex h-14 items-center border-b border-border bg-white/95 px-4 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-expanded={drawerOpen}
            aria-controls="lecturer-mobile-drawer"
            aria-label={
              isIndonesian ? "Buka navigasi dosen" : "Open lecturer navigation"
            }
            className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-navy-deep hover:bg-neutral focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Menu size={20} strokeWidth={1.9} aria-hidden="true" />
          </button>
          <Link
            to="/dashboard"
            className="ml-2 inline-flex items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white">
              <img
                src="/progmiscon-logo.png"
                alt=""
                className="h-full w-full scale-[1.4] object-cover contrast-200"
              />
            </span>
            <span className="text-[15px] font-semibold tracking-[-0.01em]">
              <span className="text-brand">Prog</span>
              <span className="text-navy-deep">miscon</span>
            </span>
          </Link>
        </header>

        <main
          id="main-content"
          className={lecturerContentClass(location.pathname, location.search)}
        >
          <div key={location.pathname} className="route-frame">
            {children}
          </div>
        </main>
      </div>

      <div
        id="lecturer-mobile-drawer"
        inert={!drawerOpen}
        className={cn(
          "fixed inset-0 z-40 md:hidden",
          drawerOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label={isIndonesian ? "Tutup navigasi" : "Close navigation"}
          onClick={() => setDrawerOpen(false)}
          className={cn(
            "lecturer-mobile-overlay absolute inset-0 cursor-default bg-navy-deep/30",
            drawerOpen ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          className={cn(
            "lecturer-mobile-panel absolute inset-y-0 left-0 bg-white shadow-[12px_0_32px_rgba(55,44,39,0.14)]",
            drawerOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <LecturerSidebar
            mobile
            onClose={() => setDrawerOpen(false)}
            onNavigate={() => setDrawerOpen(false)}
          />
        </div>
      </div>
    </div>
  );
}
