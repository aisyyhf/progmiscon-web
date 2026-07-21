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
        className="flex w-full cursor-pointer items-start justify-between gap-4 rounded-md border border-transparent px-4 py-3.5 text-left transition hover:-translate-y-px hover:border-navy/25 hover:bg-bg/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-0"
      >
        <div className="min-w-0">
          <p className="text-xs font-semibold text-brand">{metaItems.join(" / ")}</p>
          <p className="mt-1 line-clamp-2 text-[13px] font-normal leading-6 text-navy-deep">{promptPreview}</p>
        </div>
        {typeof misconceptionCount === "number" && (
          <span className="shrink-0 whitespace-nowrap rounded-md bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
            {misconceptionCount} {language === "id" ? "miskonsepsi" : "misconceptions"}
          </span>
        )}
      </button>
    </li>
  );
}
