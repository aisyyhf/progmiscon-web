import { Loader2 } from "lucide-react";

export function EmptyState({
  message,
  loading = false,
}: {
  message: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div
        role="status"
        className="flex min-h-40 items-center justify-center gap-2.5 px-6 py-12 text-center text-sm text-muted"
      >
        <Loader2 size={16} strokeWidth={2} className="animate-spin text-brand" aria-hidden="true" />
        {message}
      </div>
    );
  }

  return (
    <div className="academic-panel-quiet flex items-center justify-center px-6 py-8 text-center">
      <div className="max-w-sm text-sm leading-6 text-muted">{message}</div>
    </div>
  );
}
