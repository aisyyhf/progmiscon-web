import { Link, useNavigate } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions } from "../hooks/useQuestions";
import { useLanguage } from "../hooks/useLanguage";
import { ConceptChip } from "../components/concept/ConceptChip";
import { buildConcepts } from "../utils/concepts";
import { t, uiText } from "../utils/translation";

const quickActions = [
  {
    to: "/materi",
    label: uiText.homeStartMaterial,
    description: {
      id: "Mulai dari kumpulan materi perkuliahan dan buka soal yang relevan.",
      en: "Start from course material and open the relevant questions.",
    },
  },
  {
    to: "/dosen/login",
    label: uiText.homeReviewAssessment,
    description: {
      id: "Masuk sebagai dosen untuk memvalidasi label miskonsepsi.",
      en: "Sign in as a lecturer to validate misconception labels.",
    },
  },
  {
    to: "/konsep",
    label: uiText.homeExploreConcepts,
    description: {
      id: "Jelajahi konsep dan miskonsepsi yang muncul pada variasi jawaban anonim.",
      en: "Explore concepts and misconceptions found in anonymous answer variations.",
    },
  },
  {
    to: "/miskonsepsi",
    label: uiText.homeBrowseMisconceptions,
    description: {
      id: "Telusuri daftar miskonsepsi, bukti, dan soal yang terkait.",
      en: "Browse misconception references, evidence, and related questions.",
    },
  },
];

export function HomePage() {
  const { language } = useLanguage();
  const navigate = useNavigate();
  const { categories } = useCategories();
  const { misconceptions } = useMisconceptions();
  const { questions } = useQuestions();

  const concepts = buildConcepts(categories, questions, misconceptions);
  const exampleConcepts = concepts.slice(0, 4);
  const exampleMisconceptions = misconceptions.slice(0, 3);

  return (
    <div className="mx-auto max-w-5xl">
      <section className="py-8 text-center md:py-12">
        <h1 className="font-serif-brand text-4xl font-semibold tracking-tight text-navy-deep md:text-5xl">
          {t(uiText.homeTitle, language)}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-navy-deep">
          {t(uiText.homeSubtitle, language)}
        </p>
        <p className="mx-auto mt-3 max-w-3xl text-sm leading-6 text-muted">
          {t(uiText.homeDescription, language)}
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickActions.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex min-h-36 flex-col justify-between rounded-lg border border-border bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-gold hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold active:translate-y-0"
          >
            <div>
              <p className="font-serif-brand text-lg font-semibold text-navy-deep">
                {t(action.label, language)}
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">{t(action.description, language)}</p>
            </div>
            <span className="mt-5 text-sm font-medium text-navy transition group-hover:text-gold">
              {language === "id" ? "Buka" : "Open"}
            </span>
          </Link>
        ))}
      </section>

      <section className="mt-10 rounded-lg border border-border bg-white p-6">
        <h2 className="font-serif-brand text-2xl font-semibold text-navy-deep">
          {t(uiText.howItWorks, language)}
        </h2>
        <ol className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
          {[uiText.homeStepOne, uiText.homeStepTwo, uiText.homeStepThree].map((step, index) => (
            <li key={step.id} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-gold bg-gold-soft text-sm font-semibold text-navy-deep">
                {index + 1}
              </span>
              <p className="pt-1 text-sm leading-6 text-navy-deep">{t(step, language)}</p>
            </li>
          ))}
        </ol>
      </section>

      {(exampleConcepts.length > 0 || exampleMisconceptions.length > 0) && (
        <section className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-2">
          {exampleConcepts.length > 0 && (
            <div>
              <h2 className="font-serif-brand text-xl font-semibold text-navy-deep">
                {language === "id" ? "Contoh konsep" : "Example concepts"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {exampleConcepts.map((concept) => (
                  <ConceptChip
                    key={concept.id}
                    label={t(concept.name, language)}
                    onClick={() => navigate(`/konsep/${concept.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {exampleMisconceptions.length > 0 && (
            <div>
              <h2 className="font-serif-brand text-xl font-semibold text-navy-deep">
                {language === "id" ? "Contoh miskonsepsi" : "Example misconceptions"}
              </h2>
              <ul className="mt-3 space-y-2">
                {exampleMisconceptions.map((misconception) => (
                  <li key={misconception.id} className="rounded-md border border-border bg-white px-4 py-3 text-sm">
                    <button
                      type="button"
                      onClick={() => navigate(`/miskonsepsi/${misconception.id}`)}
                      className="cursor-pointer text-left font-medium text-navy-deep underline-offset-4 hover:text-brand hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                    >
                      {t(misconception.title, language)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
