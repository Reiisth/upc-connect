"use client";

import { useId, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

type ConfirmActionModalProps = {
  children?: ReactNode;
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loadingLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function ConfirmActionModal({
  open, children,
  title,
  description,
  confirmLabel = "Confirm",
  loadingLabel = "Please wait...",
  cancelLabel = "Cancel",
  variant = "default",
  destructive,
  loading = false,
  onConfirm,
  onClose,
}: ConfirmActionModalProps) {
  const id = useId();
  if (!open) return null;

  return (
    <Dialog open={open} onClose={onClose} dismissible={!loading} busy={loading} labelledBy={`${id}-title`} describedBy={`${id}-description`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={`${id}-title`} className="font-radio-canada text-lg font-semibold text-[#203264]">
              {title}
            </h2>

            <p id={`${id}-description`} className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365FA6] disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {children && <div className="mt-4">{children}</div>}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            data-dialog-initial-focus
          >
            {cancelLabel}
          </Button>

          <Button
            type="button"
            variant={destructive || variant === "danger" ? "destructive" : "default"}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? loadingLabel : confirmLabel}
          </Button>
        </div>
    </Dialog>
  );
}
