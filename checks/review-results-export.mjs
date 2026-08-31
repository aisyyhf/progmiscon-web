import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Papa from "papaparse";
import {
  buildCurrentReviewsCsv,
  lecturerReviewHeaders,
  reviewOutcomeLabel,
  reviewerFinalMisconceptionIds,
} from "../src/utils/adminExports.ts";
import {
  formatWibDateTime,
  serializeCsv,
  wibDateStamp,
} from "../src/utils/reviewCsv.ts";

const localized = (value) => ({ id: value, en: value });

const misconceptions = [
  { id: "IO-01", title: { id: "Salah baca input", en: "Misreads input" } },
  { id: "IO-02", title: { id: "Salah format keluaran", en: "Wrong output format" } },
  { id: "CO-01", title: { id: "Salah kondisi", en: "Wrong condition" } },
];

const psQuestion = {
  id: "Q002",
  type: "short_answer",
  week: "W02",
  lmsQuestionId: "10413319",
  sourceCode: "008.UAI konversi suhu c ke f (en)",
  displayCode: "10413319",
  targetMisconceptionId: null,
  title: localized("Konversi suhu C ke F"),
  questionMisconceptionIds: ["IO-01"],
};
const mpQuestion = {
  id: "Q020",
  type: "multiple_choice",
  week: "W03",
  lmsQuestionId: null,
  sourceCode: null,
  displayCode: "MP-CO-01-1",
  targetMisconceptionId: "IO-02",
  title: localized("Probe keluaran IO"),
  questionMisconceptionIds: ["IO-02", "CO-01"],
};

const reviewerNamed = {
  reviewerId: "11111111-1111-4111-8111-111111111111",
  fullName: "Dr. Budi, S.Kom.",
  email: "budi@example.test",
};
const reviewerUnnamed = {
  reviewerId: "22222222-2222-4222-8222-222222222222",
  fullName: "22222222-2222-4222-8222-222222222222",
  email: "",
};

const base = {
  isActive: true,
  hasIncorrectMisconceptions: false,
  hasMismatchedMisconceptions: false,
  hasAdditionalMisconceptions: false,
  removedMisconceptionIds: [],
  removalReason: null,
  additionalMisconceptionIds: [],
  additionReason: null,
  note: null,
  createdAt: "2026-08-19T10:00:00Z",
  updatedAt: "2026-08-20T02:30:00Z",
};

const psQuestionReview = {
  ...base,
  id: "qr-ps",
  questionId: "Q002",
  removedMisconceptionIds: ["IO-01"],
  removalReason: "Tidak sesuai konteks soal",
  note: 'Catatan dengan "kutip", koma\ndan baris kedua',
};
const mpQuestionReview = {
  ...base,
  id: "qr-mp",
  questionId: "Q020",
  additionalMisconceptionIds: ["LO-05"],
  additionReason: "Perlu ditambah",
};
const mpAnswerReview = {
  ...base,
  id: "ar-mp",
  answerId: "A020-B",
  questionId: "Q020",
  removedMisconceptionIds: ["IO-02"],
  removalReason: "Tidak konsisten",
  additionalMisconceptionIds: ["CO-01"],
  additionReason: "Lebih tepat",
};
const noChangeReview = { ...base, id: "qr-none", questionId: "Q020" };

const mpAnswer = {
  id: "A020-B",
  optionLabel: "B",
  answerText: '9, tetapi "salah"',
  studentMisconceptionIds: ["IO-02"],
};

const groups = [
  {
    question: psQuestion,
    reviewers: [
      { reviewer: reviewerNamed, questionReview: psQuestionReview, answerReviews: [] },
      {
        reviewer: reviewerUnnamed,
        questionReview: { ...base, id: "qr-ps-2", questionId: "Q002" },
        answerReviews: [],
      },
    ],
  },
  {
    question: mpQuestion,
    reviewers: [
      {
        reviewer: reviewerNamed,
        questionReview: mpQuestionReview,
        answerReviews: [{ answer: mpAnswer, review: mpAnswerReview }],
      },
      { reviewer: reviewerUnnamed, questionReview: noChangeReview, answerReviews: [] },
    ],
  },
];

const csv = buildCurrentReviewsCsv(groups, { misconceptions, language: "id" });

const HEADERS = [
  "Minggu",
  "Tipe Soal",
  "Kode Soal",
  "Judul Soal",
  "Kode Miskonsepsi",
  "Nama Reviewer",
  "Waktu Review",
  "Terakhir Diperbarui",
  "Status Review",
  "Aktivitas Terakhir",
  "Bagian yang Direview",
  "Opsi Jawaban",
  "Isi Jawaban",
  "Hasil Review",
  "Miskonsepsi yang Tercantum",
  "Miskonsepsi yang Dihapus",
  "Alasan Penghapusan Miskonsepsi",
  "Miskonsepsi yang Ditambahkan",
  "Alasan Penambahan Miskonsepsi",
  "Miskonsepsi Menurut Reviewer",
  "Catatan Tambahan",
];
const col = (name) => {
  const index = HEADERS.indexOf(name);
  assert.ok(index >= 0, `unknown column ${name}`);
  return index;
};

