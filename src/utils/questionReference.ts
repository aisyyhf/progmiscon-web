import type { LocalizedText, Question } from "../types";

type QuestionReference = {
  pseudocode: string;
  checkedElements: LocalizedText[];
};

const references: Record<string, QuestionReference> = {
  "q-swap": {
    pseudocode: "TEMP ← A\nA ← B\nB ← TEMP",
    checkedElements: [
      { id: "Menggunakan variabel sementara", en: "Uses a temporary variable" },
      { id: "Menjaga urutan perubahan nilai", en: "Preserves value-change order" },
      { id: "Tidak menimpa nilai awal sebelum disimpan", en: "Does not overwrite the initial value before saving it" },
    ],
  },
  "q-print15": {
    pseudocode: "i ← 1\nWHILE i <= 5 DO\n  PRINT i\n  i ← i + 1\nEND WHILE",
    checkedElements: [
      { id: "Memulai dari batas awal yang tepat", en: "Starts from the correct lower bound" },
      { id: "Menggunakan batas perulangan inklusif", en: "Uses an inclusive loop boundary" },
      { id: "Memperbarui variabel pengendali", en: "Updates the control variable" },
    ],
  },
  "q-evenodd": {
    pseudocode: "IF x MOD 2 = 0 THEN\n  PRINT \"Genap\"\nELSE\n  PRINT \"Ganjil\"\nEND IF",
    checkedElements: [
      { id: "Menggunakan MOD untuk paritas", en: "Uses MOD for parity" },
      { id: "Membedakan kondisi genap dan ganjil", en: "Separates even and odd conditions" },
      { id: "Menangani cabang ELSE", en: "Handles the ELSE branch" },
    ],
  },
  "q-arraymax": {
    pseudocode: "MAX ← ARR[0]\nFOR i ← 1 TO 4 DO\n  IF ARR[i] > MAX THEN\n    MAX ← ARR[i]\n  END IF\nEND FOR",
    checkedElements: [
      { id: "Memulai dari elemen pertama", en: "Starts from the first element" },
      { id: "Menelusuri indeks yang valid", en: "Traverses valid indices" },
      { id: "Memperbarui nilai maksimum sementara", en: "Updates the temporary maximum value" },
    ],
  },
  "q-boolrange": {
    pseudocode: "x >= 1 AND x <= 10",
    checkedElements: [
      { id: "Menggunakan operator AND", en: "Uses the AND operator" },
      { id: "Memeriksa batas bawah", en: "Checks the lower bound" },
      { id: "Memeriksa batas atas", en: "Checks the upper bound" },
    ],
  },
  "q-squarefn": {
    pseudocode: "FUNCTION Square(n)\n  RETURN n * n\nEND FUNCTION",
    checkedElements: [
      { id: "Menerima parameter fungsi", en: "Accepts a function parameter" },
      { id: "Menghitung nilai kuadrat", en: "Computes the square value" },
      { id: "Mengirim nilai kembali dengan RETURN", en: "Sends the return value with RETURN" },
    ],
  },
  "q-sumio": {
    pseudocode: "READ a\nREAD b\nPRINT a + b",
    checkedElements: [
      { id: "Membaca seluruh input dahulu", en: "Reads all inputs first" },
      { id: "Menjumlahkan dua nilai", en: "Adds the two values" },
      { id: "Mencetak hasil setelah proses", en: "Prints the result after processing" },
    ],
  },
  "q-tracex": {
    pseudocode: "X ← 0\nFOR i ← 1 TO 4 DO\n  X ← X + i\nEND FOR",
    checkedElements: [
      { id: "Memperbarui X pada tiap iterasi", en: "Updates X on each iteration" },
      { id: "Mengikuti rentang FOR lengkap", en: "Follows the complete FOR range" },
      { id: "Mencatat nilai X setelah setiap iterasi", en: "Records X after each iteration" },
    ],
  },
};

export function getQuestionReference(question: Question): QuestionReference {
  return (
    references[question.id] ?? {
      pseudocode: "",
      checkedElements: question.expectedConcepts,
    }
  );
}
