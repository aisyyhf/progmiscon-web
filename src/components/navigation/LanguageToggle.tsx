import { useLanguage } from "../../hooks/useLanguage";
import { cn } from "../../utils/cn";

export function LanguageToggle() {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className="fixed bottom-3 right-3 z-40 inline-flex items-center rounded-full border border-border bg-white/95 p-0.5 text-[11px] font-semibold shadow-[0_4px_14px_rgba(33,29,27,0.1)] backdrop-blur sm:bottom-4 sm:right-4"
      role="group"
      aria-label={language === "id" ? "Pilih bahasa" : "Choose language"}
    >
      {(["id", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={language === option}
          onClick={() => setLanguage(option)}
          className={cn(
            "min-h-7 cursor-pointer rounded-full px-2.5 py-1 uppercase transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            language === option ? "bg-brand text-white" : "text-muted hover:text-navy-deep",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
