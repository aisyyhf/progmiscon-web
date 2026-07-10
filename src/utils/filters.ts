import type { Assessment, AssessmentKind, Question, QuestionType, StudentAnswer } from "../types";

export type AssessmentKindFilter = "all" | AssessmentKind;
export type QuestionTypeFilter = "all" | QuestionType;
export type StudentFilter = "all" | "correct" | "incorrect" | "has_misconception";

export function filterQuestionsByAssessmentKind(
  questions: Question[],
  assessments: Assessment[],
  kind: AssessmentKindFilter,
): Question[] {
  if (kind === "all") return questions;
  const matchingAssessmentIds = new Set(
    assessments.filter((assessment) => assessment.kind === kind).map((assessment) => assessment.id),
  );
  return questions.filter((question) => matchingAssessmentIds.has(question.assessmentId));
}

export function filterQuestionsByType(questions: Question[], type: QuestionTypeFilter): Question[] {
  if (type === "all") return questions;
  return questions.filter((question) => question.type === type);
}

export function filterStudentsByAnswer(
  studentIds: string[],
  answersByStudentId: Map<string, StudentAnswer | undefined>,
  filter: StudentFilter,
): string[] {
  if (filter === "all") return studentIds;
  return studentIds.filter((studentId) => {
    const answer = answersByStudentId.get(studentId);
    if (!answer) return false;
    if (filter === "correct") return answer.status === "correct";
    if (filter === "incorrect") return answer.status === "incorrect";
    return answer.studentMisconceptionIds.length > 0;
  });
}
