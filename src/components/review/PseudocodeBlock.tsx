import { tokenizePseudocode, type PseudocodeTokenKind } from "../../utils/pseudocodeHighlight";

const tokenClasses: Record<PseudocodeTokenKind, string> = {
  plain: "text-[#524646]",
  keyword: "font-semibold text-[#EC5B38]",
  type: "font-medium text-[#6F625F]",
  literal: "text-[#7B594F]",
  number: "text-[#7B594F]",
  string: "text-[#7B594F]",
  operator: "font-medium text-[#EC5B38]",
  comment: "italic text-[#777466]",
  variable: "text-[#524646]",
};

export function PseudocodeBlock({ code }: { code: string }) {
  return (
    <pre className="overflow-x-auto whitespace-pre-wrap break-words bg-[#FCF2E5] p-4 font-mono text-[13px] leading-6 selection:bg-[#A8A492]/35">
      <code>
        {tokenizePseudocode(code).map((token, index) => (
          <span key={`${index}-${token.text}`} className={tokenClasses[token.kind]}>
            {token.text}
          </span>
        ))}
      </code>
    </pre>
  );
}
