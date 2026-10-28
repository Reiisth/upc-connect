"use client";

import * as React from "react";
import { useFormStatus } from "react-dom";

import { cn } from "@/lib/utils";

type TableActionSubmitProps = {
  children: React.ReactNode;
  pendingLabel: string;
  icon?: React.ReactNode;
  variant?: "default" | "danger" | "success";
  className?: string;
};

const variantClasses = {
  default:
    "text-slate-600 hover:text-[#203264]",

  danger:
    "text-red-600 hover:text-red-700",

  success:
    "text-green-600 hover:text-green-700",
};

const baseClasses =
  "inline-flex items-center gap-1.5 text-sm font-medium transition " +
  "underline-offset-4 hover:underline " +
  "focus-visible:outline-none focus-visible:underline " +
  "active:scale-95 disabled:pointer-events-none disabled:opacity-50 " +
  "[&_svg]:h-3.5 [&_svg]:w-3.5";

export function TableActionSubmit({
  children,
  pendingLabel,
  icon,
  variant = "default",
  className,
}: TableActionSubmitProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        baseClasses,
        variantClasses[variant],
        className,
      )}
    >
      {icon}

      {pending ? pendingLabel : children}
    </button>
  );
}