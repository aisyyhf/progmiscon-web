import type { LocalizedText, Misconception } from "../../types";
import { ArrowRight, BrainCircuit } from "lucide-react";
import { useLanguage } from "../../hooks/useLanguage";
import { misconceptionLabel } from "../../utils/misconceptionLabel";
import {
  buildMisconceptionReasonPresentation,
  type MappedMisconceptionReason,
} from "../../utils/misconceptionReasons";
import { t } from "../../utils/translation";

function Reason({ reasons }: { reasons: LocalizedText[] }) {
  const { language } = useLanguage();

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-xs font-medium leading-[18px] text-muted">
        {language === "id" ? "Alasan" : "Reason"}
      </p>
      {reasons.length > 0 ? (
        <div className="mt-1.5 space-y-1 whitespace-pre-wrap text-sm font-normal leading-6 text-navy-deep">
          {reasons.map((reason, index) => (
            <p key={index}>{t(reason, language)}</p>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-sm font-normal leading-6 text-muted">
          {language === "id"
            ? "Alasan belum tersedia"
            : "Reason not yet available"}
        </p>
      )}
    </div>
  );
}

export function MisconceptionReasonCards({
  misconceptions,
  mappedReasons = [],
  generalReasons = [],
}: {
  misconceptions: Misconception[];
  mappedReasons?: MappedMisconceptionReason[];
  generalReasons?: LocalizedText[];
}) {
  const { language } = useLanguage();
  const misconceptionById = new Map(
    misconceptions.map((misconception) => [misconception.id, misconception]),
  );
  const presentation = buildMisconceptionReasonPresentation(
    misconceptions.map(({ id }) => id),
    mappedReasons,
    generalReasons,
    language,
  );

  return (
    <section aria-label={language === "id" ? "Miskonsepsi pada jawaban" : "Misconceptions in the answer"}>
      <h3 className="flex items-center gap-2 text-base font-semibold leading-6 text-navy-deep">
        <BrainCircuit size={17} strokeWidth={1.9} aria-hidden="true" className="text-brand" />
        <span>
          {language === "id"
            ? "Miskonsepsi pada Jawaban"
            : "Misconceptions in the Answer"}
        </span>
      </h3>
      {presentation.cards.length === 0 && presentation.generalReasons.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          {language === "id"
            ? "Belum ada miskonsepsi teridentifikasi"
            : "No misconceptions have been identified yet"}
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {presentation.cards.map(({ misconceptionId, reasons }) => {
            const misconception = misconceptionById.get(misconceptionId);
            return misconception ? (
              <article
                key={misconception.id}
                className="min-w-0 rounded-r-lg border border-border border-l-2 border-l-brand/55 bg-white px-4 py-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium leading-6 text-navy-deep">
                    {misconceptionLabel(misconception, language)}
                  </p>
                  <ArrowRight size={15} strokeWidth={1.8} aria-hidden="true" className="mt-1 shrink-0 text-muted" />
                </div>
                <Reason reasons={reasons} />
              </article>
            ) : null;
          })}
          {presentation.generalReasons.length > 0 && (
            <article className="min-w-0 rounded-r-lg border border-border border-l-2 border-l-[#b09f85] bg-bg px-4 py-3.5">
              <p className="text-sm font-medium leading-6 text-navy-deep">
                {language === "id" ? "Catatan umum jawaban" : "General answer note"}
              </p>
              <div className="mt-2 space-y-1 whitespace-pre-wrap text-sm leading-6 text-navy-deep">
                {presentation.generalReasons.map((reason, index) => (
                  <p key={index}>{t(reason, language)}</p>
                ))}
              </div>
            </article>
          )}
        </div>
      )}
    </section>
  );
}
