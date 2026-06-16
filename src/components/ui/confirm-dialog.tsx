"use client";

import type { ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "default",
  size = "default",
  isBusy = false,
  confirmDisabled = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  size?: "default" | "large";
  isBusy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 px-4 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" type="button" aria-label={cancelLabel} onClick={onClose} />
      <div className={`modal-panel relative max-h-[90vh] w-full overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--panel)] p-6 shadow-xl ${size === "large" ? "max-w-7xl" : "max-w-md"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={tone === "danger" ? "rounded-lg bg-[var(--negative-soft)] p-2 text-[var(--negative)]" : "rounded-lg bg-blue-500/10 p-2 text-[var(--primary)]"}>
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-[var(--foreground)]">{title}</h3>
              {description ? <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{description}</p> : null}
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-[var(--muted)] transition hover:bg-[var(--panel-soft)] hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus)]"
            aria-label={cancelLabel}
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children ? <div className="mt-4 rounded-lg border border-[var(--line)] bg-[var(--panel-soft)] p-3 text-sm text-[var(--foreground)]">{children}</div> : null}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={tone === "danger" ? "danger" : "default"} onClick={onConfirm} disabled={isBusy || confirmDisabled}>
            {isBusy ? "Working" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
