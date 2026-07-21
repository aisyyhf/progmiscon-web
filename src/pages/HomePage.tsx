import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  FileQuestion,
  MessageSquare,
  Search,
} from "lucide-react";
import { useCategories } from "../hooks/useCategories";
import { useLanguage } from "../hooks/useLanguage";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions } from "../hooks/useQuestions";
import { t, uiText } from "../utils/translation";

export function HomePage() {
  const { language } = useLanguage();
  const { categories } = useCategories();
  const { misconceptions } = useMisconceptions();
  const { questions } = useQuestions();

  const pages = [
    {
      to: "/materi",
      title: { id: "Materi", en: "Materials" },
      description: {
        id: "Mulai dari topik perkuliahan dan temukan soal beserta pola jawaban yang tersedia.",
        en: "Start with a course topic and find its questions and available answer patterns.",
      },
      action: language === "id" ? "Jelajahi materi" : "Explore materials",
      icon: BookOpen,
    },
    {
      to: "/konsep",
      title: { id: "Konsep", en: "Concepts" },
      description: {
        id: "Pahami ide pemrograman dan lihat miskonsepsi yang berhubungan dengannya.",
        en: "Understand programming ideas and see the misconceptions connected to them.",
      },
      action: language === "id" ? "Buka direktori konsep" : "Open concept directory",
      icon: BrainCircuit,
    },
    {
      to: "/miskonsepsi",
      title: { id: "Miskonsepsi", en: "Misconceptions" },
      description: {
        id: "Pelajari pola kesalahan, koreksi, serta contoh soal dan jawaban yang berkaitan.",
        en: "Study error patterns, corrections, and their related questions and answers.",
      },
      action: language === "id" ? "Telusuri miskonsepsi" : "Browse misconceptions",
      icon: Search,
    },
  ];

  const journey = [
    { icon: BookOpen, label: language === "id" ? "Materi" : "Material", detail: `${categories.length} ${language === "id" ? "topik" : "topics"}` },
    { icon: FileQuestion, label: language === "id" ? "Soal" : "Question", detail: `${questions.length} ${language === "id" ? "soal" : "questions"}` },
    { icon: MessageSquare, label: language === "id" ? "Jawaban" : "Answers", detail: language === "id" ? "Pola mahasiswa" : "Student patterns" },
    { icon: BrainCircuit, label: language === "id" ? "Miskonsepsi" : "Misconception", detail: `${misconceptions.length} ${language === "id" ? "terpetakan" : "mapped"}` },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-16 py-2 md:space-y-20 md:py-6">
      <section className="text-center">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-red" aria-hidden="true" />
          {t(uiText.homeTitle, language)}
        </p>
        <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-extrabold leading-tight tracking-tight text-navy-deep md:text-5xl">
          {language === "id"
            ? "Pahami cara mahasiswa berpikir saat menyelesaikan soal pemrograman."
            : "Understand how students think when solving programming questions."}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-7 text-muted">
          {t(uiText.homeDescription, language)}
        </p>

        <div className="mt-8 flex flex-col items-center gap-3">
          <Link
            to="/materi"
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {language === "id" ? "Mulai dari materi" : "Start with materials"}
            <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
          </Link>
          <Link
            to="/miskonsepsi"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {language === "id" ? "atau telusuri miskonsepsi" : "or browse misconceptions"}
            <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section aria-label={language === "id" ? "Alur pengetahuan" : "Knowledge path"}>
        <ol className="grid grid-cols-2 gap-x-4 gap-y-6 rounded-xl border border-border bg-neutral/60 px-5 py-6 sm:grid-cols-4 md:px-8">
          {journey.map((item, index) => {
            const Icon = item.icon;
            return (
              <li key={item.label} className="flex flex-col items-center text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-brand shadow-[0_1px_2px_rgba(35,32,30,0.06)]">
                  <Icon size={18} strokeWidth={2} aria-hidden="true" />
                </span>
                <span className="mt-2.5 text-sm font-bold text-navy-deep">{item.label}</span>
                <span className="mt-0.5 text-xs text-muted">{item.detail}</span>
                {index < journey.length - 1 && (
                  <ArrowRight
                    size={14}
                    strokeWidth={2}
                    aria-hidden="true"
                    className="mt-3 hidden text-border sm:block"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="explore-title">
        <div className="mb-6 text-center">
          <h2 id="explore-title" className="text-2xl font-bold text-navy-deep">
            {language === "id" ? "Pilih cara menjelajah" : "Choose how to explore"}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {language === "id" ? "Masuk dari sudut pandang yang paling relevan." : "Start from the perspective most relevant to you."}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <Link
                key={page.to}
                to={page.to}
                className="surface-card-hover group flex flex-col p-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon size={19} strokeWidth={2} aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-base font-bold text-navy-deep">{t(page.title, language)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{t(page.description, language)}</p>
                <span className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand">
                  {page.action}
                  <ArrowRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted">{t(uiText.homeLecturerPortalNote, language)}</p>
      </section>
    </div>
  );
}
