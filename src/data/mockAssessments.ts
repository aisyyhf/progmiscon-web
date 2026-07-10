import type { Assessment } from "../types";

export const mockAssessments: Assessment[] = [
  {
    id: "asm-uts",
    title: { id: "UTS Alpro 1", en: "Midterm Exam Alpro 1" },
    kind: "uts",
    course: { id: "Algoritma dan Pemrograman 1", en: "Algorithms and Programming 1" },
    semester: 1,
  },
  {
    id: "asm-uas",
    title: { id: "UAS Alpro 1", en: "Final Exam Alpro 1" },
    kind: "uas",
    course: { id: "Algoritma dan Pemrograman 1", en: "Algorithms and Programming 1" },
    semester: 1,
  },
  {
    id: "asm-quiz-loop",
    title: { id: "Quiz Perulangan", en: "Quiz Loop" },
    kind: "quiz",
    course: { id: "Algoritma dan Pemrograman 1", en: "Algorithms and Programming 1" },
    semester: 1,
  },
  {
    id: "asm-latihan-ifelse",
    title: { id: "Latihan If-Else", en: "Practice If-Else" },
    kind: "practice",
    course: { id: "Algoritma dan Pemrograman 1", en: "Algorithms and Programming 1" },
    semester: 1,
  },
];
