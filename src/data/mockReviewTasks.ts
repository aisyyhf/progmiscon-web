import type { ReviewTask } from "../types";

export const mockReviewTasks: ReviewTask[] = [
  {
    id: "rt-conflict-evenloop",
    questionId: "q-evenloop",
    answerCaseId: "ans-q-evenloop-stu-07",
    suggestedMisconceptionId: "mc-loop-boundary",
    explanation: {
      id: "Kondisi i < 10 menghentikan perulangan sebelum angka 10 tercetak, sehingga jawaban menunjukkan pemahaman yang keliru terhadap batas akhir perulangan.",
      en: "The i < 10 condition stops the loop before 10 is printed, showing a misunderstanding of the loop's final boundary.",
    },
    reviewerDecisions: [
      { reviewerId: "rev-01", decision: "agree", selectedMisconceptionId: "mc-loop-boundary" },
      { reviewerId: "rev-02", decision: "disagree", selectedMisconceptionId: "mc-missing-increment" },
    ],
  },
  {
    id: "rt-new-swap",
    questionId: "q-swap",
    answerCaseId: "ans-q-swap-stu-02",
    suggestedMisconceptionId: "mc-swap-no-temp",
    explanation: {
      id: "Nilai awal A ditimpa sebelum disimpan, sehingga nilai tersebut tidak dapat dipindahkan kembali ke B.",
      en: "The original value of A is overwritten before being stored, so it cannot be assigned back to B.",
    },
    reviewerDecisions: [],
  },
  {
    id: "rt-one-boolrange",
    questionId: "q-boolrange",
    answerCaseId: "ans-q-boolrange-stu-02",
    suggestedMisconceptionId: "mc-and-or-confusion",
    explanation: {
      id: "Penggunaan OR membuat ekspresi menerima nilai di luar rentang inklusif yang diminta.",
      en: "Using OR makes the expression accept values outside the requested inclusive range.",
    },
    reviewerDecisions: [
      { reviewerId: "rev-01", decision: "agree", selectedMisconceptionId: "mc-and-or-confusion" },
    ],
  },
  {
    id: "rt-stable-print15",
    questionId: "q-print15",
    answerCaseId: "ans-q-print15-stu-02",
    suggestedMisconceptionId: "mc-loop-boundary",
    explanation: {
      id: "Kondisi perulangan berhenti sebelum mencetak batas atas yang seharusnya ikut ditampilkan.",
      en: "The loop condition stops before printing the inclusive upper bound.",
    },
    reviewerDecisions: [
      { reviewerId: "rev-01", decision: "agree", selectedMisconceptionId: "mc-loop-boundary" },
      { reviewerId: "rev-02", decision: "agree", selectedMisconceptionId: "mc-loop-boundary" },
    ],
  },
];
