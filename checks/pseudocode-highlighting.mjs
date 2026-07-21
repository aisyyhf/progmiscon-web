import assert from "node:assert/strict";
import { tokenizePseudocode } from "../src/utils/pseudocodeHighlight.ts";

const source = 'IF total >= 10 THEN\n  PRINT "Valid" // hasil\nEND IF';
const tokens = tokenizePseudocode(source);

assert.equal(tokens.map((token) => token.text).join(""), source);
assert(tokens.some((token) => token.text === "IF" && token.kind === "keyword"));
assert(tokens.some((token) => token.text === "total" && token.kind === "variable"));
assert(tokens.some((token) => token.text === "10" && token.kind === "number"));
assert(tokens.some((token) => token.text === '"Valid"' && token.kind === "string"));
assert(tokens.some((token) => token.text === "// hasil" && token.kind === "comment"));
