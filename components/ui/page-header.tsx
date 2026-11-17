import * as React from "react";
import Link from "./intent-link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: string;

  eyebrow?: string;
  eyebrowIcon?: React.ReactNode;

  backHref?: string;
  backLabel?: string;

  action?: React.ReactNode;
  className?: string;
};

export function PageHeader({
  title,
  description,
  eyebrow,
  eyebrowIcon,
  backHref,
  backLabel = "Back",
  action,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-3 border-b border-slate-200/80 pb-5", className)}>
      {backHref && (
        <Link
          restoreContext
          href={backHref}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-medium text-slate-600 transition hover:text-[#203264] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#365FA6]"
        >
          <ArrowLeft className="h-4 w-4" />
          {backLabel}
        </Link>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <div className="mb-1 flex items-center gap-2 text-sm font-medium text-[#365FA6]">
              {eyebrowIcon}
              <span>{eyebrow}</span>
            </div>
          )}

          <h1 className="break-words font-radio-canada text-2xl font-semibold leading-tight tracking-tight text-[#203264] sm:text-3xl">
            {title}
          </h1>

          {description && (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              {description}
            </p>
          )}
        </div>

        {action && (
          <div className="flex w-full shrink-0 flex-wrap items-center gap-2 [&>a]:w-full [&>button]:w-full [&>div]:w-full [&>div]:flex-wrap [&>div>a]:flex-1 [&>div>button]:flex-1 sm:w-auto sm:[&>a]:w-auto sm:[&>button]:w-auto sm:[&>div]:w-auto sm:[&>div>a]:flex-none sm:[&>div>button]:flex-none">
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
