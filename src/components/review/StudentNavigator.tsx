import type { Student } from "../../types";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";

export function StudentNavigator({
  allStudents,
  selectedStudentId,
  onSelectStudent,
  filteredStudentIds,
}: {
  allStudents: Student[];
  selectedStudentId: string;
  onSelectStudent: (studentId: string) => void;
  filteredStudentIds: string[];
}) {
  const { language } = useLanguage();
  const selectedStudent = allStudents.find((s) => s.id === selectedStudentId);
  const indexInFiltered = filteredStudentIds.indexOf(selectedStudentId);
  const previousId = indexInFiltered > 0 ? filteredStudentIds[indexInFiltered - 1] : undefined;
  const nextId =
    indexInFiltered >= 0 && indexInFiltered < filteredStudentIds.length - 1
      ? filteredStudentIds[indexInFiltered + 1]
      : undefined;

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => previousId && onSelectStudent(previousId)}
          disabled={!previousId}
          className="cursor-pointer rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-navy-deep transition hover:-translate-y-px hover:border-navy/50 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-0"
          aria-label={t(uiText.previous, language)}
        >
          ← {t(uiText.previous, language)}
        </button>

        <select
          aria-label={t(uiText.selectStudent, language)}
          value={selectedStudentId}
          onChange={(event) => onSelectStudent(event.target.value)}
          className="cursor-pointer rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-navy-deep transition hover:border-navy/50 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {filteredStudentIds.map((id) => {
            const student = allStudents.find((s) => s.id === id);
            if (!student) return null;
            return (
              <option key={id} value={id}>
                {t(uiText.student, language)} {String(student.number).padStart(2, "0")}
              </option>
            );
          })}
        </select>

        <button
          type="button"
          onClick={() => nextId && onSelectStudent(nextId)}
          disabled={!nextId}
          className="cursor-pointer rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-navy-deep transition hover:-translate-y-px hover:border-navy/50 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand active:translate-y-0"
          aria-label={t(uiText.next, language)}
        >
          {t(uiText.next, language)} →
        </button>

        <span className="ml-auto text-sm text-muted">
          {t(uiText.student, language)} {selectedStudent ? String(selectedStudent.number).padStart(2, "0") : "--"} /{" "}
          {allStudents.length}
        </span>
      </div>
    </div>
  );
}
