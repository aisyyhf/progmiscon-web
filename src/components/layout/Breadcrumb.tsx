import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";

export type BreadcrumbItem = {
  label: string;
  to?: string;
};

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  const navigate = useNavigate();
  const { language } = useLanguage();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-sm text-navy-deep transition-colors hover:border-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
      >
        <span aria-hidden="true">←</span>
        {t(uiText.back, language)}
      </button>
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        {items.map((item, index) => (
          <Fragment key={`${item.label}-${index}`}>
            {index > 0 && <span className="mx-2" aria-hidden="true">/</span>}
            {item.to ? (
              <button
                type="button"
                onClick={() => navigate(item.to as string)}
                className="cursor-pointer underline-offset-2 hover:text-navy-deep hover:underline"
              >
                {item.label}
              </button>
            ) : (
              <span className="text-navy-deep">{item.label}</span>
            )}
          </Fragment>
        ))}
      </nav>
    </div>
  );
}
