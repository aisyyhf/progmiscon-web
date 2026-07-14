import { useLanguage } from "../../hooks/useLanguage";

export function QuestionRow({
  metaItems,
  promptPreview,
  misconceptionCount,
  onClick,
}: {
  metaItems: string[];
  promptPreview: string;
  misconceptionCount?: number;
  onClick: () => void;
}) {
  const { language } = useLanguage();

  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-md border border-transparent px-4 py-3.5 text-left transition hover:-translate-y-px hover:border-navy/25 hover:bg-bg/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-0"
      >
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{metaItems.join(" · ")}</p>
          <p className="mt-1 truncate text-sm text-navy-deep">{promptPreview}</p>
        </div>
        {typeof misconceptionCount === "number" && (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-navy/15 bg-bg px-2.5 py-1 text-[11px] text-muted">
            {misconceptionCount} {language === "id" ? "miskonsepsi" : "misconceptions"}
          </span>
        )}
      </button>
    </li>
  );
}
