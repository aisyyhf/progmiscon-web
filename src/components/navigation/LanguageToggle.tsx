import { useLanguage } from "../../hooks/useLanguage";
import { cn } from "../../utils/cn";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center rounded-lg bg-neutral p-0.5 text-xs font-semibold">
      {(["id", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={language === option}
          onClick={() => setLanguage(option)}
          className={cn(
            "cursor-pointer rounded-[4px] px-2.5 py-1.5 uppercase transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            language === option ? "bg-white text-navy shadow-sm" : "text-muted hover:text-navy-deep",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
