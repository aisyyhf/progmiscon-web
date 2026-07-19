import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Code2,
  FileQuestion,
  MessageSquare,
  Search,
} from "lucide-react";
import { useCategories } from "../hooks/useCategories";
import { useLanguage } from "../hooks/useLanguage";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions } from "../hooks/useQuestions";
import { buildConcepts } from "../utils/concepts";
import { t, uiText } from "../utils/translation";

export function HomePage() {
  const { language } = useLanguage();
  const { categories } = useCategories();
  const { misconceptions } = useMisconceptions();
  const { questions } = useQuestions();
  const concepts = buildConcepts(categories, questions, misconceptions);

  const pages = [
    {
      to: "/materi",
      title: { id: "Materi", en: "Materials" },
      description: {
        id: "Mulai dari topik perkuliahan dan temukan soal beserta pola jawaban yang tersedia.",
        en: "Start with a course topic and find its questions and available answer patterns.",
      },
      examples: categories.slice(0, 3).map((category) => t(category.name, language)),
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
      examples: concepts.slice(0, 3).map((concept) => t(concept.name, language)),
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
      examples: misconceptions.slice(0, 2).map((item) => t(item.title, language)),
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
    <div className="mx-auto max-w-6xl space-y-10">
      <section className="overflow-hidden rounded-lg bg-white shadow-[0_18px_50px_rgba(30,41,59,0.08)]">
        <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
          <div className="flex flex-col justify-center px-6 py-9 md:px-10 md:py-12 lg:px-12">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand">
              <Code2 size={17} strokeWidth={2} aria-hidden="true" />
              <span>{t(uiText.homeTitle, language)}</span>
            </div>
            <h1 className="mt-4 max-w-2xl text-3xl font-bold leading-tight text-navy-deep md:text-[2.65rem]">
              {language === "id"
                ? "Pahami cara mahasiswa berpikir saat menyelesaikan soal pemrograman."
                : "Understand how students think when solving programming questions."}
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted">
              {t(uiText.homeDescription, language)}
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to="/materi"
                className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(153,0,0,0.18)] transition-colors hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {language === "id" ? "Mulai dari materi" : "Start with materials"}
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </Link>
              <Link
                to="/miskonsepsi"
                className="inline-flex items-center gap-2 rounded-lg bg-neutral px-4 py-2.5 text-sm font-semibold text-navy transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Search size={16} strokeWidth={2} aria-hidden="true" />
                {language === "id" ? "Telusuri miskonsepsi" : "Browse misconceptions"}
              </Link>
            </div>
          </div>

          <div className="bg-[#f1f4f8] p-6 md:p-8 lg:p-10">
            <p className="text-sm font-semibold text-navy-deep">
              {language === "id" ? "Alur pengetahuan" : "Knowledge path"}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted">
              {language === "id"
                ? "Setiap miskonsepsi dapat ditelusuri kembali ke soal dan pola jawabannya."
                : "Every misconception can be traced back to its question and answer pattern."}
            </p>

            <ol className="mt-6 space-y-3">
              {journey.map((item, index) => {
                const Icon = item.icon;
                return (
                  <li key={item.label} className="relative flex items-center gap-4 rounded-lg bg-white px-4 py-3.5 shadow-[0_5px_18px_rgba(30,41,59,0.055)]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Icon size={19} strokeWidth={2} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-navy-deep">{item.label}</span>
                      <span className="block text-xs text-muted">{item.detail}</span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-slate-400">0{index + 1}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <section aria-labelledby="explore-title">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="explore-title" className="text-2xl font-bold text-navy-deep">
              {language === "id" ? "Pilih cara menjelajah" : "Choose how to explore"}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {language === "id" ? "Masuk dari sudut pandang yang paling relevan." : "Start from the perspective most relevant to you."}
            </p>
          </div>
          <p className="text-xs text-muted">{t(uiText.homeLecturerPortalNote, language)}</p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <Link
                key={page.to}
                to={page.to}
                className="group flex min-h-64 flex-col rounded-lg bg-white p-6 shadow-[0_10px_30px_rgba(30,41,59,0.06)] transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(30,41,59,0.1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-brand-soft text-brand">
                  <Icon size={21} strokeWidth={2} aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-lg font-bold text-navy-deep">{t(page.title, language)}</h3>
                <p className="mt-2 text-sm leading-6 text-muted">{t(page.description, language)}</p>
                <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-400">{page.examples.join(" / ")}</p>
                <span className="mt-auto flex items-center gap-2 pt-5 text-sm font-semibold text-brand">
                  {page.action}
                  <ArrowRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
