export type EvidenceIdentity = {
  primary: string;
  secondary?: string;
};

export function resolveEvidenceIdentity(
  studentName: string | null | undefined,
  studentUserId: string | null | undefined,
  legacyDisplayName?: string,
): EvidenceIdentity | undefined {
  const name = studentName?.trim() || legacyDisplayName?.trim();
  const userId = studentUserId?.trim();

  if (name) return userId ? { primary: name, secondary: userId } : { primary: name };
  if (userId) return { primary: userId };
  return undefined;
}
