export function EmptyState({ message }: { message: string }) {
  return (
    <div className="academic-panel-quiet flex min-h-40 items-center justify-center px-6 py-12 text-center">
      <div className="max-w-sm border-l-2 border-brand pl-4 text-left text-sm leading-6 text-muted">
        {message}
      </div>
    </div>
  );
}
