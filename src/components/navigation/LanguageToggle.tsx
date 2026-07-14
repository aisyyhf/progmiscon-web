import { useLanguage } from "../../hooks/useLanguage";
import { cn } from "../../utils/cn";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-full border border-border bg-white p-0.5 text-xs font-medium shadow-[0_1px_2px_rgba(30,41,59,0.04)]">
      {(["id", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={language === option}
          onClick={() => setLanguage(option)}
          className={cn(
            "cursor-pointer rounded-full px-2.5 py-1 uppercase transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
            language === option ? "bg-navy text-white" : "text-muted hover:bg-bg hover:text-navy-deep",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
