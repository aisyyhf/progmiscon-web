import { useLanguage } from "../../hooks/useLanguage";
import { cn } from "../../utils/cn";

export function LanguageToggle({
  placement = "bottom",
}: {
  placement?: "top" | "bottom";
}) {
  const { language, setLanguage } = useLanguage();
  const targetLanguage = language === "id" ? "en" : "id";

  return (
    <button
      type="button"
      onClick={() => setLanguage(targetLanguage)}
      aria-label={
        targetLanguage === "en"
          ? "Switch to English"
          : "Ganti ke Bahasa Indonesia"
      }
      className={cn(
        "fixed right-3 z-40 inline-flex h-8 w-9 cursor-pointer items-center justify-center rounded-md border border-border bg-white/95 text-[10px] font-bold uppercase tracking-[0.06em] text-navy-deep shadow-[0_4px_14px_rgba(33,29,27,0.1)] backdrop-blur transition-colors hover:border-brand/35 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:right-4",
        placement === "top" ? "top-3 sm:top-4" : "bottom-3 sm:bottom-4",
      )}
    >
      {targetLanguage.toUpperCase()}
    </button>
  );
}
