import type { Question, QuestionContentBlock } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t } from "../../utils/translation";
import { PseudocodeBlock } from "./PseudocodeBlock";
import { getQuestionReference } from "../../utils/questionReference";

function fallbackBlocks(question: Question, language: "id" | "en"): QuestionContentBlock[] {
  const prompt = t(question.prompt, language).trim();
  const code = getQuestionReference(question).pseudocode;
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
  const inputDescription = question.inputDescription
    ? t(question.inputDescription, language).trim()
    : "";
  const outputDescription = question.outputDescription
    ? t(question.outputDescription, language).trim()
    : "";
  const inputLabel = language === "id" ? "Masukan" : "Input";
  const outputLabel = language === "id" ? "Keluaran" : "Output";

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

      {(inputDescription || outputDescription) && (
        <dl className="mt-3 space-y-1.5 text-xs font-normal leading-5 text-navy-deep">
          {inputDescription && (
            <div>
              <dt className="inline font-semibold">{inputLabel}:</dt>{" "}
              <dd className="inline">{inputDescription}</dd>
            </div>
          )}
          {outputDescription && (
            <div>
              <dt className="inline font-semibold">{outputLabel}:</dt>{" "}
              <dd className="inline">{outputDescription}</dd>
            </div>
          )}
        </dl>
      )}

      {sampleCases.length > 0 && (
        <section className="mt-3 border-t border-border pt-3" aria-label={language === "id" ? "Contoh masukan dan keluaran" : "Input and output examples"}>
          <div className="overflow-x-auto">
            <div className="min-w-full sm:w-fit sm:min-w-[52%] sm:max-w-full">
              <table className="w-full table-auto border-collapse text-left text-xs leading-4 text-navy-deep">
              <caption className="mb-1.5 text-left text-xs font-semibold leading-5 text-navy-deep">
                {language === "id" ? "Contoh kasus" : "Test cases"}
              </caption>
              <thead className="bg-[var(--review-secondary-soft)]">
                <tr>
                  <th scope="col" className="border border-[#ccbab0]/80 px-2.5 py-1.5 font-semibold">
                    {inputLabel}
                  </th>
                  <th scope="col" className="border border-[#ccbab0]/80 px-2.5 py-1.5 font-semibold">
                    {outputLabel}
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
          </div>
        </section>
      )}
    </div>
  );
}
