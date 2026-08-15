export function formatLecturerSidebarName(
  fullName?: string | null,
): string {
  const words = fullName?.trim().split(/\s+/).filter(Boolean) ?? [];

  return words
    .map((word, index) =>
      index < 2 ? word : `${word.charAt(0).toLocaleUpperCase()}.`,
    )
    .join(" ");
}
