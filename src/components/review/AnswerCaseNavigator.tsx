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

  return (
    <nav
      aria-label={language === "id" ? "Navigasi variasi jawaban" : "Answer variation navigation"}
      className="inline-flex shrink-0 items-center gap-1"
    >
      <button
        type="button"
        onClick={() => previousId && onSelectCase(previousId)}
        disabled={!previousId}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-white text-muted transition-colors hover:border-brand/35 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-label={t(uiText.previous, language)}
        title={t(uiText.previous, language)}
      >
        <ChevronLeft size={15} strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{t(uiText.previous, language)}</span>
      </button>

      <button
        type="button"
        onClick={() => nextId && onSelectCase(nextId)}
        disabled={!nextId}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-white text-muted transition-colors hover:border-brand/35 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        aria-label={t(uiText.next, language)}
        title={t(uiText.next, language)}
      >
        <ChevronRight size={15} strokeWidth={2} aria-hidden="true" />
        <span className="sr-only">{t(uiText.next, language)}</span>
      </button>
    </nav>
  );
}
