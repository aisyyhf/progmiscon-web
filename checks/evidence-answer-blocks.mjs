import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { splitEvidenceAnswerBlocks } from "../src/utils/evidenceAnswerBlocks.ts";

const purePseudocode = `program LuasPersegiPanjang
kamus:
  panjang, lebar, luas : integer

algoritma:
  input(panjang, lebar)
  luas <- panjang * lebar
  output(luas)
endprogram`;

assert.deepEqual(splitEvidenceAnswerBlocks(purePseudocode), [
  { kind: "code", text: purePseudocode },
]);

const pureProse = `Mahasiswa menjelaskan hasil perhitungan dengan benar.

Contoh tersebut sesuai dengan keluaran yang diharapkan.`;

assert.deepEqual(splitEvidenceAnswerBlocks(pureProse), [
  { kind: "prose", text: pureProse },
]);

const trailingProse = `Bukti dari log: Got: area = 12, expected: area = 10.
Mahasiswa menggunakan data pengujian yang berbeda.
Contoh penjelasan yang panjang tetap harus membungkus sebagai teks biasa.`;
const mixedAnswer = `${purePseudocode}\n\n${trailingProse}`;

assert.deepEqual(splitEvidenceAnswerBlocks(mixedAnswer), [
  { kind: "code", text: purePseudocode },
  { kind: "prose", text: trailingProse },
]);

const leadingProse = "Contoh berikut menunjukkan urutan langkah yang digunakan.";
assert.deepEqual(
  splitEvidenceAnswerBlocks(`${leadingProse}\n\n${purePseudocode}`),
  [
    { kind: "prose", text: leadingProse },
    { kind: "code", text: purePseudocode },
  ],
);

const componentSource = await readFile(
  new URL("../src/components/review/StructuredEvidenceList.tsx", import.meta.url),
  "utf8",
);

assert.match(componentSource, /splitEvidenceAnswerBlocks\(answerText\)/);
assert.match(componentSource, /block\.kind === "code"/);
assert.match(componentSource, /<PseudocodeBlock code=\{block\.text\} \/>/);
assert.match(componentSource, /whitespace-pre-wrap break-words/);
assert.match(componentSource, /max-h-64[\s\S]*sm:max-h-80/);
assert.match(componentSource, /max-h-\[calc\(85dvh-5rem\)\][^"\n]*overflow-y-auto/);

console.log("evidence answer block checks passed");
