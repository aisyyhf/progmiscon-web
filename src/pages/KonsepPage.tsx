import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Braces, Network } from "lucide-react";
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
        <div className="mb-7 flex items-start gap-4">
          <span className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-brand-soft text-brand">
            <Braces size={22} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h1 className="page-title">{t(uiText.konsepTitle, language)}</h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            {t(uiText.konsepDescription, language)}
            </p>
          </div>
        </div>

        <ul className="scroll-reveal grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sortedConcepts.map((concept) => {
            const count = concept.relatedMisconceptionIds.length;
            return (
              <li key={concept.id} className="min-w-0">
                <Link
                  to={`/konsep/${concept.id}`}
                  className="surface-card-hover group flex h-full flex-col p-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-soft text-brand">
                      <ConceptIcon name={concept.name} />
                    </span>
                    <span className="text-lg font-bold text-navy-deep transition-colors group-hover:text-brand">
                      {t(concept.name, language)}
                    </span>
                  </span>
                  <span className="mt-2 line-clamp-2 text-sm leading-6 text-muted">
                    {t(concept.description, language)}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-5">
                    <span className="flex items-center gap-2 text-sm font-semibold text-brand">
                      {language === "id" ? "Pelajari konsep" : "Explore concept"}
                      <ArrowRight size={15} strokeWidth={2} className="transition-transform group-hover:translate-x-1" aria-hidden="true" />
                    </span>
                    <span className="text-xs text-muted">
                      {count} {language === "id" ? "miskonsepsi" : "misconceptions"}
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
