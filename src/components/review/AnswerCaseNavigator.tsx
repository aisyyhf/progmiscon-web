import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function answerCaseLabel(index: number, total: number, language: "id" | "en") {
  return language === "id" ? `Jawaban ${index + 1} dari ${total}` : `Answer ${index + 1} of ${total}`;
}

export function AnswerCaseNavigator({
  caseIds,
  selectedCaseId,
  onSelectCase,
}: {
  caseIds: string[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
}) {
  const { language } = useLanguage();
  const indexInFiltered = caseIds.indexOf(selectedCaseId);
  const previousId = indexInFiltered > 0 ? caseIds[indexInFiltered - 1] : undefined;
  const nextId = indexInFiltered >= 0 && indexInFiltered < caseIds.length - 1 ? caseIds[indexInFiltered + 1] : undefined;
  const label = answerCaseLabel(indexInFiltered, caseIds.length, language);

  return (
    <nav
      aria-label={language === "id" ? "Navigasi variasi jawaban" : "Answer variation navigation"}
      className="inline-grid h-9 shrink-0 grid-cols-[2.25rem_auto_2.25rem] items-stretch overflow-hidden rounded-full border border-brand/10 bg-brand-soft/70 text-muted"
    >
      <button
        type="button"
        onClick={() => previousId && onSelectCase(previousId)}
        disabled={!previousId}
        className="inline-flex cursor-pointer items-center justify-center border-r border-brand/10 transition-colors hover:bg-white/70 hover:text-brand disabled:cursor-not-allowed disabled:text-muted/30 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
        aria-label={t(uiText.previous, language)}
        title={t(uiText.previous, language)}
      >
        <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{t(uiText.previous, language)}</span>
      </button>

      <span
        className="flex min-w-[7.5rem] items-center justify-center px-3 text-[11px] font-bold leading-none tabular-nums text-navy-deep"
        aria-live="polite"
      >
        {label}
      </span>

      <button
        type="button"
        onClick={() => nextId && onSelectCase(nextId)}
        disabled={!nextId}
        className="inline-flex cursor-pointer items-center justify-center border-l border-brand/10 transition-colors hover:bg-white/70 hover:text-brand disabled:cursor-not-allowed disabled:text-muted/30 focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
        aria-label={t(uiText.next, language)}
        title={t(uiText.next, language)}
      >
        <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{t(uiText.next, language)}</span>
      </button>
    </nav>
  );
}
