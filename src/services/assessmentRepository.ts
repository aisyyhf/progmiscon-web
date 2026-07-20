import type { Assessment } from "../types";
import { mockAssessments } from "../data/mockAssessments";
import { usesGoogleSheets } from "../config/masterDataConfig";
import { getSheetAssessments } from "./masterDataRepository";

export async function getAssessments(): Promise<Assessment[]> {
  return usesGoogleSheets() ? getSheetAssessments() : mockAssessments;
}

export async function getAssessmentById(id: string): Promise<Assessment | undefined> {
  const assessments = await getAssessments();
  return assessments.find((assessment) => assessment.id === id);
}
