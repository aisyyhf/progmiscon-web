import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const pageSource = await readFile(
  new URL("../src/pages/MiskonsepsiPage.tsx", import.meta.url),
  "utf8",
);
const repositorySource = await readFile(
  new URL("../src/services/masterDataRepository.ts", import.meta.url),
  "utf8",
);
const translationSource = await readFile(
  new URL("../src/utils/translation.ts", import.meta.url),
  "utf8",
);
const questionReviewSource = await readFile(
  new URL("../src/components/review/QuestionReview.tsx", import.meta.url),
  "utf8",
);

assert.match(translationSource, /Pusat Miskonsepsi/);
assert.match(translationSource, /Misconception Center/);
assert.match(pageSource, /Cari kode atau judul miskonsepsi/);
assert.match(pageSource, /Search by code or misconception title/);
assert.match(pageSource, /filteredMisconceptions\.length/);
assert.match(pageSource, /matchesMisconceptionSearch\(item, query\)/);
assert.match(pageSource, /getRelatedQuestions\(/);
assert.match(pageSource, /\?misconception=\$\{encodeURIComponent\(misconception\.id\)\}/);
assert.doesNotMatch(pageSource, /Related Answer Variations|Variasi Jawaban Terkait/);
assert.doesNotMatch(pageSource, /max-h-\[64vh\]|overflow-y-auto/);

assert.match(repositorySource, /description,/);
assert.match(repositorySource, /hasWrongExample: Boolean\(text\(row\.wrong_example\)\)/);
assert.match(repositorySource, /hasCorrectExample: Boolean\(text\(row\.correct_example\)\)/);

assert.match(questionReviewSource, /searchParams\.get\("misconception"\)/);
assert.match(questionReviewSource, /useState<string \| undefined>\(\s*requestedMisconceptionId/);

console.log("Misconception center checks passed.");
