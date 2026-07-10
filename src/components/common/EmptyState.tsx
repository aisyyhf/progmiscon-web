export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed border-border bg-white/60 px-6 py-16 text-center text-sm text-muted">
      {message}
    </div>
  );
}
