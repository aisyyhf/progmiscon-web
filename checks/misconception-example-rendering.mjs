import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeMultilineCode } from "../src/utils/multilineCode.ts";

const fixture = `program HitungLuas
konstanta
    luas = panjang * lebar
kamus
    panjang, lebar : real
algoritma
    input(panjang)
    input(lebar)
    output(luas)
endprogram
// luas dianggap konstanta walaupun nilainya dihitung dari input`;

const normalized = normalizeMultilineCode(fixture.replaceAll("\n", "\r\n"));

assert.equal(normalized, fixture);
assert.equal(normalized.split("\n").length, 11);
assert(normalized.includes("kamus"));
assert(normalized.includes("algoritma"));
assert(normalized.includes("endprogram"));
assert(normalized.endsWith("// luas dianggap konstanta walaupun nilainya dihitung dari input"));

const componentSource = await readFile(
  new URL("../src/components/misconception/MisconceptionCompare.tsx", import.meta.url),
  "utf8",
);

assert(!componentSource.includes("splitSnippet"));
assert.equal(componentSource.match(/<pre\b/g)?.length, 1);
assert.equal(componentSource.match(/<code>/g)?.length, 1);
assert(componentSource.includes("whitespace-pre-wrap"));
assert(componentSource.includes("[overflow-wrap:anywhere]"));
assert(componentSource.includes("max-w-full"));
