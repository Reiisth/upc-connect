"use client";

import { LoaderCircle } from "lucide-react";
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
  "inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-medium transition md:min-h-9 " +
  "underline-offset-4 hover:underline " +
  "focus-visible:rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365FA6] focus-visible:underline " +
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
      aria-busy={pending}
      className={cn(
        baseClasses,
        variantClasses[variant],
        className,
      )}
    >
      {pending ? <LoaderCircle aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : icon}

      {pending ? pendingLabel : children}
    </button>
  );
}
