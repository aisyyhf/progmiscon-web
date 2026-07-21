import { useEffect } from "react";
import { useLanguage } from "../../hooks/useLanguage";
import { t, uiText } from "../../utils/translation";
import { cn } from "../../utils/cn";
import { MisconceptionDetail } from "./MisconceptionDetail";

export function MisconceptionDrawer({
  open,
  misconceptionId,
  onClose,
  onSelectRelatedMisconception,
  onSelectRelatedQuestion,
  onViewInConcept,
  onOpenMisconceptionPage,
  verificationContext,
}: {
  open: boolean;
  misconceptionId?: string;
  onClose: () => void;
  onSelectRelatedMisconception: (id: string) => void;
  onSelectRelatedQuestion: (questionId: string) => void;
  onViewInConcept: (conceptId: string) => void;
  onOpenMisconceptionPage?: (misconceptionId: string) => void;
  verificationContext?: { questionId: string; studentId: string };
}) {
  const { language } = useLanguage();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-30 transition-opacity",
        open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-navy-deep/30" onClick={onClose} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={t(uiText.questionMisconceptions, language)}
        className={cn(
          "thin-scroll absolute right-0 top-0 h-full w-full overflow-y-auto bg-white shadow-xl transition-transform sm:w-[460px]",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
            {language === "id" ? "Detail Miskonsepsi" : "Misconception Detail"}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label={language === "id" ? "Tutup" : "Close"}
            className="cursor-pointer rounded-md p-1 text-muted transition-colors hover:bg-bg hover:text-navy-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-6">
          {misconceptionId && (
            <MisconceptionDetail
              misconceptionId={misconceptionId}
              onSelectRelatedMisconception={onSelectRelatedMisconception}
              onSelectRelatedQuestion={onSelectRelatedQuestion}
              onViewInConcept={onViewInConcept}
              onOpenMisconceptionPage={onOpenMisconceptionPage}
              verificationContext={verificationContext}
            />
          )}
        </div>
      </aside>
    </div>
  );
}
