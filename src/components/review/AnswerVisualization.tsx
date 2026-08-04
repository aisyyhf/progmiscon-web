import { useId, useState, type ReactNode } from "react";
import { ChevronDown, GitFork } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";

export function AnswerVisualization({ children }: { children?: ReactNode }) {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const contentId = useId();
  const hasAst = Boolean(children);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-neutral">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((open) => !open)}
        className="flex min-h-12 w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:px-5"
      >
        <GitFork size={18} strokeWidth={2} className="shrink-0 text-brand" aria-hidden="true" />
        <span className="min-w-0 text-sm font-bold text-navy-deep">
          {t(uiText.astStructure, language)}
        </span>
        <span className="ml-auto text-right text-xs font-medium text-muted sm:text-sm">
          {t(hasAst ? uiText.astAvailable : uiText.astUnavailable, language)}
        </span>
        <ChevronDown
          size={18}
          strokeWidth={2}
          className={`shrink-0 text-brand transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      <div
        id={contentId}
        hidden={!isOpen}
        className="border-t border-border bg-white px-4 py-5 sm:px-5"
      >
        {hasAst ? (
          children
        ) : (
          <p className="text-sm text-muted">{t(uiText.astUnavailableMessage, language)}</p>
        )}
      </div>
    </section>
  );
}
