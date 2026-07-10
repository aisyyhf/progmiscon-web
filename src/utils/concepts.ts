import type { Category, Concept, LocalizedText, Misconception, Question } from "../types";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function conceptIdFromText(text: LocalizedText): string {
  return `concept-${slugify(text.en || text.id)}`;
}

export function buildConcepts(
  categories: Category[],
  questions: Question[],
  misconceptions: Misconception[],
): Concept[] {
  const conceptMap = new Map<string, Concept>();

  for (const category of categories) {
    conceptMap.set(category.id, {
      id: category.id,
      categoryId: category.id,
      name: category.name,
      description:
        category.description ??
        {
          id: "Konsep pemrograman yang digunakan untuk mengelompokkan soal dan miskonsepsi.",
          en: "A programming concept used to group questions and misconceptions.",
        },
      relatedConceptIds: [],
      relatedMisconceptionIds: misconceptions
        .filter((misconception) => misconception.categoryId === category.id)
        .map((misconception) => misconception.id),
      relatedQuestionIds: questions
        .filter((question) => question.categoryId === category.id)
        .map((question) => question.id),
    });
  }

  for (const question of questions) {
    const category = categories.find((item) => item.id === question.categoryId);
    const categoryConcept = conceptMap.get(question.categoryId);

    for (const expectedConcept of question.expectedConcepts) {
      const id = conceptIdFromText(expectedConcept);
      const existing = conceptMap.get(id);
      const relatedConceptIds = new Set(existing?.relatedConceptIds ?? []);
      const relatedMisconceptionIds = new Set(existing?.relatedMisconceptionIds ?? []);
      const relatedQuestionIds = new Set(existing?.relatedQuestionIds ?? []);

      relatedConceptIds.add(question.categoryId);
      relatedQuestionIds.add(question.id);
      for (const misconceptionId of question.questionMisconceptionIds) {
        relatedMisconceptionIds.add(misconceptionId);
      }

      conceptMap.set(id, {
        id,
        categoryId: question.categoryId,
        name: expectedConcept,
        description: {
          id: category
            ? `Konsep ini muncul pada soal ${category.name.id.toLowerCase()} dan membantu menafsirkan variasi jawaban anonim.`
            : "Konsep ini membantu menafsirkan variasi jawaban anonim.",
          en: category
            ? `This concept appears in ${category.name.en.toLowerCase()} questions and helps interpret anonymous answer variations.`
            : "This concept helps interpret anonymous answer variations.",
        },
        relatedConceptIds: Array.from(relatedConceptIds),
        relatedMisconceptionIds: Array.from(relatedMisconceptionIds),
        relatedQuestionIds: Array.from(relatedQuestionIds),
      });

      if (categoryConcept) {
        categoryConcept.relatedConceptIds = Array.from(
          new Set([...categoryConcept.relatedConceptIds, id]),
        );
      }
    }
  }

  return Array.from(conceptMap.values());
}

export function findConceptByText(concepts: Concept[], text: LocalizedText): Concept | undefined {
  const id = conceptIdFromText(text);
  return (
    concepts.find((concept) => concept.id === id) ??
    concepts.find((concept) => concept.name.id === text.id || concept.name.en === text.en)
  );
}
