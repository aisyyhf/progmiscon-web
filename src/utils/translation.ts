import type { Language, LocalizedText } from "../types";

export function t(text: LocalizedText, language: Language): string {
  return text[language];
}

export const uiText = {
  navHome: { id: "Beranda", en: "Home" },
  navMateri: { id: "Soal", en: "Questions" },
  navUjian: { id: "Ujian", en: "Assessment" },
  navKonsep: { id: "Konsep", en: "Concepts" },
  navMiskonsepsi: { id: "Miskonsepsi", en: "Misconceptions" },
  navReview: { id: "Review", en: "Review" },

  homeTitle: { id: "Progmiscon", en: "Progmiscon" },
  homeSubtitle: {
    id: "Bank soal berbasis miskonsepsi pemrograman dasar",
    en: "A misconception-centered question bank for introductory programming",
  },
  homeDescription: {
    id: "Progmiscon membantu pengguna menelusuri soal pseudocode, konsep pemrograman dasar, serta miskonsepsi yang sering muncul pada variasi jawaban mahasiswa.",
    en: "Progmiscon helps users explore pseudocode questions, introductory programming concepts, and misconceptions commonly found in anonymous student answer variations.",
  },
  homeStartMaterial: { id: "Mulai dari Soal", en: "Start from Questions" },
  lecturerPortal: { id: "Akun Dosen", en: "Lecturer Account" },
  homeExploreConcepts: { id: "Jelajahi Konsep", en: "Explore Concepts" },
  homeBrowseMisconceptions: { id: "Telusuri Miskonsepsi", en: "Browse Misconceptions" },
  homeLecturerPortalNote: {
    id: "Untuk validasi label miskonsepsi, gunakan Akun Dosen di kanan atas.",
    en: "To validate misconception labels, use Lecturer Account in the top-right corner.",
  },
  howItWorks: { id: "Cara Kerja", en: "How It Works" },
  homeStepOne: { id: "Pilih materi dan buka soal pseudocode", en: "Choose material and open a pseudocode question" },
  homeStepTwo: { id: "Baca variasi jawaban anonim yang terhubung dengan miskonsepsi", en: "Read anonymous answer variations connected to misconceptions" },
  homeStepThree: { id: "Telusuri miskonsepsi, konsep, dan soal terkait", en: "Explore related misconceptions, concepts, and questions" },
  homeExamples: { id: "Contoh untuk ditelusuri", en: "Examples to explore" },

  materiTitle: { id: "Soal", en: "Questions" },
  materiDescription: {
    id: "Jelajahi soal berdasarkan konsep, minggu, dan pola miskonsepsi",
    en: "Explore questions by concept, week, and misconception pattern",
  },
  ujianTitle: { id: "Ujian", en: "Assessment" },
  ujianDescription: {
    id: "Telusuri soal berdasarkan ujian atau evaluasi.",
    en: "Browse questions by exam or assessment.",
  },
  konsepTitle: { id: "Konsep", en: "Concepts" },
  konsepDescription: {
    id: "Pelajari konsep dasar pemrograman yang muncul dalam berbagai materi",
    en: "Explore the programming concepts used across different topics",
  },
  conceptMisconceptions: { id: "Miskonsepsi tentang", en: "Misconceptions about" },
  miskonsepsiTitle: { id: "Miskonsepsi", en: "Misconceptions" },
  miskonsepsiDescription: {
    id: "Telusuri inventaris miskonsepsi, konsep terkait, soal, dan variasi jawaban anonim.",
    en: "Explore the misconception inventory, related concepts, questions, and anonymous answer variations.",
  },
  openMisconceptionPage: { id: "Buka Halaman Miskonsepsi", en: "Open Misconception Page" },
  viewRelatedQuestions: { id: "Lihat Soal Terkait", en: "View Related Questions" },
  backToQuestionReview: { id: "Kembali ke detail soal", en: "Back to question detail" },
  referencePseudocode: { id: "Pseudocode Acuan", en: "Reference Pseudocode" },
  studentAnswerExamples: { id: "Variasi Jawaban Anonim", en: "Anonymous Answer Variations" },
  documentedMisconceptions: {
    id: "miskonsepsi terdokumentasi",
    en: "documented misconceptions",
  },
  noConceptMisconceptions: {
    id: "Belum ada miskonsepsi yang ditautkan ke konsep ini.",
    en: "No misconception has been linked to this concept yet.",
  },

  filterAll: { id: "Semua", en: "All" },
  filterUts: { id: "UTS", en: "Midterm" },
  filterUas: { id: "UAS", en: "Final" },
  filterQuiz: { id: "Quiz", en: "Quiz" },
  filterPractice: { id: "Latihan", en: "Practice" },
  filterShortAnswer: { id: "Isian", en: "Short Answer" },
  filterMultipleChoice: { id: "Pilihan Ganda", en: "Multiple Choice" },

  filterCorrect: { id: "Benar", en: "Correct" },
  filterIncorrect: { id: "Salah", en: "Incorrect" },
  filterHasMisconception: { id: "Ada Miskonsepsi", en: "Has Misconception" },

  questionMisconceptions: { id: "Miskonsepsi Soal", en: "Question Misconceptions" },
  studentMisconceptions: { id: "Miskonsepsi pada Jawaban", en: "Answer Misconceptions" },
  relatedMisconceptions: { id: "Miskonsepsi Terkait", en: "Related Misconceptions" },
  relatedQuestions: { id: "Soal Terkait", en: "Related Questions" },
  expectedConcepts: { id: "Konsep", en: "Concept" },
  incorrectElements: { id: "Elemen yang Salah", en: "Incorrect Elements" },
  astStructure: { id: "Struktur AST", en: "AST Structure" },
  astAvailable: { id: "AST Tersedia", en: "AST Available" },
  astUnavailable: { id: "AST Belum Tersedia", en: "AST Unavailable" },
  astUnavailableMessage: { id: "AST belum tersedia.", en: "AST is unavailable." },

  viewInConcepts: { id: "Lihat di Konsep", en: "View in Concepts" },

  checkOutput: { id: "Output Sesuai", en: "Output Matches" },
  checkLogic: { id: "Logika", en: "Logic" },
  checkPseudocode: { id: "Sintaks Pseudocode", en: "Pseudocode Syntax" },
  checkConcept: { id: "Pemahaman Konsep", en: "Concept Understanding" },

  pass: { id: "Sesuai", en: "Pass" },
  fail: { id: "Tidak Sesuai", en: "Fail" },

  resultConfirmed: { id: "Terkonfirmasi", en: "Confirmed" },
  resultNotConfirmed: { id: "Tidak Terkonfirmasi", en: "Not Confirmed" },
  resultNeedsReview: { id: "Perlu Dicek", en: "Needs Review" },
  verificationHelper: {
    id: "Hasil ini hanya memeriksa miskonsepsi, bukan status utama jawaban.",
    en: "This result checks the misconception only, not the main answer status.",
  },

  drawerWrong: { id: "Salah", en: "Wrong" },
  drawerCorrect: { id: "Benar", en: "Correct" },
  drawerFix: { id: "Koreksi", en: "Fix" },
  drawerCause: { id: "Penyebab", en: "Cause" },
  drawerPattern: { id: "Pola", en: "Pattern" },
  drawerValue: { id: "Manfaat", en: "Value" },
  drawerConcepts: { id: "Konsep", en: "Concepts" },
  relatedConcepts: { id: "Konsep Terkait", en: "Related Concepts" },
  drawerVerification: { id: "Pemeriksaan Verifikasi", en: "Verification Check" },

  breadcrumbHome: { id: "Home", en: "Home" },
  breadcrumbMateri: { id: "Soal", en: "Questions" },
  breadcrumbKonsep: { id: "Konsep", en: "Concepts" },
  breadcrumbMiskonsepsi: { id: "Miskonsepsi", en: "Misconceptions" },
  back: { id: "Kembali", en: "Back" },

  previous: { id: "Sebelumnya", en: "Previous" },
  next: { id: "Berikutnya", en: "Next" },
  student: { id: "Mahasiswa", en: "Student" },
  selectStudent: { id: "Pilih mahasiswa", en: "Select student" },

  answerStatus: { id: "Status Jawaban", en: "Answer Status" },
  studentAnswerLabel: { id: "Jawaban", en: "Answer" },
  selectedOptionLabel: { id: "Opsi yang Dipilih", en: "Selected Option" },
  correctOptionLabel: { id: "Jawaban benar", en: "Correct answer" },
  mapsToMisconception: { id: "terkait dengan miskonsepsi", en: "maps to misconception" },

  emptyMisconceptions: {
    id: "Tidak ada miskonsepsi soal untuk pertanyaan ini.",
    en: "No question misconceptions for this question.",
  },
  emptyCorrectStudentMisconceptions: {
    id: "Jawaban ini sudah sesuai, sehingga tidak ada miskonsepsi yang muncul pada variasi ini.",
    en: "This answer is correct, so no misconception appears in this variation.",
  },
  emptyIncorrectStudentMisconceptions: {
    id: "Belum ada miskonsepsi spesifik yang ditautkan pada jawaban ini.",
    en: "No specific misconception has been linked to this answer yet.",
  },
  emptyCorrectAnswerMisconceptions: {
    id: "Jawaban ini sudah sesuai, sehingga tidak ada miskonsepsi yang muncul pada variasi ini.",
    en: "This answer is correct, so no misconception appears in this variation.",
  },
  emptyIncorrectAnswerMisconceptions: {
    id: "Belum ada miskonsepsi spesifik yang ditautkan pada variasi jawaban ini.",
    en: "No specific misconception has been linked to this answer variation yet.",
  },
  noVerification: {
    id: "Belum ada pemeriksaan verifikasi untuk miskonsepsi ini.",
    en: "No verification check available for this misconception.",
  },
  selectMaterialPrompt: {
    id: "Pilih materi di sebelah kiri untuk melihat daftar soal.",
    en: "Select a material on the left to see its questions.",
  },
  selectAssessmentPrompt: {
    id: "Pilih ujian di sebelah kiri untuk melihat daftar soal.",
    en: "Select an assessment on the left to see its questions.",
  },
  selectMisconceptionPrompt: {
    id: "Pilih miskonsepsi di daftar untuk melihat detailnya.",
    en: "Select a misconception from the list to see its detail.",
  },
  noQuestions: {
    id: "Tidak ada soal yang cocok dengan filter ini.",
    en: "No questions match this filter.",
  },
} as const;
