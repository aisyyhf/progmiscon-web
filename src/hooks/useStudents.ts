import type { Student } from "../types";
import { getStudents } from "../services/studentRepository";
import { useAsyncData } from "./useAsyncData";

export function useStudents(): { students: Student[]; loading: boolean } {
  const { data, loading } = useAsyncData<Student[]>(getStudents, [], []);
  return { students: data, loading };
}
