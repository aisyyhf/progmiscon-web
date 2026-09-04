import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Button } from "./Button";

type ConfirmButtonVariant = "primary" | "secondary" | "ghost" | "danger";

/**
 * Application-native confirmation dialog. Replaces `window.confirm` for
 * destructive actions so the prompt matches the Progmiscon UI instead of the
 * browser-chrome popup. Opening the dialog performs no mutation; the caller runs
 * its action only from `onConfirm`.
 *
 * `Batal`, Escape, and an overlay click all call `onCancel` without mutating.
 * While `confirming` is true the actions are disabled so the destructive path
 * cannot be triggered twice.
 *
 * Omit `cancelLabel` for a single-action notice (e.g. a success result); the
 * lone button then uses `confirmLabel` and Escape / overlay still call
 * `onCancel`. `align="center"` centers the title, body and button row.
 * `confirmVariant` overrides the confirm button styling (defaults to `danger`
 * for `destructive`, otherwise `primary`).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmIcon,
  onConfirm,
  onCancel,
  confirming = false,
  destructive = false,
  align = "start",
  confirmVariant,
  titleId = "confirm-dialog-title",
  descriptionId = "confirm-dialog-description",
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  confirmIcon?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
  confirming?: boolean;
  destructive?: boolean;
  align?: "start" | "center";
  confirmVariant?: ConfirmButtonVariant;
  titleId?: string;
  descriptionId?: string;
}) {
  const cancelActionRef = useRef<HTMLButtonElement>(null);
  const confirmActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    (cancelActionRef.current ?? confirmActionRef.current)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !confirming) onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, confirming, onCancel]);

  if (!open) return null;

  const centered = align === "center";
  const resolvedConfirmVariant: ConfirmButtonVariant =
    confirmVariant ?? (destructive ? "danger" : "primary");

  return createPortal(
    <div className="fixed inset-0 z-[100] flex min-h-full items-center justify-center overflow-y-auto p-4 font-sans">
      <button
        type="button"
        aria-label={cancelLabel ?? confirmLabel}
        className="fixed inset-0 cursor-default bg-navy-deep/50"
        onClick={() => {
          if (!confirming) onCancel();
        }}
      />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative w-full max-w-md rounded-lg border border-border bg-white p-6 shadow-xl"
      >
        <h2
          id={titleId}
          className={`text-base font-bold text-navy-deep${
            centered ? " text-center" : ""
          }`}
        >
          {title}
        </h2>
        <p
          id={descriptionId}
          className={`mt-2 text-[13px] leading-5 text-muted${
            centered ? " text-center" : ""
          }`}
        >
          {description}
        </p>
        <div
          className={`mt-6 flex flex-wrap gap-2 ${
            centered ? "justify-center" : "justify-end"
          }`}
        >
          {cancelLabel && (
            <Button
              ref={cancelActionRef}
              variant="secondary"
              onClick={onCancel}
              disabled={confirming}
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            ref={confirmActionRef}
            variant={resolvedConfirmVariant}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
