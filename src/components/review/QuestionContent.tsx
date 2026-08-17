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
      <div className="space-y-3">
        {blocks.map((block, index) =>
          block.type === "code" ? (
            <div key={`${block.type}-${index}`} className="min-w-0 overflow-hidden rounded-md border border-navy-deep/15">
              <PseudocodeBlock code={block.content} />
            </div>
          ) : (
            <p key={`${block.type}-${index}`} className="max-w-4xl whitespace-pre-wrap text-xs font-normal leading-5 text-navy-deep">
              {block.content}
            </p>
          ),
        )}
      </div>

      {sampleCases.length > 0 && (
        <section className="mt-3 border-t border-border pt-3" aria-label="Contoh masukan dan keluaran">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed border-collapse text-left text-xs leading-4 text-navy-deep">
              <caption className="mb-1.5 text-left text-xs font-semibold leading-5 text-navy-deep">
                Contoh kasus
              </caption>
              <thead className="bg-[var(--review-secondary-soft)]">
                <tr>
                  <th scope="col" className="border border-[#ccbab0]/80 px-2.5 py-1.5 font-semibold">
                    Masukan
                  </th>
                  <th scope="col" className="border border-[#ccbab0]/80 px-2.5 py-1.5 font-semibold">
                    Keluaran
                  </th>
                </tr>
              </thead>
              <tbody>
                {sampleCases.map((sample, index) => (
                  <tr key={`${sample.input}\u0000${sample.output}-${index}`} className="odd:bg-white even:bg-[var(--review-secondary-soft)]">
                    <td className="border border-[#ccbab0]/70 px-2.5 py-1.5 align-top">
                      <pre className="overflow-auto whitespace-pre-wrap break-words font-mono font-normal leading-4">{sample.input}</pre>
                    </td>
                    <td className="border border-[#ccbab0]/70 px-2.5 py-1.5 align-top">
                      <pre className="overflow-auto whitespace-pre-wrap break-words font-mono font-normal leading-4">{sample.output}</pre>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
