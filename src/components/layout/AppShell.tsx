import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { TopNav } from "./TopNav";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { language } = useLanguage();

  return (
    <div className="app-frame">
      <a
        href="#main-content"
        className="sr-only z-30 bg-white px-4 py-2 text-sm font-semibold text-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {language === "id" ? "Lewati navigasi" : "Skip navigation"}
      </a>
      <TopNav />
      <main id="main-content" className="mx-auto max-w-[1240px] px-4 py-6 sm:px-6 md:py-9 lg:px-8">
        <div key={location.pathname} className="route-frame">
          {children}
        </div>
      </main>
    </div>
  );
}
