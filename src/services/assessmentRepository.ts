import type { Assessment } from "../types";
import { mockAssessments } from "../data/mockAssessments";

export async function getAssessments(): Promise<Assessment[]> {
  return mockAssessments;
}

export async function getAssessmentById(id: string): Promise<Assessment | undefined> {
  return mockAssessments.find((assessment) => assessment.id === id);
}
