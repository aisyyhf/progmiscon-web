import assert from "node:assert/strict";
import { groupMisconceptionReasons } from "../src/utils/misconceptionReasons.ts";

assert.deepEqual(groupMisconceptionReasons(1, ["A", "B"]), [["A", "B"]]);
assert.deepEqual(groupMisconceptionReasons(2, ["A", "B"]), [["A"], ["B"]]);
assert.deepEqual(groupMisconceptionReasons(2, ["A", "B", "C"]), [["A"], ["B", "C"]]);
assert.deepEqual(groupMisconceptionReasons(3, ["A"]), [["A"], [], []]);
