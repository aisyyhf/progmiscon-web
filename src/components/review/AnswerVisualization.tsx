import { useLanguage } from "../../hooks/useLanguage";

export function AnswerVisualization() {
  const { language } = useLanguage();

  return (
    <section className="rounded-lg border border-border bg-bg p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {language === "id" ? "Visualisasi Jawaban" : "Answer Visualization"}
      </p>
      <p className="mt-1 text-sm text-muted">
        {language === "id"
          ? "Visualisasi tree jawaban akan ditampilkan pada bagian ini."
          : "The answer tree visualization will be displayed in this section."}
      </p>
      <div className="mt-4 grid max-w-md grid-cols-[1fr_1fr] gap-x-4 gap-y-3 text-xs text-navy-deep">
        <div className="col-span-2 justify-self-center rounded-md border border-brand/30 bg-white px-3 py-2">
          START
        </div>
        <div className="col-span-2 h-4 justify-self-center border-l border-border" />
        <div className="col-span-2 justify-self-center rounded-md border border-border bg-white px-3 py-2">
          READ / TRACE
        </div>
        <div className="col-span-2 h-4 justify-self-center border-l border-border" />
        <div className="justify-self-end rounded-md border border-border bg-white px-3 py-2">CHECK</div>
        <div className="justify-self-start rounded-md border border-border bg-white px-3 py-2">OUTPUT</div>
      </div>
    </section>
  );
}
