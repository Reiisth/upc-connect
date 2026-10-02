"use client";

import { X } from "lucide-react";

type ConfirmActionModalProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loadingLabel: string;
  loading: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export default function ConfirmActionModal({
  open,
  title,
  description,
  confirmLabel,
  loadingLabel,
  loading,
  destructive = false,
  onConfirm,
  onClose,
}: ConfirmActionModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-body text-xl font-semibold text-[#203264]">
              {title}
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-600">
              {description}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              destructive
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#203264] hover:bg-[#172544]"
            }`}
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}

            {loading ? loadingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}