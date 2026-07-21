import { useMemo, useState } from "react";
import type { Category, Misconception } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { EmptyState } from "../common/EmptyState";
import { MisconceptionDetail } from "./MisconceptionDetail";

export function MisconceptionLibrary({
  categories,
  misconceptions,
  selectedMisconceptionId,
  onSelectMisconception,
  onSelectRelatedQuestion,
}: {
  categories: Category[];
  misconceptions: Misconception[];
  selectedMisconceptionId: string | undefined;
  onSelectMisconception: (misconceptionId: string) => void;
  onSelectRelatedQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    if (categoryFilter === "all") return misconceptions;
    return misconceptions.filter((m) => m.categoryId === categoryFilter);
  }, [misconceptions, categoryFilter]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setCategoryFilter("all")}
          aria-pressed={categoryFilter === "all"}
          className={cn(
            "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
            categoryFilter === "all"
              ? "border-navy bg-navy text-white"
              : "border-border bg-white text-muted hover:border-navy/35 hover:bg-bg hover:text-navy-deep",
          )}
        >
          {t(uiText.filterAll, language)}
        </button>
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            onClick={() => setCategoryFilter(category.id)}
            aria-pressed={categoryFilter === category.id}
            className={cn(
              "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
              categoryFilter === category.id
                ? "border-navy bg-navy text-white"
                : "border-border bg-white text-muted hover:border-navy/35 hover:bg-bg hover:text-navy-deep",
            )}
          >
            {t(category.name, language)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_1fr] lg:items-start">
        {filtered.length === 0 ? (
          <EmptyState message={t(uiText.noQuestions, language)} />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-white">
            {filtered.map((misconception) => {
              const category = categories.find((c) => c.id === misconception.categoryId);
              const active = misconception.id === selectedMisconceptionId;
              return (
                <li key={misconception.id}>
                  <button
                    type="button"
                    onClick={() => onSelectMisconception(misconception.id)}
                    aria-current={active}
                    className={cn(
                      "block w-full cursor-pointer px-4 py-3.5 text-left transition-colors",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                      active
                        ? "border-l-2 border-l-brand bg-brand-soft/45 text-navy-deep"
                        : "border-l-2 border-l-transparent hover:bg-bg",
                    )}
                  >
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">
                      {category ? t(category.name, language) : ""}
                    </p>
                    <p className="mt-1 text-sm font-medium text-navy-deep">
                      {t(misconception.title, language)}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted">{t(misconception.wrong, language)}</p>
                    {misconception.relatedQuestionIds.length > 0 && (
                      <p className="mt-1 text-[11px] text-muted">
                        {misconception.relatedQuestionIds.length}{" "}
                        {language === "id" ? "soal terkait" : "related questions"}
                      </p>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="rounded-lg border border-border bg-white p-6">
          {selectedMisconceptionId ? (
            <MisconceptionDetail
              misconceptionId={selectedMisconceptionId}
              onSelectRelatedMisconception={onSelectMisconception}
              onSelectRelatedQuestion={onSelectRelatedQuestion}
            />
          ) : (
            <EmptyState message={t(uiText.selectMisconceptionPrompt, language)} />
          )}
        </div>
      </div>
    </div>
  );
}
