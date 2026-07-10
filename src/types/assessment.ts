import type { LocalizedText } from "./language";

export type AssessmentKind = "uts" | "uas" | "quiz" | "practice";

export type Assessment = {
  id: string;
  title: LocalizedText;
  kind: AssessmentKind;
  course: LocalizedText;
  semester: number;
};
