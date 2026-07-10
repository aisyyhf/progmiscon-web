import type { Student } from "../types";
import { mockStudents } from "../data/mockStudents";

export async function getStudents(): Promise<Student[]> {
  return [...mockStudents].sort((a, b) => a.number - b.number);
}

export async function getStudentById(id: string): Promise<Student | undefined> {
  return mockStudents.find((student) => student.id === id);
}
