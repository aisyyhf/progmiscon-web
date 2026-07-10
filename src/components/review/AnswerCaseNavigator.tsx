import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";

export function answerCaseLabel(index: number, language: "id" | "en") {
  const number = String(index + 1).padStart(2, "0");
  return language === "id" ? `Case ${number}` : `Case ${number}`;
}

export function AnswerCaseNavigator({
  caseIds,
  selectedCaseId,
  onSelectCase,
  getCaseIndex,
}: {
  caseIds: string[];
  selectedCaseId: string;
  onSelectCase: (caseId: string) => void;
  getCaseIndex: (caseId: string) => number;
}) {
  const { language } = useLanguage();
  const indexInFiltered = caseIds.indexOf(selectedCaseId);
  const previousId = indexInFiltered > 0 ? caseIds[indexInFiltered - 1] : undefined;
  const nextId = indexInFiltered >= 0 && indexInFiltered < caseIds.length - 1 ? caseIds[indexInFiltered + 1] : undefined;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => previousId && onSelectCase(previousId)}
        disabled={!previousId}
        className="cursor-pointer rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-navy-deep transition hover:-translate-y-px hover:border-navy/50 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-0"
        aria-label={t(uiText.previous, language)}
      >
        {t(uiText.previous, language)}
      </button>

      <select
        aria-label={t(uiText.selectAnswerCase, language)}
        value={selectedCaseId}
        onChange={(event) => onSelectCase(event.target.value)}
        className="cursor-pointer rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-navy-deep transition hover:border-navy/50 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        {caseIds.map((id) => (
          <option key={id} value={id}>
            {answerCaseLabel(getCaseIndex(id), language)}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => nextId && onSelectCase(nextId)}
        disabled={!nextId}
        className="cursor-pointer rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-navy-deep transition hover:-translate-y-px hover:border-navy/50 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-0"
        aria-label={t(uiText.next, language)}
      >
        {t(uiText.next, language)}
      </button>

      <span className="text-sm text-muted sm:ml-auto">
        {indexInFiltered + 1} / {caseIds.length}
      </span>
    </div>
  );
}
