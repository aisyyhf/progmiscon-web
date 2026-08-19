import assert from "node:assert/strict";
import { buildRelatedMisconceptionMap } from "../src/utils/similarMisconceptions.ts";

const row = (misconceptionId, similarId, status) => ({
  misconception_id: misconceptionId,
  similar_id: similarId,
  note_ind: "",
  note_en: "",
  status,
});

const related = buildRelatedMisconceptionMap([
  row("SQ-01", "SQ-05", "approved"),
  row("SQ-01", "CD-06", "pending"),
  row("CD-06", "SQ-01", "pending"),
  row("SQ-01", "LO-13", "rejected"),
  row("SQ-01", "SQ-01", "pending"),
]);

assert.deepEqual(
  [...(related.get("SQ-01") ?? [])].sort(),
  ["CD-06", "SQ-05"],
  "approved and pending relationships are included without duplicates or self-links",
);
assert.deepEqual(
  [...(related.get("CD-06") ?? [])],
  ["SQ-01"],
  "relationships are available from either direction",
);
assert.equal(related.has("LO-13"), false, "rejected relationships stay hidden");

console.log("Similar misconception relationship checks passed.");
