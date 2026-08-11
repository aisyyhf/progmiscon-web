import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Network } from "lucide-react";
import { useCategories } from "../hooks/useCategories";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions } from "../hooks/useQuestions";
import { useLanguage } from "../hooks/useLanguage";
import { Breadcrumb } from "../components/layout/Breadcrumb";
import { EmptyState } from "../components/common/EmptyState";
import { QuestionRow } from "../components/browser/QuestionRow";
import { ConceptChip } from "../components/concept/ConceptChip";
import { ConceptIcon } from "../components/concept/ConceptIcon";
import { MisconceptionDrawer } from "../components/misconception/MisconceptionDrawer";
import { buildConcepts } from "../utils/concepts";
import { t, uiText } from "../utils/translation";
import { misconceptionLabel } from "../utils/misconceptionLabel";
import type { LocalizedText } from "../types";

const conceptCardDescriptions: Record<string, LocalizedText> = {
  "Alur Eksekusi": {
    id: "Urutan langkah yang dijalankan program dari awal hingga selesai",
    en: "The order in which a program runs its instructions from start to finish",
  },
  Ekspresi: {
    id: "Gabungan nilai, variabel, dan operator yang menghasilkan suatu nilai",
    en: "A combination of values, variables, and operators that produces a value",
  },
  "Input/Output": {
    id: "Cara program menerima data dan menampilkan hasil",
    en: "How a program receives data and displays results",
  },
  Konstanta: {
    id: "Nilai tetap yang tidak berubah selama program berjalan",
    en: "A fixed value that does not change while a program runs",
  },
  Operator: {
    id: "Simbol untuk melakukan operasi pada nilai atau variabel",
    en: "Symbols used to perform operations on values or variables",
  },
  Percabangan: {
    id: "Pemilihan alur program berdasarkan kondisi tertentu",
    en: "Choosing a program path based on a condition",
  },
  Perulangan: {
    id: "Menjalankan instruksi berulang kali selama syarat terpenuhi",
    en: "Running instructions repeatedly while a condition is met",
  },
  Variabel: {
    id: "Tempat menyimpan nilai yang dapat digunakan dan diubah program",
    en: "A named place for storing values a program can use and change",
  },
};

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export function KonsepPage() {
  const { conceptId } = useParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { categories } = useCategories();
  const { misconceptions } = useMisconceptions();
  const { questions: allQuestions } = useQuestions();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMisconceptionId, setSelectedMisconceptionId] = useState<string | undefined>();

  const concepts = useMemo(
    () => buildConcepts(categories, allQuestions, misconceptions),
    [categories, allQuestions, misconceptions],
  );
  const mainConcepts = useMemo(
    () => concepts.filter((concept) => categories.some((category) => category.id === concept.id)),
    [categories, concepts],
  );
  const sortedConcepts = useMemo(
    () =>
      [...mainConcepts].sort((a, b) =>
        t(a.name, language).localeCompare(t(b.name, language), undefined, { sensitivity: "base" }),
      ),
    [mainConcepts, language],
  );
  const currentConcept = sortedConcepts.find((concept) => concept.id === conceptId);
  const conceptMisconceptions = useMemo(
    () =>
      currentConcept
        ? currentConcept.relatedMisconceptionIds
            .map((misconceptionId) =>
              misconceptions.find((misconception) => misconception.id === misconceptionId),
            )
            .filter(isDefined)
        : [],
    [currentConcept, misconceptions],
  );
  const conceptQuestions = useMemo(() => {
    if (!currentConcept) return [];
    const questionIds = new Set(currentConcept.relatedQuestionIds);
    return allQuestions.filter((question) => questionIds.has(question.id));
  }, [allQuestions, currentConcept]);
  const relatedConcepts = useMemo(() => {
    if (!currentConcept) return [];
    const directRelations = currentConcept.relatedConceptIds
      .map((conceptId) => sortedConcepts.find((concept) => concept.id === conceptId))
      .filter(isDefined);
    if (directRelations.length > 0) return directRelations;

    return sortedConcepts
      .filter((concept) => concept.id !== currentConcept.id && concept.categoryId === currentConcept.categoryId)
      .slice(0, 3);
  }, [currentConcept, sortedConcepts]);

  const openDrawer = (misconceptionId: string) => {
    setSelectedMisconceptionId(misconceptionId);
    setDrawerOpen(true);
  };

  if (!conceptId) {
    return (
      <div className="mx-auto max-w-6xl">
        <header className="mb-7 text-center">
          <h1 className="page-title">{t(uiText.konsepTitle, language)}</h1>
          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted">
            {t(uiText.konsepDescription, language)}
          </p>
        </header>

        <ul className="scroll-reveal grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {sortedConcepts.map((concept, index) => {
            const count = concept.relatedMisconceptionIds.length;
            const code = categories.find((category) => category.id === concept.id)?.order ?? index + 1;
            const description = conceptCardDescriptions[concept.name.id] ?? concept.description;
            return (
              <li key={concept.id} className="min-w-0">
                <Link
                  to={`/konsep/${concept.id}`}
                  className="group relative isolate flex min-h-42 h-full flex-col overflow-hidden rounded-xl border border-border bg-white p-4 shadow-[0_8px_28px_rgba(71,45,43,0.045)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_12px_32px_rgba(71,45,43,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span
                    className={`pointer-events-none absolute text-brand/[0.065] ${
                      index % 2 === 0
                        ? "-bottom-5 -left-4 -rotate-6"
                        : "-bottom-7 left-4 rotate-6"
                    }`}
                    aria-hidden="true"
                  >
                    <ConceptIcon name={concept.name} size={92} />
                  </span>

                  <span className="relative text-[10px] font-bold tracking-[0.16em] text-brand">
                    KC-{String(code).padStart(2, "0")}
                  </span>
                  <h2 className="relative mt-1.5 text-lg font-bold leading-snug tracking-[-0.02em] text-navy-deep transition-colors group-hover:text-brand">
                    {t(concept.name, language)}
                  </h2>
                  <span className="relative mt-1.5 text-[13px] leading-5 text-muted">
                    {t(description, language)}
                  </span>
                  <span className="relative mt-auto flex items-end justify-end gap-3 pt-3">
                    <span className="text-[11px] leading-8 text-muted tabular-nums">
                      {count} {language === "id" ? "miskonsepsi" : "misconceptions"}
                    </span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-brand text-white shadow-[0_4px_12px_rgba(182,37,42,0.18)] transition-transform group-hover:translate-x-0.5" aria-hidden="true">
                      <ArrowRight size={15} strokeWidth={2} />
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (!currentConcept) {
    return <EmptyState message={language === "id" ? "Konsep tidak ditemukan." : "Concept not found."} />;
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Breadcrumb
        items={[
          { label: t(uiText.breadcrumbHome, language), to: "/" },
          { label: t(uiText.breadcrumbKonsep, language), to: "/konsep" },
          { label: t(currentConcept.name, language) },
        ]}
      />

      <header className="mb-7 flex items-start gap-4">
        <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
          <Network size={22} strokeWidth={2} aria-hidden="true" />
        </span>
        <div>
          <h1 className="page-title">{t(currentConcept.name, language)}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
            {t(currentConcept.description, language)}
          </p>
        </div>
      </header>

      <section className="mb-8 rounded-lg bg-neutral p-5">
        <h2 className="text-base font-bold text-navy-deep">
          {t(uiText.relatedConcepts, language)}
        </h2>
        {relatedConcepts.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {relatedConcepts.map((concept) => (
              <ConceptChip
                key={concept.id}
                label={t(concept.name, language)}
                onClick={() => navigate(`/konsep/${concept.id}`)}
              />
            ))}
          </div>
        ) : (
          <p className="mt-2 text-sm text-muted">
            {language === "id" ? "Belum ada konsep terkait." : "No related concepts yet."}
          </p>
        )}
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-bold text-navy-deep">
          {t(uiText.conceptMisconceptions, language)} {t(currentConcept.name, language)}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {conceptMisconceptions.length} {t(uiText.documentedMisconceptions, language)}
        </p>
        {conceptMisconceptions.length === 0 ? (
          <div className="mt-4">
            <EmptyState message={t(uiText.noConceptMisconceptions, language)} />
          </div>
        ) : (
          <ul className="scroll-reveal mt-4 grid gap-3 md:grid-cols-2">
            {conceptMisconceptions.map((misconception) => (
              <li key={misconception.id}>
                <button
                  type="button"
                  onClick={() => openDrawer(misconception.id)}
                  className="surface-card-hover group flex h-full w-full cursor-pointer items-start gap-4 px-5 py-4 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <div className="min-w-0">
                    <h3 className="text-base font-semibold text-navy-deep transition-colors group-hover:text-brand">
                      {misconceptionLabel(misconception, language)}
                    </h3>
                    <p className="mt-1 line-clamp-2 max-w-3xl text-sm leading-6 text-muted">
                      {t(misconception.wrong, language)}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-xl font-bold text-navy-deep">
          {language === "id" ? "Contoh Soal" : "Example Questions"} {t(currentConcept.name, language)}
        </h2>
        {conceptQuestions.length === 0 ? (
          <div className="mt-4">
            <EmptyState message={t(uiText.noQuestions, language)} />
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-white">
            {conceptQuestions.map((question) => (
              <QuestionRow
                key={question.id}
                metaItems={[question.id]}
                promptPreview={t(question.prompt, language)}
                onClick={() => navigate(`/question/${question.id}`)}
              />
            ))}
          </ul>
        )}
      </section>

      <MisconceptionDrawer
        open={drawerOpen}
        misconceptionId={selectedMisconceptionId}
        onClose={() => setDrawerOpen(false)}
        onSelectRelatedMisconception={setSelectedMisconceptionId}
        onSelectRelatedQuestion={(questionId) => {
          setDrawerOpen(false);
          navigate(`/question/${questionId}`);
        }}
        onViewInConcept={(nextConceptId) => {
          setDrawerOpen(false);
          setSelectedMisconceptionId(undefined);
          navigate(`/konsep/${nextConceptId}`);
        }}
        onOpenMisconceptionPage={(misconceptionId) => {
          setDrawerOpen(false);
          navigate(`/miskonsepsi/${misconceptionId}`);
        }}
      />
    </div>
  );
}
