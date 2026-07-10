"use client";

import { useEffect } from "react";
import { cn } from "@/lib/cn";

export type ActionPromptToastProps = {
  open: boolean;
  message: string;
  primaryLabel: string;
  secondaryLabel: string;
  onPrimary: () => void;
  onSecondary: () => void;
  onDismiss?: () => void;
  /** auto-dismiss ms; 0 = no auto dismiss */
  durationMs?: number;
  className?: string;
};

export function ActionPromptToast({
  open,
  message,
  primaryLabel,
  secondaryLabel,
  onPrimary,
  onSecondary,
  onDismiss,
  durationMs = 8000,
  className,
}: ActionPromptToastProps) {
  useEffect(() => {
    if (!open || durationMs <= 0) return;
    const timer = window.setTimeout(() => onDismiss?.(), durationMs);
    return () => window.clearTimeout(timer);
  }, [open, durationMs, onDismiss]);

  if (!open) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-x-0 bottom-0 z-[75] flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] p-4 shadow-[var(--shadow-modal)]">
        <p className="text-sm font-medium text-[var(--text-primary)]">{message}</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onPrimary}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] transition hover:opacity-95"
          >
            {primaryLabel}
          </button>
          <button
            type="button"
            onClick={onSecondary}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-muted)]"
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
