import { ArrowRight, ClipboardCheck, History } from "lucide-react";
import { Link } from "react-router-dom";
import { useLanguage } from "../hooks/useLanguage";
import { useLecturerAuth } from "../hooks/useLecturerAuth";

export function LecturerDashboardPage() {
  const { language } = useLanguage();
  const { profile } = useLecturerAuth();
  const isIndonesian = language === "id";

  return (
    <div className="mx-auto max-w-4xl">
      <header className="border-b border-border pb-6">
        <h1 className="page-title">
          {isIndonesian ? "Dashboard Dosen" : "Lecturer Dashboard"}
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted sm:text-base">
          {isIndonesian
            ? `Selamat datang${profile?.fullName ? `, ${profile.fullName}` : ""}. Pilih ruang kerja yang ingin dibuka.`
            : `Welcome${profile?.fullName ? `, ${profile.fullName}` : ""}. Choose the workspace you want to open.`}
        </p>
      </header>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          to="/review"
          className="surface-card-hover group flex min-h-40 flex-col p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <ClipboardCheck
            size={24}
            strokeWidth={1.8}
            aria-hidden="true"
            className="text-brand"
          />
          <h2 className="mt-5 text-lg font-bold text-navy-deep">Review</h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {isIndonesian
              ? "Tinjau soal dan jawaban berdasarkan minggu."
              : "Review questions and answers by week."}
          </p>
          <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-brand">
            {isIndonesian ? "Buka Review" : "Open Review"}
            <ArrowRight
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            />
          </span>
        </Link>

        <Link
          to="/review/riwayat"
          className="surface-card-hover group flex min-h-40 flex-col p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <History
            size={24}
            strokeWidth={1.8}
            aria-hidden="true"
            className="text-brand"
          />
          <h2 className="mt-5 text-lg font-bold text-navy-deep">
            {isIndonesian ? "Riwayat" : "History"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            {isIndonesian
              ? "Lihat hasil review yang sudah Anda simpan."
              : "View the reviews you have already saved."}
          </p>
          <span className="mt-auto inline-flex items-center gap-2 pt-5 text-sm font-semibold text-brand">
            {isIndonesian ? "Buka Riwayat" : "Open History"}
            <ArrowRight
              size={16}
              strokeWidth={2}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            />
          </span>
        </Link>
      </div>
    </div>
  );
}
