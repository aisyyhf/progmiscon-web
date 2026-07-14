import { Link } from "react-router-dom";
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

  const pageGuides = [
    {
      to: "/materi",
      title: { id: "Materi", en: "Materials" },
      description: {
        id: "Pilih topik perkuliahan, lalu buka soal dan variasi jawaban mahasiswa yang berkaitan.",
        en: "Choose a course topic, then open its questions and related student answer variations.",
      },
      examples: categories.slice(0, 3).map((category) => t(category.name, language)),
    },
    {
      to: "/konsep",
      title: { id: "Konsep", en: "Concepts" },
      description: {
        id: "Pelajari ringkasan konsep pemrograman dan hubungannya dengan miskonsepsi yang ditemukan.",
        en: "Study programming concepts and how they relate to identified misconceptions.",
      },
      examples: concepts.slice(0, 3).map((concept) => t(concept.name, language)),
    },
    {
      to: "/miskonsepsi",
      title: { id: "Miskonsepsi", en: "Misconceptions" },
      description: {
        id: "Pahami pola kesalahan, penyebab, perbaikan, dan contoh soal yang berkaitan.",
        en: "Understand error patterns, causes, corrections, and related question examples.",
      },
      examples: misconceptions.slice(0, 2).map((misconception) => t(misconception.title, language)),
    },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <section className="border-b border-border pb-10">
        <div className="max-w-3xl py-2">
          <h1 className="font-serif-brand text-4xl font-semibold text-navy-deep md:text-5xl">
            {t(uiText.homeTitle, language)}
          </h1>
          <div className="mt-4 h-0.5 w-16 bg-brand" aria-hidden="true" />
          <p className="mt-5 max-w-xl text-lg font-medium leading-8 text-navy-deep">
            {t(uiText.homeSubtitle, language)}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            {t(uiText.homeDescription, language)}
          </p>
          <Link
            to="/materi"
            className="mt-6 inline-flex items-center rounded-md border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-px"
          >
            {language === "id" ? "Mulai dari Materi" : "Start from Materials"}
            <span className="ml-2" aria-hidden="true">{"\u2192"}</span>
          </Link>
        </div>
      </section>

      <section className="py-9">
        <h2 className="font-serif-brand text-2xl font-semibold text-navy-deep">
          {language === "id" ? "Jelajahi Progmiscon" : "Explore Progmiscon"}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          {language === "id"
            ? "Mulai dari materi, konsep, atau pola miskonsepsi sesuai kebutuhanmu."
            : "Start from materials, concepts, or misconception patterns based on what you need."}
        </p>

        <div className="mt-6 divide-y divide-border border-y border-border">
          {pageGuides.map((guide) => (
            <Link
              key={guide.to}
              to={guide.to}
              className="group grid gap-3 px-4 py-5 transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold md:grid-cols-[160px_minmax(0,1fr)_140px] md:items-center md:px-5"
            >
              <h3 className="font-serif-brand text-xl font-semibold text-navy-deep group-hover:text-brand">
                {t(guide.title, language)}
              </h3>
              <div>
                <p className="text-sm leading-6 text-muted">{t(guide.description, language)}</p>
                {guide.examples.length > 0 && (
                  <p className="mt-2 text-xs leading-5 text-muted">
                    <span className="font-semibold text-navy-deep">
                      {language === "id" ? "Contoh" : "Examples"}: {" "}
                    </span>
                    {guide.examples.join(", ")}
                  </p>
                )}
              </div>
              <span className="text-sm font-semibold text-brand md:justify-self-end">
                {language === "id" ? `Buka ${t(guide.title, language)}` : `Open ${t(guide.title, language)}`}{" "}
                <span aria-hidden="true">{"\u2192"}</span>
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-5 text-xs leading-5 text-muted">
          {t(uiText.homeLecturerPortalNote, language)}
        </p>
      </section>
    </div>
  );
}
