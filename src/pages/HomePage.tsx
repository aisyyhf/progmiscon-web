import {
  ArrowRight,
  BookOpen,
  BrainCircuit,
  Code2,
  FileQuestion,
  MessageSquareText,
  Search,
} from "lucide-react";
import { Link } from "react-router-dom";
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

  const categoryExamples = categories
    .slice(0, 3)
    .map((category) => t(category.name, language))
    .join(" / ");
  const misconceptionExamples = misconceptions
    .slice(0, 2)
    .map((misconception) => t(misconception.title, language))
    .join(" / ");

  const knowledgeItems = [
    {
      to: "/materi",
      icon: BookOpen,
      title: language === "id" ? "Materi" : "Materials",
      detail: `${categories.length} ${language === "id" ? "topik" : "topics"}`,
    },
    {
      to: "/materi",
      icon: FileQuestion,
      title: language === "id" ? "Soal" : "Questions",
      detail: `${questions.length} ${language === "id" ? "soal" : "questions"}`,
    },
    {
      to: "/materi",
      icon: MessageSquareText,
      title: language === "id" ? "Jawaban" : "Answers",
      detail: language === "id" ? "Pola mahasiswa" : "Student patterns",
    },
    {
      to: "/miskonsepsi",
      icon: BrainCircuit,
      title: language === "id" ? "Miskonsepsi" : "Misconceptions",
      detail: `${misconceptions.length} ${language === "id" ? "terpetakan" : "mapped"}`,
    },
  ];

  const exploreItems = [
    {
      to: "/materi",
      icon: BookOpen,
      title: language === "id" ? "Materi" : "Materials",
      description:
        language === "id"
          ? "Mulai dari topik perkuliahan dan temukan soal beserta pola jawaban yang tersedia."
          : "Start with a course topic and find its questions and available answer patterns.",
      examples: categoryExamples,
      action: language === "id" ? "Jelajahi materi" : "Explore materials",
    },
    {
      to: "/konsep",
      icon: BrainCircuit,
      title: language === "id" ? "Konsep" : "Concepts",
      description:
        language === "id"
          ? "Pahami ide pemrograman dan lihat miskonsepsi yang berhubungan dengannya."
          : "Understand programming ideas and see the misconceptions connected to them.",
      examples: categoryExamples,
      action:
        language === "id" ? "Buka direktori konsep" : "Open concept directory",
    },
    {
      to: "/miskonsepsi",
      icon: Search,
      title: language === "id" ? "Miskonsepsi" : "Misconceptions",
      description:
        language === "id"
          ? "Pelajari pola kesalahan, koreksi, serta contoh soal dan jawaban yang berkaitan."
          : "Study error patterns, corrections, and their related questions and answers.",
      examples: misconceptionExamples,
      action:
        language === "id" ? "Telusuri miskonsepsi" : "Browse misconceptions",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-14 pb-4 md:space-y-20">
      <section className="grid overflow-hidden rounded-xl border border-border bg-white shadow-[0_18px_48px_rgba(43,38,36,0.06)] lg:grid-cols-[1.08fr_0.92fr]">
        <div className="px-6 py-10 sm:px-10 sm:py-12 lg:px-12 lg:py-14">
          <div className="flex items-center gap-2 text-sm font-semibold text-brand">
            <Code2 aria-hidden="true" size={18} strokeWidth={2} />
            <span>Progmiscon</span>
          </div>

          <h1 className="mt-6 max-w-xl text-[2.35rem] font-extrabold leading-[1.16] tracking-[-0.025em] text-navy-deep sm:text-[2.7rem] lg:text-[3rem]">
            {language === "id"
              ? "Pahami cara mahasiswa berpikir saat menyelesaikan soal pemrograman."
              : "Understand how students think when solving programming questions."}
          </h1>

          <p className="mt-6 max-w-2xl text-[15px] leading-7 text-muted">
            {t(uiText.homeDescription, language)}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/materi"
              className="inline-flex items-center gap-2 rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(182,37,42,0.18)] transition hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {language === "id" ? "Mulai dari materi" : "Start with materials"}
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
            <Link
              to="/miskonsepsi"
              className="inline-flex items-center gap-2 rounded-md bg-neutral px-5 py-3 text-sm font-semibold text-navy transition hover:bg-border/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <Search aria-hidden="true" size={17} />
              {language === "id" ? "Telusuri miskonsepsi" : "Browse misconceptions"}
            </Link>
          </div>
        </div>

        <aside className="border-t border-border bg-neutral/75 px-6 py-9 sm:px-10 lg:border-l lg:border-t-0 lg:px-10 lg:py-11">
          <h2 className="text-sm font-semibold text-navy-deep">
            {language === "id" ? "Alur pengetahuan" : "Knowledge map"}
          </h2>
          <p className="mt-2 max-w-md text-sm leading-6 text-muted">
            {language === "id"
              ? "Setiap miskonsepsi dapat ditelusuri kembali ke soal dan pola jawabannya."
              : "Each misconception can be traced back to its question and answer pattern."}
          </p>

          <ol className="mt-6 space-y-3">
            {knowledgeItems.map((item, index) => {
              const Icon = item.icon;

              return (
                <li key={item.title}>
                  <Link
                    to={item.to}
                    className="group flex items-center gap-4 rounded-lg border border-transparent bg-white px-4 py-3.5 transition hover:border-brand/25 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand">
                      <Icon aria-hidden="true" size={20} strokeWidth={2} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-navy-deep">
                        {item.title}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">
                        {item.detail}
                      </span>
                    </span>
                    <span className="text-xs font-semibold tabular-nums text-muted/65">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
        </aside>
      </section>

      <section aria-labelledby="explore-title">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="explore-title" className="text-2xl font-bold text-navy-deep">
              {language === "id" ? "Pilih cara menjelajah" : "Choose how to explore"}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              {language === "id"
                ? "Masuk dari sudut pandang yang paling relevan."
                : "Start from the perspective most relevant to you."}
            </p>
          </div>
          <p className="max-w-sm text-xs leading-5 text-muted sm:text-right">
            {t(uiText.homeLecturerPortalNote, language)}
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {exploreItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.to}
                to={item.to}
                className="group flex min-h-72 flex-col rounded-xl border border-border bg-white p-6 transition hover:-translate-y-1 hover:border-brand/30 hover:shadow-[0_16px_36px_rgba(43,38,36,0.07)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="grid size-11 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon aria-hidden="true" size={21} strokeWidth={2} />
                </span>
                <h3 className="mt-6 text-lg font-bold text-navy-deep">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {item.description}
                </p>
                {item.examples && (
                  <p className="mt-3 line-clamp-2 text-xs leading-5 text-muted/75">
                    {item.examples}
                  </p>
                )}
                <span className="mt-auto inline-flex items-center gap-2 pt-7 text-sm font-semibold text-brand group-hover:text-brand-deep">
                  {item.action}
                  <ArrowRight
                    aria-hidden="true"
                    size={16}
                    className="transition-transform group-hover:translate-x-1"
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
