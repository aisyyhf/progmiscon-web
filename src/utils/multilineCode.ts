export function normalizeMultilineCode(value: string): string {
  return value.replace(/\r\n/g, "\n");
}
