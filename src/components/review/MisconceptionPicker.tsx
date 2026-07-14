import { useEffect, useMemo, useState } from "react";
import type { Misconception } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { Button } from "../common/Button";

export function MisconceptionPicker({
  misconceptions,
  recommended,
  value,
  onChange,
}: {
  misconceptions: Misconception[];
  recommended: Misconception[];
  value: string;
  onChange: (misconceptionId: string) => void;
}) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"recommended" | "all">("recommended");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState("");

  const selected = misconceptions.find((item) => item.id === value);
  const preview = misconceptions.find((item) => item.id === previewId);
  const recommendedIds = useMemo(() => new Set(recommended.map((item) => item.id)), [recommended]);
  const allByPriority = useMemo(
    () => [...recommended, ...misconceptions.filter((item) => !recommendedIds.has(item.id))],
    [misconceptions, recommended, recommendedIds],
  );
  const visibleItems = useMemo(() => {
    const source = view === "recommended" ? recommended : allByPriority;
    const normalizedQuery = query.trim().toLocaleLowerCase(language);
    if (!normalizedQuery) return source;
    return source.filter((item) => t(item.title, language).toLocaleLowerCase(language).includes(normalizedQuery));
  }, [allByPriority, language, query, recommended, view]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const openPicker = () => {
    setView(recommended.length > 0 ? "recommended" : "all");
    setQuery("");
    setPreviewId(value || recommended[0]?.id || misconceptions[0]?.id || "");
    setOpen(true);
  };

  return (
    <>
      <div>
        <p className="text-sm font-medium text-navy-deep">
          {language === "id" ? "Miskonsepsi yang lebih tepat" : "More appropriate misconception"}
        </p>
        <button
          type="button"
          onClick={openPicker}
          aria-haspopup="dialog"
          className="mt-2 flex w-full cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-bg px-3 py-2.5 text-left text-sm transition-colors hover:border-navy/35 hover:bg-white focus-visible:border-brand focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/20"
        >
          <span className={selected ? "min-w-0 truncate text-navy-deep" : "text-muted"}>
            {selected ? t(selected.title, language) : language === "id" ? "Pilih miskonsepsi" : "Choose misconception"}
          </span>
          <span aria-hidden="true" className="shrink-0 text-xs text-muted">
            {"\u25BE"}
          </span>
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
          <button
            type="button"
            aria-label={language === "id" ? "Tutup pemilih miskonsepsi" : "Close misconception picker"}
            className="absolute inset-0 cursor-default bg-navy-deep/40"
            onClick={() => setOpen(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="misconception-picker-title"
            className="relative flex max-h-[90vh] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-border bg-white shadow-xl"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-[11px] font-semibold uppercase text-brand">
                  {language === "id" ? "Review Dosen" : "Lecturer Review"}
                </p>
                <h2 id="misconception-picker-title" className="mt-1 font-serif-brand text-2xl font-semibold text-navy-deep">
                  {language === "id" ? "Pilih miskonsepsi" : "Choose a misconception"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={language === "id" ? "Tutup" : "Close"}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-lg text-muted transition-colors hover:bg-bg hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
              >
                <span aria-hidden="true">{"\u00D7"}</span>
              </button>
            </header>

            <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] md:overflow-hidden">
              <div className="flex min-h-0 flex-col border-b border-border md:border-b-0 md:border-r">
                <div className="border-b border-border p-4">
                  <label htmlFor="misconception-search" className="sr-only">
                    {language === "id" ? "Cari miskonsepsi" : "Search misconceptions"}
                  </label>
                  <input
                    id="misconception-search"
                    type="search"
                    autoFocus
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={language === "id" ? "Cari miskonsepsi..." : "Search misconceptions..."}
                    className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm text-navy-deep placeholder:text-muted/65 focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
                  />
                  <div className="mt-3 grid grid-cols-2 rounded-md border border-border bg-bg p-0.5" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === "recommended"}
                      onClick={() => setView("recommended")}
                      className={cn(
                        "cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                        view === "recommended" ? "bg-white text-brand shadow-sm" : "text-muted hover:text-navy-deep",
                      )}
                    >
                      {language === "id" ? `Disarankan (${recommended.length})` : `Recommended (${recommended.length})`}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === "all"}
                      onClick={() => setView("all")}
                      className={cn(
                        "cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold",
                        view === "all" ? "bg-white text-brand shadow-sm" : "text-muted hover:text-navy-deep",
                      )}
                    >
                      {language === "id" ? `Semua (${misconceptions.length})` : `All (${misconceptions.length})`}
                    </button>
                  </div>
                </div>

                <div className="max-h-64 overflow-y-auto p-2 md:max-h-none md:flex-1">
                  {visibleItems.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted">
                      {language === "id" ? "Miskonsepsi tidak ditemukan." : "No misconceptions found."}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {visibleItems.map((item) => {
                        const active = item.id === previewId;
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              onClick={() => setPreviewId(item.id)}
                              aria-pressed={active}
                              className={cn(
                                "w-full cursor-pointer border-l-2 px-3 py-2.5 text-left text-sm leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-gold",
                                active
                                  ? "border-brand bg-brand-soft text-navy-deep"
                                  : "border-transparent text-muted hover:bg-bg hover:text-navy-deep",
                              )}
                            >
                              <span className="font-medium">{t(item.title, language)}</span>
                              {item.id === value && (
                                <span className="mt-0.5 block text-xs text-brand">
                                  {language === "id" ? "Pilihan saat ini" : "Current selection"}
                                </span>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="min-h-0 overflow-y-auto p-5 md:p-6">
                {preview ? (
                  <div>
                    <p className="text-[11px] font-medium uppercase text-muted">
                      {language === "id" ? "Ringkasan miskonsepsi" : "Misconception summary"}
                    </p>
                    <h3 className="mt-1 font-serif-brand text-xl font-semibold text-navy-deep">
                      {t(preview.title, language)}
                    </h3>
                    <div className="mt-5 space-y-5">
                      <section>
                        <p className="text-[11px] font-medium uppercase text-muted">
                          {language === "id" ? "Pola yang keliru" : "Incorrect pattern"}
                        </p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-navy-deep">{t(preview.wrong, language)}</p>
                      </section>
                      <section>
                        <p className="text-[11px] font-medium uppercase text-muted">
                          {language === "id" ? "Penyebab umum" : "Common cause"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted">{t(preview.cause, language)}</p>
                      </section>
                      <section>
                        <p className="text-[11px] font-medium uppercase text-muted">
                          {language === "id" ? "Perbaikan" : "Correction"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-muted">{t(preview.fix, language)}</p>
                      </section>
                    </div>
                    <Button
                      type="button"
                      variant="primary"
                      className="mt-6 justify-center"
                      onClick={() => {
                        onChange(preview.id);
                        setOpen(false);
                      }}
                    >
                      {language === "id" ? "Pilih miskonsepsi ini" : "Choose this misconception"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    {language === "id" ? "Pilih miskonsepsi untuk melihat penjelasan." : "Select a misconception to view its explanation."}
                  </p>
                )}
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
