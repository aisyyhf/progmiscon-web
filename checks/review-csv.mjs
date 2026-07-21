import assert from "node:assert/strict";
import { serializeCsv } from "../src/utils/reviewCsv.ts";

const csv = serializeCsv(
  ["reviewer_name", "comment"],
  [["Dosen, Satu", 'Baris "pertama"\nBaris kedua'], [null, ""]],
);

assert.equal(
  csv,
  '\uFEFFreviewer_name,comment\r\n"Dosen, Satu","Baris ""pertama""\nBaris kedua"\r\n,',
);
