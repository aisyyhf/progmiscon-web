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
    <nav className="flex items-center gap-5 md:gap-8">
      {visibleLinks.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/home" || link.to === "/review"}
          className={({ isActive }) =>
            cn(
              "border-b-2 py-1 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-gold",
              isActive
                ? "border-gold text-navy-deep"
                : "border-transparent text-muted hover:border-gold/50 hover:text-navy-deep",
            )
          }
        >
          {t(link.label, language)}
        </NavLink>
      ))}
    </nav>
  );
}
