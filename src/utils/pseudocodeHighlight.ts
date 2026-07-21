export type PseudocodeTokenKind =
  | "plain"
  | "keyword"
  | "type"
  | "literal"
  | "number"
  | "string"
  | "operator"
  | "comment"
  | "variable";

export type PseudocodeToken = {
  text: string;
  kind: PseudocodeTokenKind;
};

const keywords = new Set([
  "algoritma",
  "and",
  "begin",
  "baca",
  "do",
  "else",
  "end",
  "endfor",
  "endif",
  "endprogram",
  "endwhile",
  "for",
  "function",
  "fungsi",
  "if",
  "input",
  "jika",
  "kamus",
  "kembalikan",
  "maka",
  "not",
  "or",
  "output",
  "print",
  "procedure",
  "program",
  "prosedur",
  "read",
  "return",
  "sampai",
  "selama",
  "then",
  "to",
  "tulis",
  "untuk",
  "while",
]);

const types = new Set([
  "array",
  "bilangan",
  "boolean",
  "bulat",
  "char",
  "integer",
  "real",
  "riil",
  "string",
]);

const literals = new Set(["benar", "false", "salah", "true"]);

const tokenPattern =
  /\/\/[^\n]*|#[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|←|<-|:=|<=|>=|<>|[+\-*/%=<>]|\b[A-Za-z_][A-Za-z0-9_]*\b|\s+|./g;

export function tokenizePseudocode(source: string): PseudocodeToken[] {
  return (source.match(tokenPattern) ?? []).map((text) => {
    const normalized = text.toLocaleLowerCase();

    if (/^\s+$/.test(text)) return { text, kind: "plain" };
    if (text.startsWith("//") || text.startsWith("#")) return { text, kind: "comment" };
    if (text.startsWith('"') || text.startsWith("'")) return { text, kind: "string" };
    if (/^\d/.test(text)) return { text, kind: "number" };
    if (/^(?:←|<-|:=|<=|>=|<>|[+\-*/%=<>])$/.test(text)) return { text, kind: "operator" };
    if (keywords.has(normalized)) return { text, kind: "keyword" };
    if (types.has(normalized)) return { text, kind: "type" };
    if (literals.has(normalized)) return { text, kind: "literal" };
    if (/^[A-Za-z_]/.test(text)) return { text, kind: "variable" };
    return { text, kind: "plain" };
  });
}
