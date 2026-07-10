import type { Category } from "../types";

export const mockCategories: Category[] = [
  {
    id: "cat-var",
    name: { id: "Variabel", en: "Variables" },
    description: {
      id: "Penggunaan variabel untuk menyimpan dan memperbarui nilai.",
      en: "Using variables to store and update values.",
    },
    order: 1,
  },
  {
    id: "cat-ifelse",
    name: { id: "Percabangan", en: "Conditionals" },
    description: {
      id: "Struktur percabangan kondisional.",
      en: "Conditional branching structures.",
    },
    order: 2,
  },
  {
    id: "cat-loop",
    name: { id: "Perulangan", en: "Loops" },
    description: {
      id: "Struktur perulangan seperti WHILE dan FOR.",
      en: "Loop structures such as WHILE and FOR.",
    },
    order: 3,
  },
  {
    id: "cat-array",
    name: { id: "Data/Koleksi", en: "Data/Collection" },
    description: {
      id: "Struktur data array dan operasi indeksnya.",
      en: "Array data structures and index operations.",
    },
    order: 4,
  },
  {
    id: "cat-func",
    name: { id: "Fungsi", en: "Functions" },
    description: {
      id: "Pendefinisian dan pemanggilan fungsi atau prosedur.",
      en: "Defining and calling functions or procedures.",
    },
    order: 5,
  },
  {
    id: "cat-trace",
    name: { id: "Alur Eksekusi", en: "Execution Flow" },
    description: {
      id: "Menelusuri eksekusi pseudocode langkah demi langkah.",
      en: "Tracing pseudocode execution step by step.",
    },
    order: 6,
  },
  {
    id: "cat-io",
    name: { id: "Input/Output", en: "Input/Output" },
    description: {
      id: "Operasi pembacaan input dan penulisan output.",
      en: "Input reading and output writing operations.",
    },
    order: 7,
  },
  {
    id: "cat-bool",
    name: { id: "Ekspresi", en: "Expressions" },
    description: {
      id: "Ekspresi logika dan operator boolean.",
      en: "Logical expressions and boolean operators.",
    },
    order: 8,
  },
  {
    id: "cat-operator",
    name: { id: "Operator", en: "Operators" },
    description: {
      id: "Penggunaan operator aritmetika, perbandingan, dan logika.",
      en: "Using arithmetic, comparison, and logical operators.",
    },
    order: 9,
  },
];
