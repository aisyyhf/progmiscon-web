import { NavLink } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { useNavLinks } from "./useNavLinks";

export function NavTabs() {
  const { language } = useLanguage();
  const links = useNavLinks();

  return (
    <nav className="flex w-max items-center justify-center gap-1 whitespace-nowrap">
      {links.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.to === "/home"}
          className={({ isActive }) =>
            cn(
              "relative rounded-md px-2.5 py-2 text-[13px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:px-3 md:text-sm",
              isActive
                ? "text-brand after:absolute after:inset-x-2.5 after:-bottom-[1px] after:h-[2px] after:rounded-full after:bg-brand after:content-['']"
                : "text-muted hover:text-navy-deep",
            )
          }
        >
          {t(link.label, language)}
        </NavLink>
      ))}
    </nav>
  );
}
