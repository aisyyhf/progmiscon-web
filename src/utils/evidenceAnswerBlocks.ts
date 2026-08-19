export type EvidenceAnswerBlock = {
  kind: "code" | "prose";
  text: string;
};

const pseudocodeLinePattern =
  /^(?:program\s+[A-Za-z_]\w*\s*|endprogram\s*|(?:kamus|algoritma|konstanta)\s*:?\s*|(?:begin|end|else|endif|endfor|endwhile)\s*|(?:function|fungsi|procedure|prosedur)\b.*|(?:if|jika)\b.*\b(?:then|maka)\b.*|(?:for|while)\b.*\bdo\b.*|(?:input|output)\s*\(.*|(?:read|print|baca|tulis)\s+.+|(?:return|kembalikan)\s+\S+|(?:[A-Za-z_]\w*(?:\s*,\s*[A-Za-z_]\w*)*)\s*:\s*(?:array|bilangan|boolean|bulat|char|integer|real|riil|string)\b.*|[A-Za-z_]\w*(?:\[[^\]\n]+\])?\s*(?:←|<-|:=|=)\s*\S.*)$/i;

function looksLikePseudocode(value: string) {
  return value
    .split("\n")
    .some((line) => pseudocodeLinePattern.test(line.trim()));
}

export function splitEvidenceAnswerBlocks(
  value: string,
): EvidenceAnswerBlock[] {
  const normalizedValue = value.replace(/\r\n?/g, "\n").trim();

  if (!normalizedValue) {
    return [];
  }

  const blocks: EvidenceAnswerBlock[] = [];

  for (const text of normalizedValue.split(/\n[ \t]*\n+/)) {
    const kind = looksLikePseudocode(text) ? "code" : "prose";
    const previousBlock = blocks.at(-1);

    if (previousBlock?.kind === kind) {
      previousBlock.text += `\n\n${text}`;
    } else {
      blocks.push({ kind, text });
    }
  }

  return blocks;
}
