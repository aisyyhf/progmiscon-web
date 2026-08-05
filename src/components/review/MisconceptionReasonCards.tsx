import type { LocalizedText, Misconception } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { misconceptionLabel } from "../../utils/misconceptionLabel";
import { t } from "../../utils/translation";

type MappedReason = {
  misconceptionId: string;
  reasons: LocalizedText[];
};

function Reason({ reasons }: { reasons: LocalizedText[] }) {
  const { language } = useLanguage();
  const visibleReasons = reasons.filter((reason) => t(reason, language).trim());

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="text-xs font-bold text-muted">
        {language === "id" ? "Alasan" : "Reason"}
      </p>
      {visibleReasons.length > 0 ? (
        <div className="mt-1.5 space-y-1 whitespace-pre-wrap text-sm leading-6 text-navy-deep">
          {visibleReasons.map((reason, index) => (
            <p key={index}>{t(reason, language)}</p>
          ))}
        </div>
      ) : (
        <p className="mt-1.5 text-sm leading-6 text-muted">
          {language === "id"
            ? "Alasan belum tersedia"
            : "A reason is not available yet"}
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
  mappedReasons?: MappedReason[];
  generalReasons?: LocalizedText[];
}) {
  const { language } = useLanguage();
  const misconceptionById = new Map(
    misconceptions.map((misconception) => [misconception.id, misconception]),
  );
  const specificCards = mappedReasons
    .map((mapping) => ({
      misconception: misconceptionById.get(mapping.misconceptionId),
      reasons: mapping.reasons,
    }))
    .filter(
      (card): card is { misconception: Misconception; reasons: LocalizedText[] } =>
        Boolean(card.misconception),
    );
  const mappedIds = new Set(
    specificCards.map((card) => card.misconception.id),
  );
  const sharedMisconceptions = misconceptions.filter(
    (misconception) => !mappedIds.has(misconception.id),
  );
  const showGeneralCard =
    sharedMisconceptions.length > 0 ||
    (misconceptions.length === 0 && generalReasons.length > 0);

  return (
    <section aria-labelledby="answer-misconceptions-title">
      <h3 id="answer-misconceptions-title" className="text-base font-bold text-navy-deep">
        {language === "id"
          ? "Miskonsepsi pada Jawaban"
          : "Misconceptions in the Answer"}
      </h3>
      {specificCards.length === 0 && !showGeneralCard ? (
        <p className="mt-3 text-sm leading-6 text-muted">
          {language === "id"
            ? "Belum ada miskonsepsi teridentifikasi"
            : "No misconceptions have been identified yet"}
        </p>
      ) : (
        <div className="mt-3 grid gap-3">
          {specificCards.map(({ misconception, reasons }) => (
            <article
              key={misconception.id}
              className="rounded-lg border border-border bg-white px-4 py-3.5"
            >
              <p className="text-sm font-semibold leading-6 text-navy-deep">
                {misconceptionLabel(misconception, language)}
              </p>
              <Reason reasons={reasons} />
            </article>
          ))}
          {showGeneralCard && (
            <article className="rounded-lg border border-border bg-white px-4 py-3.5">
              {sharedMisconceptions.length > 0 ? (
                <div className="space-y-1">
                  {sharedMisconceptions.map((misconception) => (
                    <p
                      key={misconception.id}
                      className="text-sm font-semibold leading-6 text-navy-deep"
                    >
                      {misconceptionLabel(misconception, language)}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-sm font-semibold leading-6 text-navy-deep">
                  {language === "id"
                    ? "Penjelasan evidence"
                    : "Evidence explanation"}
                </p>
              )}
              <Reason reasons={generalReasons} />
            </article>
          )}
        </div>
      )}
    </section>
  );
}
