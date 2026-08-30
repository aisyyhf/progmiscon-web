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
  displayCode: "MP-IO-02-1",
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

const baseReview = {
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
  ...baseReview,
  id: "qr-ps",
  questionId: "Q002",
  removedMisconceptionIds: ["IO-01"],
  removalReason: "Tidak sesuai konteks soal",
  note: 'Catatan dengan "kutip", koma\ndan baris kedua',
};
const mpQuestionReview = {
  ...baseReview,
  id: "qr-mp",
  questionId: "Q020",
  additionalMisconceptionIds: ["LO-05"],
  additionReason: "Perlu ditambah",
};
const mpAnswerReview = {
  ...baseReview,
  id: "ar-mp",
  answerId: "A020-B",
  questionId: "Q020",
  removedMisconceptionIds: ["IO-02"],
  removalReason: "Tidak konsisten",
  additionalMisconceptionIds: ["CO-01"],
  additionReason: "Lebih tepat",
};
const noChangeReview = {
  ...baseReview,
  id: "qr-none",
  questionId: "Q020",
};

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
      { reviewer: reviewerUnnamed, questionReview: { ...baseReview, id: "qr-ps-2", questionId: "Q002" }, answerReviews: [] },
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

// 1. exact final 20-column order
assert.deepEqual(csv.headers, [
  "minggu",
  "tipe_soal",
  "id_lms",
  "kode_soal",
  "kode_miskonsepsi",
  "nama_soal",
  "objek_review",
  "opsi_jawaban",
  "isi_jawaban",
  "reviewer",
  "hasil_review",
  "miskonsepsi_acuan",
  "miskonsepsi_dihapus",
  "alasan_penghapusan",
  "miskonsepsi_ditambahkan",
  "alasan_penambahan",
  "miskonsepsi_usulan_reviewer",
  "catatan",
  "waktu_review",
  "terakhir_diperbarui",
]);
assert.deepEqual([...lecturerReviewHeaders], csv.headers);

