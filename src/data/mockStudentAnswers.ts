import type { AnswerCheck, LocalizedText, StudentAnswer } from "../types";
import { mockStudents } from "./mockStudents";
import { mockQuestions } from "./mockQuestions";

type Pattern = {
  status: StudentAnswer["status"];
  answerText?: string;
  selectedOptionId?: string;
  checks: AnswerCheck[];
  masteredConcepts: LocalizedText[];
  incorrectElements: LocalizedText[];
  studentMisconceptionIds: string[];
};

function checks(output: boolean, logic: boolean, pseudocode: boolean, concept: boolean): AnswerCheck[] {
  return [
    { key: "output", passed: output },
    { key: "logic", passed: logic },
    { key: "pseudocode", passed: pseudocode },
    { key: "concept", passed: concept },
  ];
}

const conceptsOf = (questionId: string): LocalizedText[] =>
  mockQuestions.find((q) => q.id === questionId)?.expectedConcepts ?? [];

function buildAnswers(questionId: string, patterns: Pattern[]): StudentAnswer[] {
  return mockStudents.map((student, i) => {
    const pattern = patterns[i % patterns.length];
    return {
      id: `ans-${questionId}-${student.id}`,
      questionId,
      studentId: student.id,
      ...pattern,
    };
  });
}

function override(answers: StudentAnswer[], studentId: string, patch: Partial<StudentAnswer>) {
  const index = answers.findIndex((a) => a.studentId === studentId);
  if (index >= 0) {
    answers[index] = { ...answers[index], ...patch };
  }
}

// --- q-swap: Case 1 — output plausible, concept/pseudocode wrong ---
const swapAnswers = buildAnswers("q-swap", [
  {
    status: "correct",
    answerText: "TEMP ← A\nA ← B\nB ← TEMP",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-swap"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    answerText: "A ← B\nB ← A",
    checks: checks(true, false, false, false),
    masteredConcepts: [],
    incorrectElements: [
      { id: "Nilai asli A tertimpa sebelum sempat disimpan", en: "The original value of A is overwritten before it can be stored" },
    ],
    studentMisconceptionIds: ["mc-swap-no-temp"],
  },
  {
    status: "incorrect",
    answerText: "B ← A\nA ← B",
    checks: checks(false, false, false, false),
    masteredConcepts: [],
    incorrectElements: [
      { id: "Kedua variabel berakhir dengan nilai yang sama", en: "Both variables end up holding the same value" },
    ],
    studentMisconceptionIds: ["mc-swap-no-temp"],
  },
]);
override(swapAnswers, "stu-03", {
  answerText: "A ← B\nB ← A",
  status: "incorrect",
  checks: checks(true, false, false, false),
  masteredConcepts: [],
  incorrectElements: [
    { id: "Nilai asli A tertimpa sebelum sempat disimpan", en: "The original value of A is overwritten before it can be stored" },
  ],
  studentMisconceptionIds: ["mc-swap-no-temp"],
});

// --- q-print15: Case 2 — output wrong, some concepts correct ---
const print15Answers = buildAnswers("q-print15", [
  {
    status: "correct",
    answerText: "i ← 1\nWHILE i <= 5 DO\n  PRINT i\n  i ← i + 1\nEND WHILE",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-print15"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    answerText: "i ← 1\nWHILE i < 5 DO\n  PRINT i\n  i ← i + 1\nEND WHILE",
    checks: checks(false, true, true, false),
    masteredConcepts: conceptsOf("q-print15"),
    incorrectElements: [
      { id: "Angka 5 tidak pernah tercetak", en: "The number 5 is never printed" },
    ],
    studentMisconceptionIds: ["mc-loop-boundary"],
  },
  {
    status: "incorrect",
    answerText: "i ← 0\nWHILE i < 5 DO\n  PRINT i\n  i ← i + 1\nEND WHILE",
    checks: checks(false, true, true, false),
    masteredConcepts: [
      { id: "Struktur perulangan", en: "Loop structure" },
      { id: "Increment", en: "Increment" },
      { id: "Output di dalam perulangan", en: "Output inside loop" },
    ],
    incorrectElements: [
      { id: "Angka yang tercetak bergeser satu posisi", en: "The printed numbers are shifted by one position" },
    ],
    studentMisconceptionIds: ["mc-loop-boundary"],
  },
]);
override(print15Answers, "stu-12", {
  answerText: "i ← 1\nWHILE i < 5 DO\n  PRINT i\n  i ← i + 1\nEND WHILE",
  status: "incorrect",
  checks: checks(false, true, true, false),
  masteredConcepts: conceptsOf("q-print15"),
  incorrectElements: [
    { id: "Angka 5 tidak pernah tercetak", en: "The number 5 is never printed" },
  ],
  studentMisconceptionIds: ["mc-loop-boundary"],
});

