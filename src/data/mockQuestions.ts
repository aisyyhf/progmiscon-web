import type { Question, StudentAnswer } from "../types";
import { buildMockQuestionMisconceptionProvenance } from "../utils/mockQuestionProvenance.ts";
import { mockCategories } from "./mockCategories.ts";

function concept(categoryId: string) {
  const category = mockCategories.find((item) => item.id === categoryId);
  if (!category) throw new Error(`Unknown concept category: ${categoryId}`);
  return category.name;
}

const unknownMetadata = {
  title: { id: "", en: "" },
  week: null,
  sourceSystem: null,
  sourceKey: null,
  sourceCode: null,
  level: null,
};

export type MockQuestionDefinition = Omit<
  Question,
  "answerDerivedMisconceptionIds" | "questionMisconceptionIds"
>;

export const mockQuestionDefinitions: MockQuestionDefinition[] = [
  {
    ...unknownMetadata,
    id: "q-swap",
    assessmentId: "asm-uts",
    categoryId: "cat-var",
    number: "Q1",
    type: "short_answer",
    prompt: {
      id: "Tukarkan nilai A dan B.",
      en: "Swap the values of A and B.",
    },
    expectedConcepts: [
      concept("cat-var"),
      concept("cat-trace"),
    ],
    directQuestionMisconceptionIds: ["mc-swap-no-temp"],
  },
  {
    ...unknownMetadata,
    id: "q-print15",
    assessmentId: "asm-uts",
    categoryId: "cat-loop",
    number: "Q2",
    type: "short_answer",
    prompt: {
      id: "Cetak angka 1 sampai 5.",
      en: "Print numbers from 1 to 5.",
    },
    expectedConcepts: [
      concept("cat-loop"),
      concept("cat-io"),
    ],
    directQuestionMisconceptionIds: ["mc-loop-boundary"],
  },
  {
    ...unknownMetadata,
    id: "q-evenodd",
    assessmentId: "asm-uts",
    categoryId: "cat-ifelse",
    number: "Q3",
    type: "multiple_choice",
    prompt: {
      id: "Manakah pseudocode yang benar untuk memeriksa apakah sebuah bilangan genap atau ganjil?",
      en: "Which pseudocode correctly checks whether a number is even or odd?",
    },
    expectedConcepts: [
      concept("cat-ifelse"),
      concept("cat-operator"),
    ],
    directQuestionMisconceptionIds: ["mc-condition-reversed", "mc-ifelse-missing-else"],
    options: [
      {
        id: "opt-evenodd-a",
        label: "A",
        text: {
          id: "IF x MOD 2 = 1 THEN PRINT \"Genap\" ELSE PRINT \"Ganjil\"",
          en: "IF x MOD 2 = 1 THEN PRINT \"Even\" ELSE PRINT \"Odd\"",
        },
        isCorrect: false,
        misconceptionIds: ["mc-condition-reversed"],
        misconceptionId: "mc-condition-reversed",
      },
      {
        id: "opt-evenodd-b",
        label: "B",
        text: {
          id: "IF x MOD 2 = 0 THEN PRINT \"Genap\"",
          en: "IF x MOD 2 = 0 THEN PRINT \"Even\"",
        },
        isCorrect: false,
        misconceptionIds: ["mc-ifelse-missing-else"],
        misconceptionId: "mc-ifelse-missing-else",
      },
      {
        id: "opt-evenodd-c",
        label: "C",
        text: {
          id: "IF x MOD 2 = 0 THEN PRINT \"Genap\" ELSE PRINT \"Ganjil\"",
          en: "IF x MOD 2 = 0 THEN PRINT \"Even\" ELSE PRINT \"Odd\"",
        },
        isCorrect: true,
        misconceptionIds: [],
      },
      {
        id: "opt-evenodd-d",
        label: "D",
        text: {
          id: "IF x / 2 = 0 THEN PRINT \"Genap\" ELSE PRINT \"Ganjil\"",
          en: "IF x / 2 = 0 THEN PRINT \"Even\" ELSE PRINT \"Odd\"",
        },
        isCorrect: false,
        misconceptionIds: [],
      },
    ],
  },
  {
    ...unknownMetadata,
    id: "q-arraymax",
    assessmentId: "asm-uts",
    categoryId: "cat-array",
    number: "Q4",
    type: "short_answer",
    prompt: {
      id: "Temukan nilai maksimum dari sebuah array berisi 5 bilangan.",
      en: "Find the maximum value in an array of 5 numbers.",
    },
    expectedConcepts: [
      concept("cat-array"),
      concept("cat-loop"),
      concept("cat-var"),
    ],
    directQuestionMisconceptionIds: ["mc-offbyone-array"],
  },
  {
    ...unknownMetadata,
    id: "q-boolrange",
    assessmentId: "asm-uts",
    categoryId: "cat-bool",
    number: "Q5",
    type: "multiple_choice",
    prompt: {
      id: "Pilih ekspresi boolean yang tepat untuk 'x berada di antara 1 dan 10 (inklusif)'.",
      en: "Select the correct boolean expression for 'x is between 1 and 10 inclusive'.",
    },
    expectedConcepts: [
      concept("cat-bool"),
      concept("cat-operator"),
    ],
    directQuestionMisconceptionIds: ["mc-and-or-confusion", "mc-condition-reversed"],
    options: [
      {
        id: "opt-boolrange-a",
        label: "A",
        text: { id: "x >= 1 OR x <= 10", en: "x >= 1 OR x <= 10" },
        isCorrect: false,
        misconceptionIds: ["mc-and-or-confusion"],
        misconceptionId: "mc-and-or-confusion",
      },
      {
        id: "opt-boolrange-b",
        label: "B",
        text: { id: "x >= 1 AND x <= 10", en: "x >= 1 AND x <= 10" },
        isCorrect: true,
        misconceptionIds: [],
      },
      {
        id: "opt-boolrange-c",
        label: "C",
        text: { id: "x > 1 AND x < 10", en: "x > 1 AND x < 10" },
        isCorrect: false,
        misconceptionIds: [],
      },
      {
        id: "opt-boolrange-d",
        label: "D",
        text: { id: "x <= 1 AND x >= 10", en: "x <= 1 AND x >= 10" },
        isCorrect: false,
        misconceptionIds: ["mc-condition-reversed"],
        misconceptionId: "mc-condition-reversed",
      },
    ],
  },
  {
    ...unknownMetadata,
    id: "q-squarefn",
    assessmentId: "asm-uas",
    categoryId: "cat-func",
    number: "Q6",
    type: "short_answer",
    prompt: {
      id: "Tulis sebuah fungsi untuk menghitung kuadrat suatu bilangan dan kembalikan hasilnya.",
      en: "Write a function to calculate the square of a number and return the result.",
    },
    expectedConcepts: [
      concept("cat-func"),
    ],
    directQuestionMisconceptionIds: ["mc-function-no-return"],
  },
  {
    ...unknownMetadata,
    id: "q-sumio",
    assessmentId: "asm-uas",
    categoryId: "cat-io",
    number: "Q7",
    type: "short_answer",
    prompt: {
      id: "Baca dua bilangan dari input lalu cetak jumlahnya.",
      en: "Read two numbers from input and print their sum.",
    },
    expectedConcepts: [
      concept("cat-io"),
      concept("cat-operator"),
    ],
    directQuestionMisconceptionIds: ["mc-io-order"],
  },
  {
    ...unknownMetadata,
    id: "q-tracex",
    assessmentId: "asm-uas",
    categoryId: "cat-trace",
    number: "Q8",
    type: "multiple_choice",
    prompt: {
      id: "Telusuri pseudocode berikut dan pilih nilai akhir X.\n\nX ← 0\nFOR i ← 1 TO 4 DO\n  X ← X + i\nEND FOR",
      en: "Trace the following pseudocode and select the final value of X.\n\nX ← 0\nFOR i ← 1 TO 4 DO\n  X ← X + i\nEND FOR",
    },
    expectedConcepts: [
      concept("cat-trace"),
      concept("cat-loop"),
      concept("cat-var"),
    ],
    directQuestionMisconceptionIds: ["mc-trace-state-loss", "mc-loop-boundary"],
    options: [
      {
        id: "opt-tracex-a",
        label: "A",
        text: { id: "6", en: "6" },
        isCorrect: false,
        misconceptionIds: ["mc-loop-boundary"],
        misconceptionId: "mc-loop-boundary",
      },
      {
        id: "opt-tracex-b",
        label: "B",
        text: { id: "10", en: "10" },
        isCorrect: true,
        misconceptionIds: [],
      },
      {
        id: "opt-tracex-c",
        label: "C",
        text: { id: "4", en: "4" },
        isCorrect: false,
        misconceptionIds: ["mc-trace-state-loss"],
        misconceptionId: "mc-trace-state-loss",
      },
      {
        id: "opt-tracex-d",
        label: "D",
        text: { id: "14", en: "14" },
        isCorrect: false,
        misconceptionIds: [],
      },
    ],
  },
  {
    ...unknownMetadata,
    id: "q-evenloop",
    assessmentId: "asm-quiz-loop",
    categoryId: "cat-loop",
    number: "Q1",
    type: "short_answer",
    prompt: {
      id: "Cetak seluruh bilangan genap dari 1 sampai 10.",
      en: "Print all even numbers from 1 to 10.",
    },
    expectedConcepts: [
      concept("cat-loop"),
      concept("cat-operator"),
      concept("cat-io"),
    ],
    directQuestionMisconceptionIds: ["mc-loop-boundary", "mc-missing-increment"],
  },
  {
    ...unknownMetadata,
    id: "q-printn",
    assessmentId: "asm-quiz-loop",
    categoryId: "cat-loop",
    number: "Q2",
    type: "multiple_choice",
    prompt: {
      id: "Manakah perulangan yang benar untuk mencetak angka 1 sampai N?",
      en: "Which loop correctly prints numbers 1 to N?",
    },
    expectedConcepts: [
      concept("cat-loop"),
      concept("cat-io"),
    ],
    directQuestionMisconceptionIds: ["mc-wrong-init", "mc-loop-boundary"],
    options: [
      {
        id: "opt-printn-a",
        label: "A",
        text: { id: "FOR i ← 0 TO N DO PRINT i", en: "FOR i ← 0 TO N DO PRINT i" },
        isCorrect: false,
        misconceptionIds: ["mc-wrong-init"],
        misconceptionId: "mc-wrong-init",
      },
      {
        id: "opt-printn-b",
        label: "B",
        text: { id: "FOR i ← 1 TO N DO PRINT i", en: "FOR i ← 1 TO N DO PRINT i" },
        isCorrect: true,
        misconceptionIds: [],
      },
      {
        id: "opt-printn-c",
        label: "C",
        text: { id: "FOR i ← 1 TO N - 1 DO PRINT i", en: "FOR i ← 1 TO N - 1 DO PRINT i" },
        isCorrect: false,
        misconceptionIds: ["mc-loop-boundary"],
        misconceptionId: "mc-loop-boundary",
      },
      {
        id: "opt-printn-d",
        label: "D",
        text: { id: "FOR i ← 2 TO N DO PRINT i", en: "FOR i ← 2 TO N DO PRINT i" },
        isCorrect: false,
        misconceptionIds: [],
      },
    ],
  },
  {
    ...unknownMetadata,
    id: "q-triangle",
    assessmentId: "asm-latihan-ifelse",
    categoryId: "cat-ifelse",
    number: "Q1",
    type: "short_answer",
    prompt: {
      id: "Tentukan apakah tiga panjang sisi yang diberikan dapat membentuk segitiga yang valid.",
      en: "Determine whether three given side lengths can form a valid triangle.",
    },
    expectedConcepts: [
      concept("cat-ifelse"),
      concept("cat-bool"),
      concept("cat-operator"),
    ],
    directQuestionMisconceptionIds: ["mc-ifelse-missing-else", "mc-condition-reversed"],
  },
  {
    ...unknownMetadata,
    id: "q-sumassign",
    assessmentId: "asm-latihan-ifelse",
    categoryId: "cat-var",
    number: "Q2",
    type: "short_answer",
    prompt: {
      id: "Simpan hasil penjumlahan dua variabel A dan B ke variabel ketiga C.",
      en: "Store the sum of variables A and B in a third variable C.",
    },
    expectedConcepts: [
      concept("cat-var"),
      concept("cat-operator"),
    ],
    directQuestionMisconceptionIds: [],
  },
];

export function buildMockQuestions(
  answers: readonly Pick<
    StudentAnswer,
    "questionId" | "studentMisconceptionIds"
  >[],
): Question[] {
  return mockQuestionDefinitions.map((question) => ({
    ...question,
    ...buildMockQuestionMisconceptionProvenance(question, answers),
  }));
}
