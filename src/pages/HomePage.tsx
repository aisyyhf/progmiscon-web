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

  const pages = [
    {
      to: "/materi",
      title: { id: "Materi", en: "Materials" },
      description: {
        id: "Mulai dari topik perkuliahan dan temukan soal beserta pola jawaban yang tersedia.",
        en: "Start with a course topic and find its questions and available answer patterns.",
      },
      action: language === "id" ? "Jelajahi materi" : "Explore materials",
    },
    {
      to: "/konsep",
      title: { id: "Konsep", en: "Concepts" },
      description: {
        id: "Pahami ide pemrograman dan lihat miskonsepsi yang berhubungan dengannya.",
        en: "Understand programming ideas and see the misconceptions connected to them.",
      },
      action: language === "id" ? "Buka direktori konsep" : "Open concept directory",
    },
    {
      to: "/miskonsepsi",
      title: { id: "Miskonsepsi", en: "Misconceptions" },
      description: {
        id: "Pelajari pola kesalahan, koreksi, serta contoh soal dan jawaban yang berkaitan.",
        en: "Study error patterns, corrections, and their related questions and answers.",
      },
      action: language === "id" ? "Telusuri miskonsepsi" : "Browse misconceptions",
    },
  ];

  const stats = [
    {
      value: categories.length,
      label: language === "id" ? "topik materi" : "material topics",
    },
    {
      value: questions.length,
      label: language === "id" ? "contoh soal" : "sample questions",
    },
    {
      value: misconceptions.length,
      label: language === "id" ? "miskonsepsi" : "misconceptions",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-12 py-3 md:space-y-16 md:py-7">
      <section className="overflow-hidden rounded-xl border border-border bg-brand-soft px-6 py-9 sm:px-9 sm:py-11 lg:px-12 lg:py-14">
        <div className="max-w-4xl">
          <h1 className="text-[2.35rem] font-extrabold leading-[1.14] tracking-tight text-navy-deep sm:text-5xl">
            {language === "id"
              ? "Pahami pola pikir di balik jawaban pemrograman."
              : "Understand the thinking behind programming answers."}
          </h1>
          <p className="mt-5 max-w-2xl text-[15px] leading-7 text-muted">
            {t(uiText.homeDescription, language)}
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              to="/materi"
              className="inline-flex items-center rounded-md bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {language === "id" ? "Mulai dari materi" : "Start with materials"}
            </Link>
            <Link
              to="/miskonsepsi"
              className="inline-flex items-center rounded-md border border-brand/25 bg-white px-5 py-3 text-sm font-semibold text-brand transition-colors hover:border-brand/45 hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {language === "id" ? "Lihat miskonsepsi" : "View misconceptions"}
            </Link>
          </div>
        </div>
      </section>

      <dl
        className="grid grid-cols-3 divide-x divide-border border-y border-border py-5"
        aria-label={language === "id" ? "Ringkasan konten" : "Content summary"}
      >
        {stats.map((stat) => (
          <div key={stat.label} className="px-3 text-center sm:px-6">
            <dd className="text-2xl font-bold tabular-nums text-navy-deep sm:text-3xl">
              {stat.value}
            </dd>
            <dt className="mt-1 text-xs leading-5 text-muted sm:text-sm">
              {stat.label}
            </dt>
          </div>
        ))}
      </dl>

      <section aria-labelledby="explore-title">
        <div className="mb-6">
          <h2 id="explore-title" className="text-2xl font-bold text-navy-deep">
            {language === "id" ? "Jelajahi Progmiscon" : "Explore Progmiscon"}
          </h2>
          <p className="mt-1.5 text-sm text-muted">
            {language === "id"
              ? "Pilih informasi yang ingin kamu pelajari."
              : "Choose what you want to learn about."}
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.08fr_0.92fr] lg:grid-rows-2">
          {pages.map((page, index) => (
            <Link
              key={page.to}
              to={page.to}
              className={`group flex flex-col rounded-xl border p-6 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:p-7 ${
                index === 0
                  ? "border-brand/20 bg-brand-soft hover:border-brand/40 lg:row-span-2 lg:justify-center"
                  : "border-border bg-white hover:border-brand/30 hover:bg-neutral/40"
              }`}
            >
              <h3
                className={
                  index === 0
                    ? "text-2xl font-bold text-navy-deep"
                    : "text-lg font-bold text-navy-deep"
                }
              >
                {t(page.title, language)}
              </h3>
              <p
                className={`mt-2 max-w-xl text-sm leading-6 text-muted ${
                  index === 0 ? "sm:text-[15px] sm:leading-7" : ""
                }`}
              >
                {t(page.description, language)}
              </p>
              <span className="mt-5 text-sm font-semibold text-brand group-hover:text-brand-deep">
                {page.action}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-muted">
        {t(uiText.homeLecturerPortalNote, language)}
      </p>
    </div>
  );
}
