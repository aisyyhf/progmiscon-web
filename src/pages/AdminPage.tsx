import { useState } from "react";
import {
  Download,
  FileQuestion,
  History,
  MessageSquareText,
  ShieldCheck,
} from "lucide-react";
import { EmptyState } from "../components/common/EmptyState";
import { useLanguage } from "../hooks/useLanguage";
import { cn } from "../utils/cn";

type AdminTab = "history" | "downloads";

export function AdminPage() {
  const { language } = useLanguage();
  const [tab, setTab] = useState<AdminTab>("history");

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-8 flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <ShieldCheck size={23} strokeWidth={2} aria-hidden="true" />
        </span>

        <div>
          <h1 className="page-title">Admin Progmiscon</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            {language === "id"
              ? "Ruang baca untuk memantau riwayat review dosen dan menyiapkan unduhan data akademik."
              : "A read-only workspace for monitoring lecturer reviews and preparing academic data downloads."}
          </p>
        </div>
      </header>

      <section className="workspace-sheet" aria-labelledby="admin-summary-title">
        <div className="workspace-section">
          <h2 id="admin-summary-title" className="text-base font-bold text-navy-deep">
            {language === "id" ? "Ringkasan" : "Summary"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {language === "id"
              ? "Jumlah review akan ditampilkan setelah integrasi data pada tahap berikutnya."
              : "Review totals will appear after data integration in the next stage."}
          </p>
        </div>

        <dl className="grid sm:grid-cols-2">
          <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <FileQuestion size={17} strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-semibold text-muted">
                {language === "id" ? "Review soal" : "Question reviews"}
              </dt>
              <dd className="mt-0.5 text-sm font-bold text-navy-deep">
                {language === "id" ? "Menunggu integrasi data" : "Awaiting data integration"}
              </dd>
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-border px-5 py-4 sm:border-l sm:border-t-0 sm:px-6">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
              <MessageSquareText size={17} strokeWidth={2} aria-hidden="true" />
            </span>
            <div>
              <dt className="text-xs font-semibold text-muted">
                {language === "id" ? "Review jawaban" : "Answer reviews"}
              </dt>
              <dd className="mt-0.5 text-sm font-bold text-navy-deep">
                {language === "id" ? "Menunggu integrasi data" : "Awaiting data integration"}
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <div
        className="mt-7 grid grid-cols-2 gap-1 rounded-lg border border-border bg-neutral p-1 sm:w-fit"
        role="tablist"
        aria-label={language === "id" ? "Menu Admin" : "Admin menu"}
      >
        <button
          id="admin-tab-history"
          type="button"
          role="tab"
          aria-selected={tab === "history"}
          aria-controls="admin-panel-history"
          onClick={() => setTab("history")}
          className={cn(
            "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-w-44",
            tab === "history"
              ? "bg-white text-brand shadow-sm"
              : "text-muted hover:bg-white/60 hover:text-navy-deep",
          )}
        >
          <History size={17} strokeWidth={2} aria-hidden="true" />
          {language === "id" ? "Riwayat Review" : "Review History"}
        </button>

        <button
          id="admin-tab-downloads"
          type="button"
          role="tab"
          aria-selected={tab === "downloads"}
          aria-controls="admin-panel-downloads"
          onClick={() => setTab("downloads")}
          className={cn(
            "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:min-w-44",
            tab === "downloads"
              ? "bg-white text-brand shadow-sm"
              : "text-muted hover:bg-white/60 hover:text-navy-deep",
          )}
        >
          <Download size={17} strokeWidth={2} aria-hidden="true" />
          {language === "id" ? "Unduh Data" : "Download Data"}
        </button>
      </div>

      {tab === "history" ? (
        <section
          id="admin-panel-history"
          role="tabpanel"
          aria-labelledby="admin-tab-history"
          className="mt-5"
        >
          <EmptyState
            message={
              language === "id"
                ? "Riwayat review seluruh dosen belum dimuat pada tahap ini."
                : "Review history for all lecturers is not loaded in this stage yet."
            }
          />
        </section>
      ) : (
        <section
          id="admin-panel-downloads"
          role="tabpanel"
          aria-labelledby="admin-tab-downloads"
          className="mt-5"
        >
          <EmptyState
            message={
              language === "id"
                ? "Unduhan raw review dan relasi miskonsepsi akan tersedia pada tahap berikutnya."
                : "Raw review and misconception relation downloads will be available in the next stage."
            }
          />
        </section>
      )}
    </div>
  );
}
