import { NavLink } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useLecturerAuth } from "../../hooks/useLecturerAuth";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";

const links = [
  { to: "/home", label: uiText.navHome },
  { to: "/materi", label: uiText.navMateri },
  { to: "/konsep", label: uiText.navKonsep },
  { to: "/miskonsepsi", label: uiText.navMiskonsepsi },
];

export function NavTabs() {
  const { language } = useLanguage();
  const { isLecturer } = useLecturerAuth();
  const visibleLinks = isLecturer ? [...links, { to: "/review", label: uiText.navReview }] : links;

  return (
    <nav className="flex w-max min-w-full items-center justify-center gap-0.5 whitespace-nowrap">
      {visibleLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/home" || link.to === "/review"}
          className={({ isActive }) =>
            cn(
              "rounded-md px-2 py-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-2.5 md:px-3 md:text-sm",
              isActive
                ? "bg-brand-soft text-brand"
                : "text-muted hover:bg-neutral hover:text-navy-deep",
            )
          }
        >
          {t(link.label, language)}
        </NavLink>
      ))}
    </nav>
  );
}