// 1. exact final 21-column order
assert.deepEqual(csv.headers, HEADERS);
assert.equal(csv.headers.length, 21);
assert.deepEqual([...lecturerReviewHeaders], csv.headers);
assert.equal(HEADERS.indexOf("Status Review"), HEADERS.indexOf("Terakhir Diperbarui") + 1);
assert.equal(HEADERS.indexOf("Aktivitas Terakhir"), HEADERS.indexOf("Bagian yang Direview") - 1);

// 2. no underscores in headers
for (const header of csv.headers) {
  assert.ok(!header.includes("_"), `header "${header}" must not use underscores`);
}

// 3. no separate id_lms column and no internal identifiers anywhere
for (const banned of [
  "id_lms",
  "Kode Soal Target",
  "review_id",
  "reviewer_id",
  "reviewer_email",
  "question_id",
  "answer_id",
  "source_version",
  "is_active",
]) {
  assert.ok(!csv.headers.includes(banned), `header ${banned} must be gone`);
}
const flatCells = csv.rows.flat().map((cell) => String(cell ?? ""));
const uuid = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
for (const cell of flatCells) {
  assert.ok(!uuid.test(cell), `no UUID may leak into the CSV: ${cell}`);
  assert.ok(
    !/^Q\d{3}$/.test(cell) && !/^A\d{3}-[A-Z]$/.test(cell),
    `no internal Progmiscon id may leak into the CSV: ${cell}`,
  );
}

// 4. export-generated labels contain no en dash / em dash (–, —)
for (const cell of [...csv.headers, ...flatCells]) {
  assert.ok(
    !cell.includes("–") && !cell.includes("—"),
    `export string must use ASCII hyphen only: ${cell}`,
  );
}

const PS_LMS_ID = "10413319";
const findRow = (predicate) => {
  const match = csv.rows.find(predicate);
  assert.ok(match, "expected a matching CSV row");
  return match;
};
const KODE = col("Kode Soal");
const BAGIAN = col("Bagian yang Direview");
const REVIEWER = col("Nama Reviewer");
const psRow = findRow(
  (r) => r[KODE] === PS_LMS_ID && r[REVIEWER] === "Dr. Budi, S.Kom.",
);
const psUnnamedRow = findRow(
  (r) => r[KODE] === PS_LMS_ID && r[REVIEWER] === "(Nama tidak tersedia)",
);
const mpQuestionRow = findRow(
  (r) =>
    r[KODE] === "MP-CO-01-1" &&
    r[BAGIAN] === "Soal" &&
    r[REVIEWER] === "Dr. Budi, S.Kom.",
);
const mpAnswerRow = findRow((r) => r[BAGIAN] === "Opsi jawaban");
const noChangeRow = findRow(
  (r) =>
    r[KODE] === "MP-CO-01-1" &&
    r[BAGIAN] === "Soal" &&
    r[REVIEWER] === "(Nama tidak tersedia)",
);

// 5. PS Kode Soal = lmsQuestionId (NOT the PS source code)
assert.equal(psRow[col("Minggu")], "WEEK 02");
assert.equal(psRow[col("Tipe Soal")], "PS");
assert.equal(psRow[KODE], PS_LMS_ID);
assert.ok(
  !flatCells.includes("008.UAI konversi suhu c ke f (en)"),
  "PS source_code must not be exported",
);
assert.equal(psRow[col("Kode Miskonsepsi")], "");
assert.equal(psRow[col("Judul Soal")], "Konversi suhu C ke F");

// 6. MP Kode Soal = displayCode; Kode Miskonsepsi = targetMisconceptionId
assert.equal(mpQuestionRow[col("Tipe Soal")], "MP");
assert.equal(mpQuestionRow[KODE], "MP-CO-01-1");
assert.equal(mpQuestionRow[col("Kode Miskonsepsi")], "IO-02");

// 7. question-review row mapping
assert.equal(psRow[BAGIAN], "Soal");
assert.equal(psRow[col("Opsi Jawaban")], "");
assert.equal(psRow[col("Isi Jawaban")], "");

// 8. MP answer-review row includes option + answer text
assert.equal(mpAnswerRow[BAGIAN], "Opsi jawaban");
assert.equal(mpAnswerRow[col("Opsi Jawaban")], "B");
assert.equal(mpAnswerRow[col("Isi Jawaban")], '9, tetapi "salah"');

