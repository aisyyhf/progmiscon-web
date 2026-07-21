import { useLanguage } from "../../hooks/useLanguage";

export function AnswerVisualization() {
  const { language } = useLanguage();
  const visualizationLabel =
    language === "id"
      ? "Alur jawaban dari mulai, membaca data, lalu bercabang ke pemeriksaan dan keluaran"
      : "Answer flow from start and reading data to checking and output";

  return (
    <section className="rounded-lg border border-border bg-white p-5">
      <h3 className="text-sm font-bold text-navy-deep">
        {language === "id" ? "Visualisasi Jawaban" : "Answer Visualization"}
      </h3>

      <figure
        aria-label={visualizationLabel}
        className="mt-4 flex w-full flex-col items-center overflow-hidden rounded-lg border border-border bg-bg px-5 py-7 font-mono text-[11px] font-semibold text-navy-deep sm:px-8"
      >
        <div className="min-w-24 rounded-full bg-brand px-5 py-2 text-center text-white shadow-sm">
          START
        </div>

        <div aria-hidden="true" className="h-4 w-px bg-navy/25" />

        <div className="min-w-28 rounded-full border border-navy/20 bg-white px-5 py-2 text-center shadow-sm">
          READ / TRACE
        </div>

        <div aria-hidden="true" className="relative h-7 w-full max-w-sm">
          <span className="absolute left-1/2 top-0 h-3.5 w-px -translate-x-1/2 bg-navy/25" />
          <span className="absolute left-1/4 right-1/4 top-3.5 h-px bg-navy/25" />
          <span className="absolute bottom-0 left-1/4 top-3.5 w-px -translate-x-1/2 bg-navy/25" />
          <span className="absolute bottom-0 left-3/4 top-3.5 w-px -translate-x-1/2 bg-navy/25" />
        </div>

        <div className="grid w-full max-w-sm grid-cols-2 gap-6 sm:gap-12">
          <div className="justify-self-center rounded-full border border-navy/20 bg-white px-5 py-2 text-center shadow-sm">
            CHECK
          </div>
          <div className="justify-self-center rounded-full border border-navy/20 bg-white px-5 py-2 text-center shadow-sm">
            OUTPUT
          </div>
        </div>
      </figure>
    </section>
  );
}
