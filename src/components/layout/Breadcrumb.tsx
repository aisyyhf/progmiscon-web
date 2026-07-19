import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
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
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-md bg-white px-3.5 py-2 text-sm font-semibold text-navy-deep shadow-sm transition-colors hover:bg-brand-soft hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ArrowLeft size={15} strokeWidth={2} aria-hidden="true" />
        {t(uiText.back, language)}
      </button>
      <nav aria-label="Breadcrumb" className="thin-scroll overflow-x-auto text-xs font-semibold text-muted">
        <div className="flex min-w-max items-center">
          {items.map((item, index) => (
            <Fragment key={`${item.label}-${index}`}>
              {index > 0 && <ChevronRight size={13} className="mx-1.5 text-slate-300" aria-hidden="true" />}
              {item.to ? (
                <button
                  type="button"
                  onClick={() => navigate(item.to as string)}
                  className="cursor-pointer hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {item.label}
                </button>
              ) : (
                <span className="text-navy-deep">{item.label}</span>
              )}
            </Fragment>
          ))}
        </div>
      </nav>
    </div>
  );
}