// 2 + 3. removed internal fields / no UUID / no internal Qxxx anywhere in output
for (const internal of [
  "review_id",
  "reviewer_id",
  "reviewer_email",
  "reviewer_name",
  "question_id",
  "answer_id",
  "source_version",
  "is_active",
  "has_incorrect_question_misconceptions",
  "has_mismatched_answer_misconceptions",
  "has_additional_misconceptions",
  "created_at",
  "updated_at",
]) {
  assert.ok(!csv.headers.includes(internal), `header ${internal} must be gone`);
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

const PS_KODE = "008.UAI konversi suhu c ke f (en)";
const findRow = (predicate) => {
  const match = csv.rows.find(predicate);
  assert.ok(match, "expected a matching CSV row");
  return match;
};
const psRow = findRow((r) => r[3] === PS_KODE && r[9] === "Dr. Budi, S.Kom.");
const psUnnamedRow = findRow(
  (r) => r[3] === PS_KODE && r[9] === "(Nama tidak tersedia)",
);
const mpQuestionRow = findRow(
  (r) => r[3] === "MP-IO-02-1" && r[6] === "Soal" && r[9] === "Dr. Budi, S.Kom.",
);
const mpAnswerRow = findRow((r) => r[6] === "Opsi jawaban");
const noChangeRow = findRow(
  (r) =>
    r[3] === "MP-IO-02-1" && r[6] === "Soal" && r[9] === "(Nama tidak tersedia)",
);

// 4. PS mapping: id_lms from lmsQuestionId, kode_soal from sourceCode
assert.equal(psRow[0], "WEEK 02");
assert.equal(psRow[1], "PS");
assert.equal(psRow[2], "10413319");
assert.equal(psRow[3], "008.UAI konversi suhu c ke f (en)");
assert.equal(psRow[4], "");
assert.equal(psRow[5], "Konversi suhu C ke F");

// 5. MP mapping: id_lms blank, kode_soal from displayCode, kode_miskonsepsi from target
assert.equal(mpQuestionRow[1], "MP");
assert.equal(mpQuestionRow[2], "");
assert.equal(mpQuestionRow[3], "MP-IO-02-1");
assert.equal(mpQuestionRow[4], "IO-02");

// 6. question-review row mapping
assert.equal(psRow[6], "Soal");
assert.equal(psRow[7], "");
assert.equal(psRow[8], "");

// 7. MP answer-review row includes option + answer text
assert.equal(mpAnswerRow[6], "Opsi jawaban");
assert.equal(mpAnswerRow[7], "B");
assert.equal(mpAnswerRow[8], '9, tetapi "salah"');

// 8. no invented PS answer-review behavior: only groups' answerReviews produce
// answer rows, and PS groups here have none.
assert.equal(
  csv.rows.filter((row) => row[6] === "Opsi jawaban").length,
  1,
  "exactly one answer row, from the MP group",
);
assert.equal(
  csv.rows.filter((row) => row[6] === "Opsi jawaban" && row[1] === "PS").length,
  0,
);

// 9. all four hasil_review cases
assert.equal(reviewOutcomeLabel([], []), "Sesuai – tanpa perubahan");
assert.equal(
  reviewOutcomeLabel(["IO-01"], []),
  "Perlu revisi – ada miskonsepsi yang dihapus",
);
assert.equal(
  reviewOutcomeLabel([], ["IO-02"]),
  "Perlu revisi – ada miskonsepsi yang ditambahkan",
);
assert.equal(
  reviewOutcomeLabel(["IO-01"], ["IO-02"]),
  "Perlu revisi – ada penghapusan & penambahan",
);
assert.equal(psRow[10], "Perlu revisi – ada miskonsepsi yang dihapus");
assert.equal(mpQuestionRow[10], "Perlu revisi – ada miskonsepsi yang ditambahkan");
assert.equal(mpAnswerRow[10], "Perlu revisi – ada penghapusan & penambahan");
assert.equal(noChangeRow[10], "Sesuai – tanpa perubahan");

// 10. misconception acuan / remove / add / final-set math
assert.deepEqual(
  reviewerFinalMisconceptionIds(["IO-02", "CO-01"], ["IO-02"], ["LO-05"]),
  ["CO-01", "LO-05"],
);
assert.equal(psRow[11], "IO-01 – Salah baca input"); // acuan
assert.equal(psRow[12], "IO-01 – Salah baca input"); // dihapus
assert.equal(psRow[13], "Tidak sesuai konteks soal"); // alasan_penghapusan
assert.equal(psRow[14], ""); // ditambahkan
assert.equal(psRow[16], ""); // usulan reviewer: IO-01 removed, nothing added
assert.equal(mpQuestionRow[11], "CO-01 – Salah kondisi; IO-02 – Salah format keluaran");
assert.equal(mpQuestionRow[14], "LO-05"); // added, unknown id -> bare code
assert.equal(
  mpQuestionRow[16],
  "CO-01 – Salah kondisi; IO-02 – Salah format keluaran; LO-05",
);
assert.equal(mpAnswerRow[11], "IO-02 – Salah format keluaran"); // acuan from answer
assert.equal(mpAnswerRow[16], "CO-01 – Salah kondisi");

// 11. misconception human labels format "ID – title" joined by "; "
assert.match(mpQuestionRow[11], /^CO-01 – .+; IO-02 – .+$/);

// 12. reviewer UUID fallback -> "(Nama tidak tersedia)"
assert.equal(psUnnamedRow[9], "(Nama tidak tersedia)");
assert.ok(!flatCells.includes(reviewerUnnamed.reviewerId));

// 13. WIB timestamp conversion (+7, no DST)
assert.equal(formatWibDateTime("2026-08-19T10:00:00Z"), "2026-08-19 17:00 WIB");
assert.equal(formatWibDateTime("2026-08-19T17:00:00Z"), "2026-08-20 00:00 WIB");
assert.equal(formatWibDateTime(""), "");
assert.equal(formatWibDateTime("not-a-date"), "not-a-date");
assert.equal(psRow[18], "2026-08-19 17:00 WIB");
assert.equal(psRow[19], "2026-08-20 09:30 WIB");

// 14. WIB filename date
assert.match(wibDateStamp(), /^\d{4}-\d{2}-\d{2}$/);
assert.equal(wibDateStamp(new Date("2026-08-30T20:00:00Z")), "2026-08-31");

// 15. comma / quote / newline CSV escaping survives a real parser round-trip
const serialized = serializeCsv(csv.headers, csv.rows);
assert.ok(serialized.startsWith("﻿"), "UTF-8 BOM present");
assert.ok(serialized.includes("\r\n"), "CRLF row separators present");
const parsed = Papa.parse(serialized.replace(/^﻿/, ""), { header: true });
assert.deepEqual(parsed.errors, []);
assert.equal(parsed.data.length, csv.rows.length);
const parsedPsRow = parsed.data.find(
  (row) => row.kode_soal === PS_KODE && row.reviewer === "Dr. Budi, S.Kom.",
);
assert.equal(parsedPsRow.isi_jawaban, "");
assert.equal(parsedPsRow.catatan, 'Catatan dengan "kutip", koma\ndan baris kedua');
assert.equal(parsedPsRow.waktu_review, "2026-08-19 17:00 WIB");
const parsedAnswerRow = parsed.data.find((row) => row.objek_review === "Opsi jawaban");
assert.equal(parsedAnswerRow.isi_jawaban, '9, tetapi "salah"');

// 16. stale / inactive Review filtering is untouched (guards still present)
const currentReviewsSource = readFileSync(
  "src/utils/adminCurrentReviews.ts",
  "utf8",
);
assert.match(currentReviewsSource, /if \(!review\.isActive\) \{/);
assert.match(
  currentReviewsSource,
  /sourceVersions\.questions\.get\(review\.questionId\) !== review\.sourceVersion/,
);

// 17-20. export stays a pure in-memory transform: no Supabase, no network,
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

const reviewsPage = readFileSync("src/pages/AdminReviewsPage.tsx", "utf8");
assert.match(reviewsPage, /getAdminReviewReadSnapshot/);
assert.doesNotMatch(
  reviewsPage,
  /\.insert\(|\.update\(|saveQuestionReview|saveAnswerReview|sync_master/,
);

console.log("Lecturer review-results export checks passed.");
