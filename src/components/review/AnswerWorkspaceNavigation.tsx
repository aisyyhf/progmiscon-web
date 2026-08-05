import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
} from "lucide-react";
import type { Language } from "../../types";
import { cn } from "../../utils/cn";

export function ParentQuestionBackAction({
  language,
  onClick,
  className,
}: {
  language: Language;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group inline-flex h-8 cursor-pointer items-center gap-1.5 rounded px-2 text-xs font-semibold text-muted transition-colors hover:bg-brand-soft/50 hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand",
        className,
      )}
    >
      <ArrowLeft
        size={14}
        strokeWidth={2}
        aria-hidden="true"
        className="transition-transform group-hover:-translate-x-0.5"
      />
      {language === "id" ? "Kembali ke soal ini" : "Back to this question"}
    </button>
  );
}

export function SiblingNavigator({
  kind,
  index,
  total,
  language,
  onPrevious,
  onNext,
}: {
  kind: "answer" | "evidence";
  index: number;
  total: number;
  language: Language;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const item = kind === "evidence" ? "Evidence" : language === "id" ? "Jawaban" : "Answer";
  const position = `${item} ${index + 1} ${language === "id" ? "dari" : "of"} ${total}`;
  const previousLabel =
    kind === "evidence"
      ? language === "id"
        ? "Evidence sebelumnya"
        : "Previous evidence"
      : language === "id"
        ? "Jawaban sebelumnya"
        : "Previous answer";
  const nextLabel =
    kind === "evidence"
      ? language === "id"
        ? "Evidence berikutnya"
        : "Next evidence"
      : language === "id"
        ? "Jawaban berikutnya"
        : "Next answer";

  return (
    <nav
      aria-label={
        kind === "evidence"
          ? language === "id"
            ? "Navigasi evidence"
            : "Evidence navigation"
          : language === "id"
            ? "Navigasi jawaban"
            : "Answer navigation"
      }
      className="inline-flex shrink-0 items-center gap-1"
    >
      <button
        type="button"
        onClick={onPrevious}
        disabled={index <= 0}
        aria-label={previousLabel}
        title={previousLabel}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-white text-muted transition-colors hover:border-brand/35 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
      </button>
      <span
        role="status"
        aria-live="polite"
        className="min-w-28 px-1 text-center text-xs font-semibold tabular-nums text-navy-deep"
      >
        {position}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={index < 0 || index >= total - 1}
        aria-label={nextLabel}
        title={nextLabel}
        className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md border border-border bg-white text-muted transition-colors hover:border-brand/35 hover:bg-brand-soft hover:text-brand disabled:cursor-not-allowed disabled:bg-bg disabled:text-muted/35 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
      </button>
    </nav>
  );
}

export function QuestionContextAccordion({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="group flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 rounded-md border border-border bg-bg px-3 py-2 text-left text-sm font-semibold text-navy-deep transition-[background-color,border-color,color] hover:border-brand/30 hover:bg-brand-soft/50 hover:text-brand active:bg-brand-soft sm:w-auto sm:min-w-72 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <span className="flex min-w-0 items-center gap-2">
          <CircleHelp
            size={16}
            strokeWidth={1.9}
            aria-hidden="true"
            className="shrink-0 text-muted transition-colors group-hover:text-brand"
          />
          <span>{label}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={2}
          aria-hidden="true"
          className={cn(
            "shrink-0 text-muted transition-[color,transform] group-hover:text-brand",
            open && "rotate-180",
          )}
        />
      </button>
      {open && (
        <div id={id} className="mt-3 rounded-md border border-border bg-bg/50 p-4">
          {children}
        </div>
      )}
    </section>
  );
}
