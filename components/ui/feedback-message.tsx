import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const colors = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-800",
  info: "border-blue-200 bg-blue-50 text-blue-800",
};

export function FeedbackMessage({ variant = "error", className, ...props }: HTMLAttributes<HTMLDivElement> & { variant?: keyof typeof colors }) {
  return <div role={variant === "error" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", colors[variant], className)} {...props} />;
}
