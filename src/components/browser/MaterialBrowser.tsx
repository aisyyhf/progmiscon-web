import type { Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { EmptyState } from "../common/EmptyState";
import { BookOpen, BookOpenCheck } from "lucide-react";

export function MaterialBrowser({
  categories,
  selectedCategoryId,
  onSelectCategory,
  questions,
  loading = false,
  onSelectQuestion,
}: {
  categories: Category[];
  selectedCategoryId: string | undefined;
  onSelectCategory: (categoryId: string) => void;
  questions: Question[];
  loading?: boolean;
  onSelectQuestion: (questionId: string) => void;
}) {
  const { language } = useLanguage();
  const selectedCategory = categories.find((category) => category.id === selectedCategoryId);

  return (
    <div className="scroll-reveal grid gap-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-xl border border-border bg-neutral/60 p-3 lg:sticky lg:top-24">
        <div className="flex items-start gap-3 px-2 pb-3 pt-1">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-[0_1px_2px_rgba(33,29,27,0.06)]">
            <BookOpen size={16} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-bold text-navy-deep">
              {language === "id" ? "Daftar materi" : "Material library"}
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-muted">
              {categories.length} {language === "id" ? "topik tersedia" : "topics available"}
            </p>
          </div>
        </div>

        <nav
          aria-label={language === "id" ? "Topik materi" : "Material topics"}
          className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-1"
        >
          {categories.map((category) => {
            const active = category.id === selectedCategoryId;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => onSelectCategory(category.id)}
                aria-current={active}
                className={cn(
                  "min-h-11 cursor-pointer rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  active
                    ? "border-brand bg-brand text-white shadow-[0_3px_10px_rgba(143,28,32,0.12)]"
                    : "border-border bg-white text-navy-deep hover:border-brand/30 hover:text-brand",
                )}
              >
                {t(category.name, language)}
              </button>
            );
          })}
        </nav>
      </aside>

      <section
        className="min-w-0"
        aria-labelledby={selectedCategory ? "selected-material-title" : undefined}
      >
        {selectedCategory && (
          <header className="border-b border-border pb-5">
            <p className="text-xs font-semibold text-brand">
              {language === "id" ? "Materi terpilih" : "Selected material"}
            </p>
            <div className="mt-1.5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="selected-material-title" className="text-2xl font-extrabold tracking-tight text-navy-deep">
                  {t(selectedCategory.name, language)}
                </h2>
                {selectedCategory.description && (
                  <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
                    {t(selectedCategory.description, language)}
                  </p>
                )}
              </div>
              {!loading && (
                <span className="w-fit shrink-0 rounded-md bg-brand-soft px-2.5 py-1.5 text-xs font-semibold text-brand">
                  {questions.length} {language === "id" ? "contoh soal" : "example questions"}
                </span>
              )}
            </div>
          </header>
        )}

        {loading ? (
          <div className="mt-6">
            <EmptyState loading message={language === "id" ? "Memuat soal..." : "Loading questions..."} />
          </div>
        ) : questions.length === 0 ? (
          <div className="mt-6">
            <EmptyState
              message={
                language === "id"
                  ? "Belum ada contoh soal untuk materi ini. Pilih materi lain dari daftar."
                  : "No example questions are available for this material yet. Choose another material from the list."
              }
            />
          </div>
        ) : (
          <div>
            <div className="mb-4 mt-6">
              <h3 className="text-base font-bold text-navy-deep">
                {language === "id" ? "Contoh soal" : "Example questions"}
              </h3>
              <p className="mt-1 text-sm leading-6 text-muted">
                {language === "id"
                  ? "Pilih soal untuk melihat rincian, variasi jawaban, dan miskonsepsi yang terkait."
                  : "Choose a question to view its details, answer variations, and related misconceptions."}
              </p>
            </div>

            <ul className="overflow-hidden rounded-xl border border-border bg-white">
              {questions.map((question) => (
                <li key={question.id} className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() => onSelectQuestion(question.id)}
                    className="group grid w-full cursor-pointer gap-4 px-4 py-5 text-left transition-colors hover:bg-neutral/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:grid-cols-[6rem_minmax(0,1fr)_auto] sm:px-5"
                  >
                    <div>
                      <p className="text-[11px] font-semibold text-muted">
                        {language === "id" ? "Contoh soal" : "Example"}
                      </p>
                      <p className="mt-1 text-base font-extrabold text-navy-deep transition-colors group-hover:text-brand">
                        {question.number}
                      </p>
                    </div>

                    <div className="min-w-0">
                      <p className="line-clamp-3 text-[15px] font-semibold leading-6 text-navy-deep">
                        {t(question.prompt, language)}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="font-medium">
                          {question.type === "short_answer"
                            ? t(uiText.filterShortAnswer, language)
                            : t(uiText.filterMultipleChoice, language)}
                        </span>
                        {question.expectedConcepts.slice(0, 2).map((concept) => (
                          <span key={t(concept, language)} className="rounded bg-neutral px-2 py-1 font-medium">
                            {t(concept, language)}
                          </span>
                        ))}
                        {question.questionMisconceptionIds.length > 0 && (
                          <span>
                            {question.questionMisconceptionIds.length}{" "}
                            {language === "id" ? "miskonsepsi terkait" : "related misconceptions"}
                          </span>
                        )}
                      </div>
                    </div>

                    <span className="inline-flex w-fit items-center gap-2 self-center rounded-lg bg-brand-soft px-3 py-2 text-xs font-semibold text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                      <BookOpenCheck size={15} strokeWidth={2} aria-hidden="true" />
                      {language === "id" ? "Lihat soal" : "View question"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
