import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCategories } from "../hooks/useCategories";
import { useMisconceptions } from "../hooks/useMisconceptions";
import { useQuestions } from "../hooks/useQuestions";
import { useLanguage } from "../hooks/useLanguage";
import { Breadcrumb } from "../components/layout/Breadcrumb";
import { EmptyState } from "../components/common/EmptyState";
import { ConceptChip } from "../components/concept/ConceptChip";
import { MisconceptionDrawer } from "../components/misconception/MisconceptionDrawer";
import { buildConcepts } from "../utils/concepts";
import { t, uiText } from "../utils/translation";

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
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <h1 className="font-serif-brand text-2xl font-semibold text-navy-deep">
            {t(uiText.konsepTitle, language)}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {t(uiText.konsepDescription, language)}
          </p>
        </div>

        <ul className="divide-y divide-border border-y border-border">
          {sortedConcepts.map((concept) => {
            const count = concept.relatedMisconceptionIds.length;
            return (
              <li key={concept.id}>
                <Link
                  to={`/konsep/${concept.id}`}
                  className="group flex gap-4 px-1 py-5 transition-colors hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-full border border-gold bg-gold-soft"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                      <span className="font-serif-brand text-xl font-semibold text-navy-deep underline-offset-4 group-hover:text-navy group-hover:underline">
                        {t(concept.name, language)}
                      </span>
                      <span className="text-sm text-muted">
                        {count} {language === "id" ? "miskonsepsi" : "misconceptions"}
                      </span>
                    </span>
                    <span className="mt-1 block max-w-2xl text-sm leading-6 text-muted">
                      {t(concept.description, language)}
                    </span>
                  </span>
                  <span className="hidden pt-1 text-sm font-medium text-navy transition group-hover:text-gold sm:block">
                    {language === "id" ? "Buka" : "Open"} →
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
    <div className="mx-auto max-w-4xl">
      <Breadcrumb
        items={[
          { label: t(uiText.breadcrumbHome, language), to: "/" },
          { label: t(uiText.breadcrumbKonsep, language), to: "/konsep" },
          { label: t(currentConcept.name, language) },
        ]}
      />

      <header className="mb-8 border-b border-border pb-6">
        <h1 className="font-serif-brand text-3xl font-semibold text-navy-deep">
          {t(currentConcept.name, language)}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          {t(currentConcept.description, language)}
        </p>
      </header>

      <section className="mb-10">
        <h2 className="font-serif-brand text-xl font-semibold text-navy-deep">
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

      <section>
        <h2 className="font-serif-brand text-2xl font-semibold text-navy-deep">
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
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {conceptMisconceptions.map((misconception) => (
              <li key={misconception.id}>
                <button
                  type="button"
                  onClick={() => openDrawer(misconception.id)}
                  className="group flex w-full cursor-pointer items-start gap-4 px-1 py-5 text-left transition-colors hover:bg-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
                >
                  <span
                    aria-hidden="true"
                    className="mt-2 h-2 w-2 shrink-0 rounded-sm border border-navy/30 bg-white"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-navy-deep underline-offset-4 group-hover:text-navy group-hover:underline">
                      {t(misconception.title, language)}
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
