import {
  Binary,
  Box,
  CircleDivide,
  Database,
  GitBranch,
  LockKeyhole,
  Repeat2,
  Route,
  Shapes,
  Sigma,
  Terminal,
  type LucideIcon,
} from "lucide-react";
import type { LocalizedText } from "../../types";

const conceptIcons: Record<string, LucideIcon> = {
  "alur eksekusi": Route,
  "execution flow": Route,
  ekspresi: Binary,
  expressions: Binary,
  "input/output": Terminal,
  konstanta: LockKeyhole,
  constants: LockKeyhole,
  operator: CircleDivide,
  operators: CircleDivide,
  percabangan: GitBranch,
  conditionals: GitBranch,
  perulangan: Repeat2,
  loops: Repeat2,
  variabel: Box,
  variables: Box,
  "data/koleksi": Database,
  "data/collection": Database,
  fungsi: Sigma,
  functions: Sigma,
};

export function ConceptIcon({ name, size = 18 }: { name: LocalizedText; size?: number }) {
  const Icon =
    conceptIcons[name.id.toLocaleLowerCase()] ??
    conceptIcons[name.en.toLocaleLowerCase()] ??
    Shapes;

  return <Icon size={size} strokeWidth={2} aria-hidden="true" />;
}
