import * as React from "react";

import { cn } from "@/lib/utils";

type StatusBadgeVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "muted";

type StatusBadgeProps = {
  children: React.ReactNode;
  variant?: StatusBadgeVariant;
  className?: string;
};

const variantClasses: Record<StatusBadgeVariant, string> = {
  default:
    "bg-slate-100 text-slate-700",

  success:
    "bg-green-50 text-green-700",

  warning:
    "bg-amber-50 text-amber-700",

  danger:
    "bg-red-50 text-red-700",

  info:
    "bg-blue-50 text-blue-700",

  muted:
    "bg-slate-100 text-slate-500",
};

export function StatusBadge({
  children,
  variant = "default",
  className,
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}