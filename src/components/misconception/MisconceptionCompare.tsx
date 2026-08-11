import type { LocalizedText } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { CheckCircle2, XCircle } from "lucide-react";
import { normalizeMultilineCode } from "../../utils/multilineCode";

export function MisconceptionCompare({
  wrong,
  correct,
  wrongAvailable = true,
  correctAvailable = true,
  compact = false,
}: {
  wrong: LocalizedText;
  correct: LocalizedText;
  wrongAvailable?: boolean;
  correctAvailable?: boolean;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const wrongText = normalizeMultilineCode(t(wrong, language));
  const correctText = normalizeMultilineCode(t(correct, language));

  const items = [
    {
      label: t(uiText.drawerWrong, language),
      tone: "border-incorrect-border bg-incorrect-bg",
      heading: "text-incorrect",
      content: wrongText,
      available: wrongAvailable,
      icon: XCircle,
    },
    {
      label: t(uiText.drawerCorrect, language),
      tone: "border-correct-border bg-correct-bg",
      heading: "text-correct",
      content: correctText,
      available: correctAvailable,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
        <section key={item.label} className={`min-w-0 rounded-lg border p-5 ${item.tone}`}>
          <p className={`flex items-center gap-2 text-sm font-bold ${item.heading}`}>
            <Icon size={17} strokeWidth={2} aria-hidden="true" />
            {item.label}
          </p>
          {item.available && item.content ? (
            <pre
              className={`mt-3 max-w-full whitespace-pre-wrap [overflow-wrap:anywhere] rounded-md border border-current/10 bg-white/65 px-3 py-2 font-mono text-xs leading-5 text-navy-deep ${
                compact ? "max-h-32 overflow-hidden" : ""
              }`}
            >
              <code>{item.content}</code>
            </pre>
          ) : (
            <p className="mt-3 rounded-md border border-current/10 bg-white/65 px-3 py-4 text-xs leading-5 text-muted">
              {language === "id" ? "Belum tersedia" : "Not available yet"}
            </p>
          )}
        </section>
        );
      })}
    </div>
  );
}
