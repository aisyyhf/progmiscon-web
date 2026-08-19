import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { tokenizePseudocode } from "../src/utils/pseudocodeHighlight.ts";

const component = await readFile(
  new URL("../src/components/review/PseudocodeBlock.tsx", import.meta.url),
  "utf8",
);
const answerCasePanel = await readFile(
  new URL("../src/components/review/AnswerCasePanel.tsx", import.meta.url),
  "utf8",
);

const source = 'IF total >= 10 THEN\n  PRINT "Valid" // hasil\nEND IF';
const tokens = tokenizePseudocode(source);

assert.equal(tokens.map((token) => token.text).join(""), source);
assert(tokens.some((token) => token.text === "IF" && token.kind === "keyword"));
assert(tokens.some((token) => token.text === "total" && token.kind === "variable"));
assert(tokens.some((token) => token.text === "10" && token.kind === "number"));
assert(tokens.some((token) => token.text === '"Valid"' && token.kind === "string"));
assert(tokens.some((token) => token.text === "// hasil" && token.kind === "comment"));
assert.match(component, /bg-navy-deep/);
assert.match(component, /max-w-full overflow-x-auto whitespace-pre/);
assert.equal(component.match(/text-\[#e7b66d\]/g)?.length, 2);
for (const color of ["#f08a9b", "#e7b66d", "#c5a7f2", "#9fc0ff", "#8ecf9d", "#b8d7ea"]) {
  assert.ok(component.includes(color));
}
assert.doesNotMatch(component, /FCF2E5|whitespace-pre-wrap|break-words/);
assert.match(answerCasePanel, /min-w-0 space-y-6/);
assert.match(answerCasePanel, /min-w-0 overflow-hidden rounded-lg/);
