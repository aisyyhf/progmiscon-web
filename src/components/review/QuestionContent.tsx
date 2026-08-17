import type { Question, QuestionContentBlock } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { PseudocodeBlock } from "./PseudocodeBlock";
import { getQuestionReference } from "../../utils/questionReference";

function fallbackBlocks(question: Question, language: "id" | "en"): QuestionContentBlock[] {
  const prompt = t(question.prompt, language).trim();
  const code = question.questionCode?.trim() || getQuestionReference(question).pseudocode;
  const text = code && prompt.endsWith(code) ? prompt.slice(0, -code.length).trimEnd() : prompt;
  return [
    ...(text ? [{ type: "text" as const, content: text }] : []),
    ...(code ? [{ type: "code" as const, content: code }] : []),
  ];
}

export function QuestionContent({ question }: { question: Question }) {
  const { language } = useLanguage();
  const blocks = question.contentBlocks?.[language]?.length
    ? question.contentBlocks[language]
    : fallbackBlocks(question, language);
  const sampleCases = question.sampleCases ?? [];

  return (
    <div className="review-question-content min-w-0">
      <div className="space-y-4">
        {blocks.map((block, index) =>
          block.type === "code" ? (
            <div key={`${block.type}-${index}`} className="min-w-0 overflow-hidden rounded-md border border-navy-deep/15">
              <PseudocodeBlock code={block.content} />
            </div>
          ) : (
            <p key={`${block.type}-${index}`} className="max-w-4xl whitespace-pre-wrap text-sm leading-7 text-navy-deep">
              {block.content}
            </p>
          ),
        )}
      </div>

      {sampleCases.length > 0 && (
        <section className="mt-6 border-t border-border pt-5" aria-label={language === "id" ? "Contoh masukan dan keluaran" : "Sample input and output"}>
          <h3 className="academic-label">{language === "id" ? "Contoh kasus" : "Sample cases"}</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {sampleCases.map((sample, index) => (
              <article key={`${sample.input}\u0000${sample.output}-${index}`} className="min-w-0 rounded-md border border-border bg-white p-3">
                <p className="text-xs font-bold text-muted">{language === "id" ? "Masukan" : "Input"}</p>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-navy-deep">{sample.input}</pre>
                <p className="mt-3 text-xs font-bold text-muted">{language === "id" ? "Keluaran" : "Output"}</p>
                <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-navy-deep">{sample.output}</pre>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
