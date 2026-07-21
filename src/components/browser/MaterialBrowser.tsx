import type { Category, Question } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { EmptyState } from "../common/EmptyState";
import { ArrowRight } from "lucide-react";

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
    <div className="scroll-reveal grid gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <aside className="rounded-xl border border-border bg-white p-3.5 shadow-[0_1px_2px_rgba(33,29,27,0.04)] lg:sticky lg:top-20 lg:h-[calc(100dvh-6rem)] lg:overflow-y-auto">
        <h1 className="px-2 pb-3 pt-1 text-lg font-extrabold tracking-tight text-brand">
          {language === "id" ? "Materi Pemrograman" : "Programming Materials"}
        </h1>
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
                  "min-h-10 cursor-pointer rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
                  active
                    ? "bg-brand text-white shadow-[0_3px_10px_rgba(143,28,32,0.12)]"
                    : "bg-white text-navy-deep hover:bg-brand-soft hover:text-brand",
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
          <header className="pb-5">
            <h2 id="selected-material-title" className="text-2xl font-extrabold tracking-tight text-navy-deep">
              {questions.length} {language === "id" ? "Contoh Soal" : "Example Questions"}
            </h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted">
              {language === "id"
                ? "Pilih soal untuk melihat rincian, variasi jawaban, dan miskonsepsi yang terkait."
                : "Choose a question to view its details, answer variations, and related misconceptions."}
            </p>
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
            <ul className="grid gap-4 md:grid-cols-2">
              {questions.map((question) => (
                <li
                  key={question.id}
                  className="flex h-full"
                >
                  <button
                    type="button"
                    onClick={() => onSelectQuestion(question.id)}
                    className="group flex min-h-64 w-full cursor-pointer flex-col rounded-xl border border-border bg-white p-5 text-left shadow-[0_2px_8px_rgba(33,29,27,0.05)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-brand/30 hover:shadow-[0_8px_24px_rgba(33,29,27,0.08)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                  >
                    <div className="min-w-0">
                      <p className="whitespace-pre-line text-base font-normal leading-6 text-navy-deep transition-colors group-hover:text-brand">
                        {t(question.prompt, language)}
                      </p>
                    </div>

                    <div className="mt-auto pt-5">
                      <p className="inline-flex rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand-deep">
                        {question.questionMisconceptionIds.length}{" "}
                        {language === "id" ? "miskonsepsi terkait" : "related misconceptions"}
                      </p>

                      <span className="mt-7 flex w-fit items-center gap-2 rounded-md bg-brand px-3.5 py-2.5 text-xs font-semibold text-white transition-colors group-hover:bg-brand-deep">
                        {language === "id" ? "Lihat soal" : "View question"}
                        <ArrowRight size={15} strokeWidth={2} aria-hidden="true" />
                      </span>
                    </div>
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
