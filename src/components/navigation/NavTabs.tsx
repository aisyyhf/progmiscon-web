import { NavLink } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { useNavLinks } from "./useNavLinks";

export function NavTabs({ publicOnly = false }: { publicOnly?: boolean }) {
  const { language } = useLanguage();
  const links = useNavLinks(publicOnly);

  return (
    <nav
      className={cn(
        "flex w-max items-center gap-1 whitespace-nowrap",
        !publicOnly && "justify-center",
      )}
      aria-label={language === "id" ? "Navigasi utama" : "Main navigation"}
    >
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
              "relative rounded-md px-2.5 py-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              publicOnly
                ? "text-sm font-medium"
                : "text-[13px] font-semibold sm:px-3 md:text-sm",
              isActive
                ? publicOnly
                  ? "text-brand after:absolute after:inset-x-2.5 after:-bottom-[1px] after:h-px after:bg-brand after:content-['']"
                  : "text-brand after:absolute after:inset-x-2.5 after:-bottom-[1px] after:h-[2px] after:rounded-full after:bg-brand after:content-['']"
                : publicOnly
                  ? "text-black/70 hover:text-black"
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
