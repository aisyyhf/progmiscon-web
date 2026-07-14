import assert from "node:assert/strict";
import { prioritizeMisconceptions } from "../src/utils/reviewPriority.ts";

const misconceptions = [{ id: "m1" }, { id: "m2" }, { id: "m3" }];

assert.deepEqual(
  prioritizeMisconceptions(misconceptions, ["m3", "m1", "m3", "missing"]).map((item) => item.id),
  ["m3", "m1"],
);
