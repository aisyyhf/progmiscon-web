const TELKOM_LECTURER_EMAIL_PATTERN =
  /^[^@\s]+@telkomuniversity\.ac\.id$/i;

export function normalizeLecturerEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isTelkomLecturerEmail(email: string): boolean {
  return TELKOM_LECTURER_EMAIL_PATTERN.test(email.trim());
}