// --- q-evenodd (multiple choice) ---
const evenoddAnswers = buildAnswers("q-evenodd", [
  {
    status: "correct",
    selectedOptionId: "opt-evenodd-c",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-evenodd"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-evenodd-a",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Kondisi genap/ganjil terbalik", en: "The even/odd condition is reversed" }],
    studentMisconceptionIds: ["mc-condition-reversed"],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-evenodd-b",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Kasus ganjil tidak ditangani", en: "The odd case is not handled" }],
    studentMisconceptionIds: ["mc-ifelse-missing-else"],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-evenodd-d",
    checks: checks(false, false, false, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Operator pembagian tidak menentukan paritas", en: "The division operator does not determine parity" }],
    studentMisconceptionIds: [],
  },
]);

// --- q-arraymax: guarantees a correct answer with no misconception ---
const arraymaxAnswers = buildAnswers("q-arraymax", [
  {
    status: "correct",
    answerText: "MAX ← ARR[0]\nFOR i ← 1 TO 4 DO\n  IF ARR[i] > MAX THEN MAX ← ARR[i]\nEND FOR",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-arraymax"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    answerText: "MAX ← ARR[1]\nFOR i ← 2 TO 5 DO\n  IF ARR[i] > MAX THEN MAX ← ARR[i]\nEND FOR",
    checks: checks(false, false, true, false),
    masteredConcepts: [{ id: "Nilai maksimum sementara", en: "Temporary maximum value" }],
    incorrectElements: [{ id: "Elemen pertama array tidak pernah diperiksa", en: "The first array element is never checked" }],
    studentMisconceptionIds: ["mc-offbyone-array"],
  },
]);

// --- q-boolrange (multiple choice) ---
const boolrangeAnswers = buildAnswers("q-boolrange", [
  {
    status: "correct",
    selectedOptionId: "opt-boolrange-b",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-boolrange"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-boolrange-a",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Ekspresi selalu bernilai benar", en: "The expression always evaluates to true" }],
    studentMisconceptionIds: ["mc-and-or-confusion"],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-boolrange-c",
    checks: checks(false, true, true, false),
    masteredConcepts: [{ id: "Operator AND", en: "AND operator" }],
    incorrectElements: [{ id: "Batas rentang tidak inklusif", en: "The range bounds are not inclusive" }],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-boolrange-d",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Batas atas dan bawah tertukar", en: "Upper and lower bounds are swapped" }],
    studentMisconceptionIds: ["mc-condition-reversed"],
  },
]);

// --- q-squarefn ---
const squarefnAnswers = buildAnswers("q-squarefn", [
  {
    status: "correct",
    answerText: "FUNCTION Square(n)\n  RETURN n * n\nEND FUNCTION",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-squarefn"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    answerText: "FUNCTION Square(n)\n  PRINT n * n\nEND FUNCTION",
    checks: checks(true, true, false, false),
    masteredConcepts: [{ id: "Parameter fungsi", en: "Function parameter" }],
    incorrectElements: [{ id: "Hasil tidak dikembalikan ke pemanggil", en: "The result is never returned to the caller" }],
    studentMisconceptionIds: ["mc-function-no-return"],
  },
]);

// --- q-sumio ---
const sumioAnswers = buildAnswers("q-sumio", [
  {
    status: "correct",
    answerText: "READ a\nREAD b\nPRINT a + b",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-sumio"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    answerText: "READ a\nPRINT a + b\nREAD b",
    checks: checks(false, true, false, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Nilai b dipakai sebelum dibaca", en: "The value of b is used before it is read" }],
    studentMisconceptionIds: ["mc-io-order"],
  },
]);

// --- q-tracex (multiple choice) ---
const tracexAnswers = buildAnswers("q-tracex", [
  {
    status: "correct",
    selectedOptionId: "opt-tracex-b",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-tracex"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-tracex-a",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Iterasi terakhir tidak dihitung", en: "The final iteration is not counted" }],
    studentMisconceptionIds: ["mc-loop-boundary"],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-tracex-c",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Nilai X tidak diperbarui di setiap langkah", en: "The value of X is not updated at every step" }],
    studentMisconceptionIds: ["mc-trace-state-loss"],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-tracex-d",
    checks: checks(false, false, false, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Kesalahan perhitungan penjumlahan", en: "Arithmetic accumulation error" }],
    studentMisconceptionIds: [],
  },
]);