// 9. no invented PS answer-review behavior
assert.equal(
  csv.rows.filter((r) => r[BAGIAN] === "Opsi jawaban").length,
  1,
  "exactly one answer row, from the MP group",
);
assert.equal(
  csv.rows.filter((r) => r[BAGIAN] === "Opsi jawaban" && r[col("Tipe Soal")] === "PS")
    .length,
  0,
);

// 10. all four Hasil Review cases (ASCII hyphen)
assert.equal(reviewOutcomeLabel([], []), "Sesuai - tanpa perubahan");
assert.equal(
  reviewOutcomeLabel(["IO-01"], []),
  "Perlu revisi - ada miskonsepsi yang dihapus",
);
assert.equal(
  reviewOutcomeLabel([], ["IO-02"]),
  "Perlu revisi - ada miskonsepsi yang ditambahkan",
);
assert.equal(
  reviewOutcomeLabel(["IO-01"], ["IO-02"]),
  "Perlu revisi - ada penghapusan & penambahan",
);
const HASIL = col("Hasil Review");
assert.equal(psRow[HASIL], "Perlu revisi - ada miskonsepsi yang dihapus");
assert.equal(mpQuestionRow[HASIL], "Perlu revisi - ada miskonsepsi yang ditambahkan");
assert.equal(mpAnswerRow[HASIL], "Perlu revisi - ada penghapusan & penambahan");
assert.equal(noChangeRow[HASIL], "Sesuai - tanpa perubahan");

// 11. misconception reference / remove / add / final-set math
assert.deepEqual(
  reviewerFinalMisconceptionIds(["IO-02", "CO-01"], ["IO-02"], ["LO-05"]),
  ["CO-01", "LO-05"],
);
const TERCANTUM = col("Miskonsepsi yang Tercantum");
const DIHAPUS = col("Miskonsepsi yang Dihapus");
const DITAMBAH = col("Miskonsepsi yang Ditambahkan");
const MENURUT = col("Miskonsepsi Menurut Reviewer");
assert.equal(psRow[TERCANTUM], "IO-01 - Salah baca input");
assert.equal(psRow[DIHAPUS], "IO-01 - Salah baca input");
assert.equal(psRow[col("Alasan Penghapusan Miskonsepsi")], "Tidak sesuai konteks soal");
assert.equal(psRow[DITAMBAH], "");
assert.equal(psRow[MENURUT], ""); // IO-01 removed, nothing added
assert.equal(
  mpQuestionRow[TERCANTUM],
  "CO-01 - Salah kondisi; IO-02 - Salah format keluaran",
);
assert.equal(mpQuestionRow[DITAMBAH], "LO-05"); // unknown id -> bare code
assert.equal(
  mpQuestionRow[MENURUT],
  "CO-01 - Salah kondisi; IO-02 - Salah format keluaran; LO-05",
);
assert.equal(mpAnswerRow[TERCANTUM], "IO-02 - Salah format keluaran");
assert.equal(mpAnswerRow[MENURUT], "CO-01 - Salah kondisi");

// 12. misconception human labels: "ID - title" joined by "; "
assert.match(mpQuestionRow[TERCANTUM], /^CO-01 - .+; IO-02 - .+$/);

// 13. reviewer UUID fallback -> "(Nama tidak tersedia)"
assert.equal(psUnnamedRow[REVIEWER], "(Nama tidak tersedia)");
assert.ok(!flatCells.includes(reviewerUnnamed.reviewerId));

// 14. WIB timestamp conversion (+7, no DST)
assert.equal(formatWibDateTime("2026-08-19T10:00:00Z"), "2026-08-19 17:00 WIB");
assert.equal(formatWibDateTime("2026-08-19T17:00:00Z"), "2026-08-20 00:00 WIB");
assert.equal(formatWibDateTime(""), "");
assert.equal(formatWibDateTime("not-a-date"), "not-a-date");
assert.equal(psRow[col("Waktu Review")], "2026-08-19 17:00 WIB");
assert.equal(psRow[col("Terakhir Diperbarui")], "2026-08-20 09:30 WIB");

// 15. WIB filename date
assert.match(wibDateStamp(), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(wibDateStamp(new Date("2026-08-30T20:00:00Z")), "2026-08-31");

// 16. comma / quote / newline CSV escaping survives a real parser round-trip
const serialized = serializeCsv(csv.headers, csv.rows);
assert.ok(serialized.startsWith("﻿"), "UTF-8 BOM present");
assert.ok(serialized.includes("\r\n"), "CRLF row separators present");
const parsed = Papa.parse(serialized.replace(/^﻿/, ""), { header: true });
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.data.length, csv.rows.length);
const parsedPsRow = parsed.data.find(
  (row) => row["Kode Soal"] === PS_LMS_ID && row["Nama Reviewer"] === "Dr. Budi, S.Kom.",
);
assert.equal(parsedPsRow["Isi Jawaban"], "");
assert.equal(
  parsedPsRow["Catatan Tambahan"],
  'Catatan dengan "kutip", koma\ndan baris kedua',
);
assert.equal(parsedPsRow["Waktu Review"], "2026-08-19 17:00 WIB");
const parsedAnswerRow = parsed.data.find(
  (row) => row["Bagian yang Direview"] === "Opsi jawaban",
);
assert.equal(parsedAnswerRow["Isi Jawaban"], '9, tetapi "salah"');

