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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/65 px-4 backdrop-blur-sm animate-fade" role="dialog" aria-modal="true">
      <button className="absolute inset-0 cursor-default" type="button" aria-label={cancelLabel} onClick={onClose} />
      <div className={`modal-panel relative max-h-[90vh] w-full overflow-y-auto rounded-lg border border-[var(--line)] bg-[var(--panel)] p-5 shadow-xl ${size === "large" ? "max-w-6xl" : "max-w-md"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className={tone === "danger" ? "rounded-lg bg-rose-400/15 p-2 text-rose-200" : "rounded-lg bg-blue-500/10 p-2 text-blue-600"}>
              <AlertTriangle className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h3 className="text-lg font-semibold text-white">{title}</h3>
              {description ? <p className="mt-1 text-sm text-slate-400">{description}</p> : null}
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            aria-label={cancelLabel}
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        {children ? <div className="mt-4 rounded-lg border border-white/10 bg-black/[0.16] p-3 text-sm text-slate-300">{children}</div> : null}
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
