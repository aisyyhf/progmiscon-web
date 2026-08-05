import type { LocalizedText, Misconception } from "../../types";
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
      <p className="text-xs font-bold text-muted">
        {language === "id" ? "Alasan" : "Reason"}
      </p>
      {reasons.length > 0 ? (
        <div className="mt-1.5 space-y-1 whitespace-pre-wrap text-sm leading-6 text-navy-deep">
          {reasons.map((reason, index) => (
            <p key={index}>{t(reason, language)}</p>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-sm leading-6 text-muted">
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
    <section aria-labelledby="answer-misconceptions-title">
      <h3 id="answer-misconceptions-title" className="text-base font-bold text-navy-deep">
        {language === "id"
          ? "Miskonsepsi pada Jawaban"
          : "Misconceptions in the Answer"}
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
                className="min-w-0 rounded-md border border-border bg-white px-4 py-3.5"
              >
                <p className="text-sm font-semibold leading-6 text-navy-deep">
                  {misconceptionLabel(misconception, language)}
                </p>
                <Reason reasons={reasons} />
              </article>
            ) : null;
          })}
          {presentation.generalReasons.length > 0 && (
            <article className="min-w-0 rounded-md border border-border bg-bg px-4 py-3.5">
              <p className="text-sm font-bold leading-6 text-navy-deep">
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
