import assert from "node:assert/strict";
import {
  buildMisconceptionReasonPresentation,
  groupMisconceptionReasons,
} from "../src/utils/misconceptionReasons.ts";

assert.deepEqual(groupMisconceptionReasons(1, ["A", "B"]), [["A", "B"]]);
assert.deepEqual(groupMisconceptionReasons(2, ["A", "B"]), [["A"], ["B"]]);
assert.deepEqual(groupMisconceptionReasons(2, ["A", "B", "C"]), [["A"], ["B", "C"]]);
assert.deepEqual(groupMisconceptionReasons(3, ["A"]), [["A"], [], []]);

const sqReason = {
  id: "Perhitungan dilakukan sebelum seluruh input tersedia.",
  en: "The calculation is performed before all input is available.",
};
const generalReason = {
  id: "Urutan operasi perlu diperiksa kembali.",
  en: "The operation order needs another review.",
};
const presentation = buildMisconceptionReasonPresentation(
  ["SQ-03", "VA-14"],
  [
    { misconceptionId: "SQ-03", reasons: [sqReason, sqReason] },
    { misconceptionId: "missing", reasons: [generalReason] },
  ],
  [generalReason],
  "id",
);

assert.deepEqual(presentation.cards, [
  { misconceptionId: "SQ-03", reasons: [sqReason] },
  { misconceptionId: "VA-14", reasons: [] },
]);
assert.deepEqual(presentation.generalReasons, [generalReason]);
assert.deepEqual(
  buildMisconceptionReasonPresentation([], [], [generalReason], "en"),
  { cards: [], generalReasons: [generalReason] },
  "a general reason must not create a fake misconception card",
);
assert.deepEqual(
  buildMisconceptionReasonPresentation(
    ["SQ-03", "VA-14"],
    [{ misconceptionId: "SQ-03", reasons: [sqReason] }],
    [sqReason],
    "en",
  ).generalReasons,
  [],
  "a mapped reason must not be repeated as a general note",
);
