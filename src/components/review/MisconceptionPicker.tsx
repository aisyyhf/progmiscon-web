import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ListPlus, Search, X } from "lucide-react";
import type { Misconception } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { matchesMisconceptionSearch, misconceptionLabel } from "../../utils/misconceptionLabel";
import { toggleMisconceptionSelection } from "../../utils/reviewMisconceptionForm";
import { Button } from "../common/Button";

export function MisconceptionPicker({
  misconceptions,
  recommended,
  value,
  onChange,
  label,
  helper,
  variant = "decision",
}: {
  misconceptions: Misconception[];
  recommended: Misconception[];
  value: string[];
  onChange: (misconceptionIds: string[]) => void;
  label?: string;
  helper?: string;
  variant?: "decision" | "selection";
}) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"recommended" | "all">("recommended");
  const [query, setQuery] = useState("");
  const [previewId, setPreviewId] = useState("");

  const selectedIds = useMemo(() => new Set(value), [value]);
  const recommendedIds = useMemo(() => new Set(recommended.map((item) => item.id)), [recommended]);
  const selectedExtras = useMemo(
    () => misconceptions.filter((item) => selectedIds.has(item.id) && !recommendedIds.has(item.id)),
    [misconceptions, recommendedIds, selectedIds],
  );
  const displayedItems = useMemo(
    () =>
      variant === "selection"
        ? misconceptions.filter((item) => selectedIds.has(item.id))
        : [...recommended, ...selectedExtras],
    [misconceptions, recommended, selectedExtras, selectedIds, variant],
  );
  const preview = misconceptions.find((item) => item.id === previewId);
  const allByPriority = useMemo(
    () => [...recommended, ...misconceptions.filter((item) => !recommendedIds.has(item.id))],
    [misconceptions, recommended, recommendedIds],
  );
  const visibleItems = useMemo(() => {
    const source = view === "recommended" ? recommended : allByPriority;
    return source.filter((item) => matchesMisconceptionSearch(item, query));
  }, [allByPriority, query, recommended, view]);

  useEffect(() => {
    if (!open) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousDocumentOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousDocumentOverflow;
    };
  }, [open]);

  const toggle = (misconceptionId: string) => {
    onChange(toggleMisconceptionSelection(value, misconceptionId));
  };

  const openPicker = () => {
    setView(recommended.length > 0 ? "recommended" : "all");
    setQuery("");
    setPreviewId(value[0] || recommended[0]?.id || misconceptions[0]?.id || "");
    setOpen(true);
  };

  return (
    <>
      <div>
        {variant !== "selection" && (
          <>
            <p className="text-sm font-bold text-navy-deep">
              {label ?? (language === "id" ? "Keputusan miskonsepsi" : "Misconception decisions")}
            </p>
            <p className="mt-1 text-xs leading-5 text-muted">
              {helper ??
                (language === "id"
                  ? "Tentukan keputusan untuk setiap kandidat. Anda dapat menyetujui lebih dari satu miskonsepsi."
                  : "Decide on each candidate. You may approve more than one misconception.")}
            </p>
          </>
        )}

        {displayedItems.length > 0 && (
          <ul className="mt-3 space-y-2">
            {displayedItems.map((item) => {
              const selected = selectedIds.has(item.id);
              if (variant === "selection") {
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      aria-label={`${language === "id" ? "Hapus" : "Remove"} ${misconceptionLabel(item, language)}`}
                      onClick={() => toggle(item.id)}
                      className="flex w-full cursor-pointer items-start gap-2 rounded-md border border-brand/20 bg-brand-soft/35 px-2.5 py-2 text-left text-navy-deep transition-colors hover:bg-brand-soft/55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-brand bg-brand text-white" aria-hidden="true">
                        <Check size={11} strokeWidth={2.5} />
                      </span>
                      <span className="text-xs font-normal leading-4">{misconceptionLabel(item, language)}</span>
                      <X size={13} className="ml-auto mt-0.5 shrink-0 text-muted" aria-hidden="true" />
                    </button>
                  </li>
                );
              }
              return (
                <li key={item.id} className="rounded-md border border-border bg-white p-3">
                  <p className="text-sm font-semibold leading-5 text-navy-deep">{misconceptionLabel(item, language)}</p>
                  <div
                    className="mt-3 grid grid-cols-2 gap-2"
                    role="group"
                    aria-label={`${language === "id" ? "Keputusan untuk" : "Decision for"} ${misconceptionLabel(item, language)}`}
                  >
                    <button
                      type="button"
                      aria-pressed={selected}
                      onClick={() => !selected && toggle(item.id)}
                      className={cn(
                        "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        selected
                          ? "border-correct-border bg-correct-bg text-correct"
                          : "border-border bg-white text-muted hover:bg-correct-bg/60 hover:text-correct",
                      )}
                    >
                      <Check size={14} strokeWidth={2.25} aria-hidden="true" />
                      {language === "id" ? "Setuju" : "Approve"}
                    </button>
                    <button
                      type="button"
                      aria-pressed={!selected}
                      onClick={() => selected && toggle(item.id)}
                      className={cn(
                        "inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        !selected
                          ? "border-brand/30 bg-brand-soft text-brand"
                          : "border-border bg-white text-muted hover:bg-brand-soft/60 hover:text-brand",
                      )}
                    >
                      <X size={14} strokeWidth={2.25} aria-hidden="true" />
                      {language === "id" ? "Tidak setuju" : "Reject"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <Button
          type="button"
          variant="secondary"
          className={cn(
            "mt-2 !min-h-8 justify-center !gap-2 !px-3 !py-1.5 !text-xs !font-normal",
            variant === "selection" ? "w-full" : "w-fit",
          )}
          onClick={openPicker}
        >
          {variant === "selection" ? (
            <ListPlus size={14} strokeWidth={2} aria-hidden="true" />
          ) : (
            <Search size={13} strokeWidth={2} aria-hidden="true" />
          )}
          {variant === "selection"
            ? language === "id"
              ? "Pilih Miskonsepsi yang Ditambahkan"
              : "Select Misconceptions to Add"
            : language === "id"
              ? "Cari miskonsepsi lain"
              : "Find another misconception"}
        </Button>

        {variant !== "selection" && value.length === 0 && (
          <p className="mt-3 rounded-md bg-neutral px-3 py-2 text-xs leading-5 text-muted">
            {language === "id"
              ? "Belum ada miskonsepsi yang disetujui. Validasi akan disimpan tanpa label miskonsepsi."
              : "No misconception has been approved. The validation will be saved without a misconception label."}
          </p>
        )}
      </div>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex h-dvh w-screen items-center justify-center overflow-hidden px-3 py-4 sm:px-4">
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
            className="academic-panel route-frame relative m-0 flex max-h-[88dvh] min-h-0 w-full max-w-[52rem] flex-col overflow-hidden shadow-[0_30px_80px_rgba(23,32,51,0.22)] md:max-h-[80dvh]"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-4 py-3">
              <div>
                <p className="academic-label text-brand">
                  {language === "id" ? "Validasi dosen" : "Lecturer validation"}
                </p>
                <h2 id="misconception-picker-title" className="mt-1 text-lg font-semibold text-navy-deep">
                  {language === "id" ? "Pilih miskonsepsi" : "Choose misconceptions"}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={language === "id" ? "Tutup" : "Close"}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-lg text-muted transition-colors hover:bg-bg hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span aria-hidden="true">{"\u00D7"}</span>
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto md:grid md:grid-cols-[minmax(280px,0.9fr)_minmax(0,1.1fr)] md:overflow-hidden">
              <div className="border-b border-border md:flex md:min-h-0 md:flex-col md:border-b-0 md:border-r">
                <div className="border-b border-border p-3">
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
                    className="academic-input px-3 py-2 text-sm placeholder:text-muted/65"
                  />
                  <div className="mt-3 grid grid-cols-2 rounded-md border border-border bg-bg p-0.5" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === "recommended"}
                      onClick={() => setView("recommended")}
                      className={cn(
                        "cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        view === "recommended" ? "bg-navy text-white shadow-sm" : "text-muted hover:bg-white hover:text-navy-deep",
                      )}
                    >
                      {language === "id" ? "Miskonsepsi Serupa" : "Similar Misconceptions"}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={view === "all"}
                      onClick={() => setView("all")}
                      className={cn(
                        "cursor-pointer rounded px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                        view === "all" ? "bg-navy text-white shadow-sm" : "text-muted hover:bg-white hover:text-navy-deep",
                      )}
                    >
                      {language === "id" ? "Semua Miskonsepsi" : "All Misconceptions"}
                    </button>
                  </div>
                </div>

                <div className="thin-scroll p-2 md:min-h-0 md:flex-1 md:overflow-y-auto">
                  {visibleItems.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-muted">
                      {language === "id" ? "Miskonsepsi tidak ditemukan." : "No misconceptions found."}
                    </p>
                  ) : (
                    <ul className="space-y-1">
                      {visibleItems.map((item) => {
                        const active = item.id === previewId;
                        const selected = selectedIds.has(item.id);
                        return (
                          <li key={item.id}>
                            <label
                              onClick={() => setPreviewId(item.id)}
                              className={cn(
                                "flex w-full cursor-pointer items-start gap-3 border-l-2 px-3 py-2 text-left text-sm leading-5 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand",
                                active
                                  ? "border-brand bg-brand-soft/70 text-navy-deep"
                                  : "border-transparent text-muted hover:bg-bg hover:text-navy-deep",
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggle(item.id)}
                                className="mt-0.5 h-4 w-4 shrink-0 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                              />
                              <span className="font-medium">{misconceptionLabel(item, language)}</span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>

              <div className="thin-scroll p-4 md:min-h-0 md:overflow-y-auto md:p-5">
                {preview ? (
                  <div>
                    <p className="academic-label">
                      {language === "id" ? "Ringkasan miskonsepsi" : "Misconception summary"}
                    </p>
                    <h3 className="mt-1 text-lg font-bold text-navy-deep">{misconceptionLabel(preview, language)}</h3>
                    <div className="mt-4 space-y-4">
                      <section>
                        <p className="academic-label">{language === "id" ? "Pola yang keliru" : "Incorrect pattern"}</p>
                        <p className="mt-1 whitespace-pre-line text-sm leading-6 text-navy-deep">{t(preview.wrong, language)}</p>
                      </section>
                      <section>
                        <p className="academic-label">{language === "id" ? "Penyebab umum" : "Common cause"}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{t(preview.cause, language)}</p>
                      </section>
                      <section>
                        <p className="academic-label">{language === "id" ? "Perbaikan" : "Correction"}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{t(preview.fix, language)}</p>
                      </section>
                    </div>
                    <Button
                      type="button"
                      variant={selectedIds.has(preview.id) ? "secondary" : "primary"}
                      className="mt-5 justify-center"
                      onClick={() => toggle(preview.id)}
                    >
                      {selectedIds.has(preview.id) ? (
                        language === "id" ? "Hapus dari pilihan" : "Remove from selection"
                      ) : (
                        <>
                          <Check size={15} strokeWidth={2} aria-hidden="true" />
                          {language === "id" ? "Tambahkan ke pilihan" : "Add to selection"}
                        </>
                      )}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted">
                    {language === "id"
                      ? "Pilih miskonsepsi untuk melihat penjelasan."
                      : "Select a misconception to view its explanation."}
                  </p>
                )}
              </div>
            </div>

            <footer className="flex shrink-0 justify-end border-t border-border px-4 py-2.5">
              <Button type="button" variant="primary" onClick={() => setOpen(false)}>
                {language === "id" ? "Selesai memilih" : "Finish selecting"}
              </Button>
            </footer>
          </section>
          </div>,
          document.body,
        )}
    </>
  );
}
