import { useLanguage } from "../../hooks/useLanguage";

export function AnswerVisualization() {
  const { language } = useLanguage();

  return (
    <section className="academic-panel-quiet p-5">
      <p className="academic-label">
        {language === "id" ? "Visualisasi Jawaban" : "Answer Visualization"}
      </p>
      <div className="mt-4 grid max-w-md grid-cols-[1fr_1fr] gap-x-4 gap-y-2 rounded-md border border-border bg-white p-5 font-mono text-[11px] font-semibold text-navy-deep shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
        <div className="col-span-2 justify-self-center rounded border border-brand/30 bg-brand-soft px-3 py-2 text-brand">
          START
        </div>
        <div className="col-span-2 h-3 justify-self-center border-l border-navy/30" />
        <div className="col-span-2 justify-self-center rounded border border-navy/20 bg-bg px-3 py-2">
          READ / TRACE
        </div>
        <div className="col-span-2 h-3 justify-self-center border-l border-navy/30" />
        <div className="justify-self-end rounded border border-border bg-white px-3 py-2">CHECK</div>
        <div className="justify-self-start rounded border border-border bg-white px-3 py-2">OUTPUT</div>
      </div>
    </section>
  );
}