// 17. stale / inactive Review filtering is untouched (guards still present)
const currentReviewsSource = readFileSync(
  "src/utils/adminCurrentReviews.ts",
  "utf8",
);
assert.match(currentReviewsSource, /if \(!review\.isActive\) \{/);
assert.match(
  currentReviewsSource,
  /sourceVersions\.questions\.get\(review\.questionId\) !== review\.sourceVersion/,
);

// 18-20. export stays a pure in-memory transform: no Supabase, no network,
// no write RPCs, no master mutation in the touched modules.
const exportSource = readFileSync("src/utils/adminExports.ts", "utf8");
const csvSource = readFileSync("src/utils/reviewCsv.ts", "utf8");
for (const [name, source] of [
  ["adminExports.ts", exportSource],
  ["reviewCsv.ts", csvSource],
]) {
  assert.doesNotMatch(
    source,
    /from "\.\.\/services\/|supabase\.(rpc|from|auth)|\bfetch\(|sync_master_relation_baselines|saveQuestionReview|saveAnswerReview/,
    `${name} must not touch Supabase / network / baselines`,
  );
}

// CSV "Aktivitas Terakhir" mapping: initial active review -> "Direview".
assert.match(exportSource, /created: "Direview"/);
assert.doesNotMatch(exportSource, /"Dibuat"/);

const reviewsPage = readFileSync("src/pages/AdminReviewsPage.tsx", "utf8");
assert.match(reviewsPage, /getAdminReviewReadSnapshot/);
assert.doesNotMatch(
  reviewsPage,
  /\.insert\(|\.update\(|saveQuestionReview|saveAnswerReview|sync_master/,
);

// 21. Status Review / Aktivitas Terakhir: active + no lifecycle -> "Aktif" /
// "Direview" (presentation wording for an initial, never-edited active review).
const STATUS = col("Status Review");
const AKTIVITAS = col("Aktivitas Terakhir");
assert.equal(psRow[STATUS], "Aktif");
assert.equal(psRow[AKTIVITAS], "Direview");
assert.ok(
  !csv.rows.some((r) => r[AKTIVITAS] === "Dibuat"),
  'the initial activity label is "Direview", never "Dibuat"',
);
assert.equal(mpAnswerRow[STATUS], "Aktif");

// 22. An edited active review is still "Aktif" but the activity is "Diedit".
const editedCsv = buildCurrentReviewsCsv(groups, {
  misconceptions,
  language: "id",
  lifecycle: [
    { reviewType: "question", reviewId: "qr-ps", lastEventType: "edited", lastEventAt: null, edited: true, lastDeletedAt: null, lastDeletedBefore: null },
  ],
});
const editedPsRow = editedCsv.rows.find(
  (r) => r[KODE] === PS_LMS_ID && r[REVIEWER] === "Dr. Budi, S.Kom.",
);
assert.equal(editedPsRow[STATUS], "Aktif");
assert.equal(editedPsRow[AKTIVITAS], "Diedit");

// 23. A deleted generation exports once, marked "Dihapus" / "Dihapus", with the
// deletion time in "Terakhir Diperbarui" and no duplicate "active vote" row.
const deletedGroups = [
  {
    question: mpQuestion,
    reviewers: [],
    deletedReviewers: [
      {
        reviewer: reviewerNamed,
        questionReview: {
          ...base,
          id: "qr-mp-deleted",
          questionId: "Q020",
          isActive: false,
          inactiveReason: "deleted",
          inactiveAt: "2026-08-22T03:00:00Z",
          updatedAt: "2026-08-22T03:00:00Z",
        },
        answerReviews: [],
      },
    ],
  },
];
const deletedCsv = buildCurrentReviewsCsv(deletedGroups, {
  misconceptions,
  language: "id",
});
assert.equal(deletedCsv.rows.length, 1);
assert.equal(deletedCsv.rows[0][STATUS], "Dihapus");
assert.equal(deletedCsv.rows[0][AKTIVITAS], "Dihapus");
assert.equal(deletedCsv.rows[0][col("Terakhir Diperbarui")], "2026-08-22 10:00 WIB");
assert.equal(deletedCsv.rows[0][REVIEWER], "Dr. Budi, S.Kom.");

console.log("Lecturer review-results export checks passed.");
