import type { LocalizedText } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { CheckCircle2, XCircle } from "lucide-react";

function splitSnippet(text: string): { snippet: string; explanation: string } {
  const lines = text.split("\n");
  const splitIndex = lines.findIndex((line) => line.trim() === "");
  if (splitIndex === -1) {
    const firstExplanationLine = lines.findIndex((line) => {
      const trimmed = line.trim();
      return trimmed !== "" && !/[←=<>]|\b(IF|FOR|WHILE|PRINT|READ|RETURN|FUNCTION|END|ELSE|THEN|DO)\b/i.test(trimmed);
    });
    if (firstExplanationLine > 0) {
      return {
        snippet: lines.slice(0, firstExplanationLine).join("\n"),
        explanation: lines.slice(firstExplanationLine).join("\n"),
      };
    }
    return { snippet: lines.slice(0, 3).join("\n"), explanation: lines.slice(3).join("\n") };
  }
  return {
    snippet: lines.slice(0, splitIndex).join("\n"),
    explanation: lines.slice(splitIndex + 1).join("\n"),
  };
}

export function MisconceptionCompare({
  wrong,
  correct,
  compact = false,
}: {
  wrong: LocalizedText;
  correct: LocalizedText;
  compact?: boolean;
}) {
  const { language } = useLanguage();
  const wrongText = splitSnippet(t(wrong, language));
  const correctText = splitSnippet(t(correct, language));

  const items = [
    {
      label: t(uiText.drawerWrong, language),
      tone: "border-incorrect-border bg-incorrect-bg",
      heading: "text-incorrect",
      content: wrongText,
      icon: XCircle,
    },
    {
      label: t(uiText.drawerCorrect, language),
      tone: "border-correct-border bg-correct-bg",
      heading: "text-correct",
      content: correctText,
      icon: CheckCircle2,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((item) => {
        const Icon = item.icon;
        return (
        <section key={item.label} className={`rounded-lg border p-5 ${item.tone}`}>
          <p className={`flex items-center gap-2 text-sm font-bold ${item.heading}`}>
            <Icon size={17} strokeWidth={2} aria-hidden="true" />
            {item.label}
          </p>
          {item.content.snippet && (
            <pre
              className={`mt-3 whitespace-pre-wrap rounded-md border border-current/10 bg-white/65 px-3 py-2 font-mono text-xs leading-5 text-navy-deep ${
                compact ? "max-h-32 overflow-hidden" : ""
              }`}
            >
              {item.content.snippet}
            </pre>
          )}
          {item.content.explanation && (
            <p className="mt-3 text-sm leading-6 text-navy-deep">{item.content.explanation}</p>
          )}
        </section>
        );
      })}
    </div>
  );
}
