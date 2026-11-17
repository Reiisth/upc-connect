"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  describedBy?: string;
  dismissible?: boolean;
  busy?: boolean;
  className?: string;
  children: ReactNode;
};

/** Native modal dialogs provide top-layer rendering and make the background inert. */
export function Dialog({ open, onClose, labelledBy, describedBy, dismissible = true, busy = false, className, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open || !ref.current) return;
    const dialog = ref.current;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.showModal();
    const initial = dialog.querySelector<HTMLElement>("[data-dialog-initial-focus]");
    initial?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
      else {
        const heading = document.querySelector<HTMLElement>("main h1");
        if (heading) { heading.tabIndex = -1;heading.focus({ preventScroll: true }); }
      }
    };
  }, [open]);

  if (!open) return null;
  return <dialog ref={ref} tabIndex={-1} aria-modal="true" aria-busy={busy || undefined} aria-labelledby={labelledBy} aria-describedby={describedBy}
    className={cn("fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 sm:p-6 shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm", className)}
    onCancel={event => { event.preventDefault(); if (dismissible) onClose(); }}
    onClick={event => {
      if (!dismissible || event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    {children}
  </dialog>;
}
