import { Link } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { useNavLinks } from "../navigation/useNavLinks";
import { t } from "../../utils/translation";

export function Footer() {
  const { language } = useLanguage();
  const links = useNavLinks().filter((link) => link.to !== "/home");

  return (
    <footer className="mt-12 border-t border-border bg-white">
      <div className="mx-auto max-w-[1240px] px-4 py-5 pb-14 sm:px-6 sm:py-5 lg:px-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex max-w-2xl flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Link
              to="/home"
              className="group inline-flex items-center gap-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white">
                <img
                  src="/progmiscon-logo.png"
                  alt=""
                  className="h-full w-full scale-[1.4] object-cover contrast-200"
                />
              </span>
              <span className="text-sm font-bold text-navy-deep transition-colors group-hover:text-brand">
                Progmiscon
              </span>
            </Link>
            <p className="text-xs leading-5 text-muted">
              {language === "id"
                ? "Eksplorasi soal, jawaban, konsep, dan miskonsepsi pemrograman dasar."
                : "Explore questions, answers, concepts, and misconceptions in introductory programming."}
            </p>
          </div>

          <nav
            aria-label={language === "id" ? "Tautan footer" : "Footer links"}
            className="flex flex-wrap gap-x-5 gap-y-2"
          >
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="text-xs font-medium text-muted transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {t(link.label, language)}
              </Link>
            ))}
            <Link
              to="/dosen/login"
              className="text-xs font-medium text-muted transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {language === "id" ? "Akun Dosen" : "Lecturer Account"}
            </Link>
          </nav>
        </div>

        <div className="mt-4 flex flex-col gap-1 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between sm:pr-20">
          <p className="text-xs text-muted">© 2026 Progmiscon</p>
          <p className="text-xs text-muted/80">
            {language === "id"
              ? "Dikembangkan untuk kebutuhan akademik."
              : "Developed for academic purposes."}
          </p>
        </div>
      </div>
    </footer>
  );
}
