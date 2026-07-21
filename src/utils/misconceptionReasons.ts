export function groupMisconceptionReasons<T>(misconceptionCount: number, reasons: T[]): T[][] {
  if (misconceptionCount <= 0) return [];
  if (misconceptionCount === 1) return [reasons];

  return Array.from({ length: misconceptionCount }, (_, index) => {
    if (index === misconceptionCount - 1) return reasons.slice(index);
    return reasons[index] ? [reasons[index]] : [];
  });
}
