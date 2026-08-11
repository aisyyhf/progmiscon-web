import type { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { TopNav } from "./TopNav";
import { Footer } from "./Footer";
import { LanguageToggle } from "../navigation/LanguageToggle";

export function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { language } = useLanguage();
  const isAuthRoute = ["/dosen/login", "/dosen/daftar"].includes(
    location.pathname,
  );
  const isQuestionCatalog = location.pathname === "/materi";
  const isQuestionDetail = location.pathname.startsWith("/question/");

  return (
    <div
      className={
        isAuthRoute
          ? "app-frame flex min-h-dvh flex-col lg:h-dvh lg:min-h-0"
          : "app-frame flex min-h-dvh flex-col"
      }
    >
      <a
        href="#main-content"
        className="sr-only z-30 bg-white px-4 py-2 text-sm font-semibold text-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        {language === "id" ? "Lewati navigasi" : "Skip navigation"}
      </a>
      {!isAuthRoute && <TopNav />}
      <main
        id="main-content"
        className={
          isAuthRoute
            ? "w-full min-h-0 flex-1"
            : isQuestionCatalog
              ? "mx-auto min-h-[calc(100dvh-4rem)] w-full max-w-[1240px] flex-1 px-4 py-4 sm:px-6 lg:px-8"
              : isQuestionDetail
                ? "mx-auto w-full max-w-[1440px] flex-1 px-4 pb-0 pt-6 sm:px-6 md:pt-9"
              : "mx-auto w-full max-w-[1240px] flex-1 px-4 py-6 sm:px-6 md:py-9 lg:px-8"
        }
      >
        <div
          key={location.pathname}
          className={isAuthRoute ? "h-full min-h-0" : "route-frame"}
        >
          {children}
        </div>
      </main>
      {!isAuthRoute && <Footer compact={isQuestionDetail} />}
      <LanguageToggle />
    </div>
  );
}