// --- q-evenloop: intro example — Student 07, two misconceptions at once ---
const evenloopAnswers = buildAnswers("q-evenloop", [
  {
    status: "correct",
    answerText: "i ← 2\nWHILE i <= 10 DO\n  PRINT i\n  i ← i + 2\nEND WHILE",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-evenloop"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    answerText: "i ← 2\nWHILE i < 10 DO\n  PRINT i\nEND WHILE",
    checks: checks(false, false, true, false),
    masteredConcepts: [{ id: "Nilai awal perulangan", en: "Loop initial value" }],
    incorrectElements: [
      { id: "Angka 10 tidak pernah tercetak", en: "The number 10 is never printed" },
      { id: "Variabel pengendali tidak pernah bertambah", en: "The control variable never increases" },
    ],
    studentMisconceptionIds: ["mc-loop-boundary", "mc-missing-increment"],
  },
  {
    status: "incorrect",
    answerText: "i ← 2\nWHILE i < 10 DO\n  PRINT i\n  i ← i + 2\nEND WHILE",
    checks: checks(false, true, true, false),
    masteredConcepts: [{ id: "Nilai awal perulangan", en: "Loop initial value" }, { id: "Increment dua langkah", en: "Step-by-two increment" }],
    incorrectElements: [{ id: "Angka 10 tidak pernah tercetak", en: "The number 10 is never printed" }],
    studentMisconceptionIds: ["mc-loop-boundary"],
  },
]);
override(evenloopAnswers, "stu-07", {
  answerText: "i ← 2\nWHILE i < 10 DO\n  PRINT i\nEND WHILE",
  status: "incorrect",
  checks: checks(false, false, true, false),
  masteredConcepts: [{ id: "Inisialisasi", en: "Initialization" }],
  incorrectElements: [
    { id: "Angka 10 tidak pernah tercetak", en: "The number 10 is never printed" },
    { id: "Variabel pengendali tidak pernah bertambah", en: "The control variable never increases" },
  ],
  studentMisconceptionIds: ["mc-loop-boundary", "mc-missing-increment"],
});

// --- q-printn (multiple choice) ---
const printnAnswers = buildAnswers("q-printn", [
  {
    status: "correct",
    selectedOptionId: "opt-printn-b",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-printn"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-printn-a",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Angka 0 ikut tercetak", en: "The number 0 gets printed as well" }],
    studentMisconceptionIds: ["mc-wrong-init"],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-printn-c",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Angka N tidak tercetak", en: "The number N is not printed" }],
    studentMisconceptionIds: ["mc-loop-boundary"],
  },
  {
    status: "incorrect",
    selectedOptionId: "opt-printn-d",
    checks: checks(false, false, false, false),
    masteredConcepts: [],
    incorrectElements: [{ id: "Angka 1 tidak tercetak", en: "The number 1 is not printed" }],
    studentMisconceptionIds: [],
  },
]);

// --- q-triangle: second explicit multi-misconception case ---
const triangleAnswers = buildAnswers("q-triangle", [
  {
    status: "correct",
    answerText:
      "IF a + b > c AND a + c > b AND b + c > a THEN\n  PRINT \"Valid\"\nELSE\n  PRINT \"Tidak valid\"\nEND IF",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-triangle"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    answerText: "IF a + b > c THEN PRINT \"Valid\"",
    checks: checks(false, false, true, false),
    masteredConcepts: [],
    incorrectElements: [
      { id: "Hanya satu ketaksamaan yang diperiksa", en: "Only one inequality is checked" },
      { id: "Kasus tidak valid tidak ditangani", en: "The invalid case is not handled" },
    ],
    studentMisconceptionIds: ["mc-ifelse-missing-else", "mc-condition-reversed"],
  },
  {
    status: "incorrect",
    answerText: "IF a + b > c AND a + c > b AND b + c > a THEN PRINT \"Valid\"",
    checks: checks(false, true, true, false),
    masteredConcepts: [{ id: "Ketaksamaan segitiga", en: "Triangle inequality" }],
    incorrectElements: [{ id: "Kasus tidak valid tidak dicetak", en: "The invalid case is never printed" }],
    studentMisconceptionIds: ["mc-ifelse-missing-else"],
  },
]);
override(triangleAnswers, "stu-15", {
  answerText: "IF a + b > c THEN PRINT \"Valid\"",
  status: "incorrect",
  checks: checks(false, false, true, false),
  masteredConcepts: [],
  incorrectElements: [
    { id: "Hanya satu ketaksamaan yang diperiksa", en: "Only one inequality is checked" },
    { id: "Kasus tidak valid tidak ditangani", en: "The invalid case is not handled" },
  ],
  studentMisconceptionIds: ["mc-ifelse-missing-else", "mc-condition-reversed"],
});

// --- q-sumassign: question with no defined question misconceptions ---
const sumassignAnswers = buildAnswers("q-sumassign", [
  {
    status: "correct",
    answerText: "C ← A + B",
    checks: checks(true, true, true, true),
    masteredConcepts: conceptsOf("q-sumassign"),
    incorrectElements: [],
    studentMisconceptionIds: [],
  },
  {
    status: "incorrect",
    answerText: "C ← A - B",
    checks: checks(false, false, true, true),
    masteredConcepts: [{ id: "Menyimpan hasil ke variabel", en: "Store result in variable" }],
    incorrectElements: [{ id: "Operator yang digunakan salah", en: "The wrong operator was used" }],
    studentMisconceptionIds: [],
  },
]);

export const mockStudentAnswers: StudentAnswer[] = [
  ...swapAnswers,
  ...print15Answers,
  ...evenoddAnswers,
  ...arraymaxAnswers,
  ...boolrangeAnswers,
  ...squarefnAnswers,
  ...sumioAnswers,
  ...tracexAnswers,
  ...evenloopAnswers,
  ...printnAnswers,
  ...triangleAnswers,
  ...sumassignAnswers,
];
