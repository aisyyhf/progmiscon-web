import type { Student } from "../types";

export const mockStudents: Student[] = Array.from({ length: 24 }, (_, index) => ({
  id: `stu-${String(index + 1).padStart(2, "0")}`,
  displayName: `Case ${String(index + 1).padStart(2, "0")}`,
  number: index + 1,
}));
