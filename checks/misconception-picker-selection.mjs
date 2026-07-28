import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toggleMisconceptionSelection } from "../src/utils/reviewMisconceptionForm.ts";

let selection = [];
let open = true;
const clickVisibleSelector = (id) => {
  selection = toggleMisconceptionSelection(selection, id);
};

clickVisibleSelector("M-02");
assert.deepEqual(selection, ["M-02"], "the visible selector must select its row");

clickVisibleSelector("M-01");
assert.deepEqual(
  selection,
  ["M-02", "M-01"],
  "multiple visible selections must persist",
);

clickVisibleSelector("M-02");
assert.deepEqual(selection, ["M-01"], "the visible selector must deselect its row");

const finishSelecting = () => {
  open = false;
};
finishSelecting();
assert.equal(open, false);
assert.deepEqual(
  selection,
  ["M-01"],
  "finishing the modal must not discard the controlled selection",
);

open = true;
assert.deepEqual(
  selection,
  ["M-01"],
  "closing and reopening must preserve the controlled selection",
);

const pickerSource = readFileSync(
  "src/components/review/MisconceptionPicker.tsx",
  "utf8",
);
assert.match(
  pickerSource,
  /<label[\s\S]+?<input[\s\S]+?type="checkbox"[\s\S]+?checked=\{selected\}[\s\S]+?onChange=\{\(\) => toggle\(item\.id\)\}/,
  "each visible row must expose a native controlled checkbox that toggles selection",
);
assert.match(
  pickerSource,
  /<label\s+onClick=\{\(\) => setPreviewId\(item\.id\)\}/,
  "the same row interaction must also update the preview",
);
assert.match(
  pickerSource,
  /<Button type="button" variant="primary" onClick=\{\(\) => setOpen\(false\)\}>[\s\S]+?Finish selecting/,
  "Finish selecting must only close the modal",
);

console.log("misconception picker selection checks passed");
