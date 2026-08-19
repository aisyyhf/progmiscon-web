import { tokenizePseudocode, type PseudocodeTokenKind } from "../../utils/pseudocodeHighlight";

const tokenClasses: Record<PseudocodeTokenKind, string> = {
  plain: "text-[#d8dee9]",
  keyword: "font-semibold text-[#f08a9b]",
  type: "text-[#e7b66d]",
  literal: "text-[#c5a7f2]",
  number: "text-[#9fc0ff]",
  string: "text-[#8ecf9d]",
  operator: "text-[#e7b66d]",
  comment: "italic text-[#8f969e]",
  variable: "text-[#b8d7ea]",
};

export function PseudocodeBlock({ code }: { code: string }) {
  return (
    <pre className="max-w-full overflow-x-auto whitespace-pre bg-navy-deep p-4 font-mono text-[13px] leading-6 text-[#d8dee9] selection:bg-white/20 sm:p-5">
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
