import type { Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { EmptyState } from "../common/EmptyState";
import { BookOpenCheck } from "lucide-react";

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
        <nav
          aria-label={language === "id" ? "Daftar konsep" : "Concept list"}
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
        aria-labelledby={selectedCategory && !loading ? "selected-material-title" : undefined}
      >
        {selectedCategory && !loading && (
          <header className="border-b border-border pb-5">
            <h2 id="selected-material-title" className="text-2xl font-extrabold tracking-tight text-navy-deep">
              {questions.length} {language === "id" ? "Contoh Soal" : "Example Questions"}
            </h2>
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
          <div className="mt-6">
            <ul className="overflow-hidden rounded-xl border border-border bg-bg">
              {questions.map((question) => (
                <li
                  key={question.id}
                  className="border-b-8 border-border/70 bg-white even:bg-neutral/45 last:border-b-0"
                >
                  <button
                    type="button"
                    onClick={() => onSelectQuestion(question.id)}
                    className="group grid w-full cursor-pointer gap-5 px-4 py-6 text-left transition-colors hover:bg-neutral/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand sm:grid-cols-[minmax(0,1fr)_auto] sm:px-5"
                  >
                    <div className="min-w-0">
                      <p className="line-clamp-3 text-base font-bold leading-6 text-navy-deep transition-colors group-hover:text-brand">
                        {t(question.prompt, language)}
                      </p>
                      <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-brand/50" aria-hidden="true" />
                        {question.questionMisconceptionIds.length}{" "}
                        {language === "id" ? "miskonsepsi terkait" : "related misconceptions"}
                      </p>
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
