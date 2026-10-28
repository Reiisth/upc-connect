import * as React from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center",
        className,
      )}
    >
      {icon && (
        <div className="mb-4 rounded-full bg-[#EEF3FB] p-3 text-[#203264]">
          {icon}
        </div>
      )}

      <h3 className="font-prompt text-base font-semibold text-[#203264]">
        {title}
      </h3>

      {description && (
        <p className="mt-2 max-w-md text-sm text-slate-500">
          {description}
        </p>
      )}

      {action && (
        <div className="mt-5">
          {action}
        </div>
      )}
    </div>
  );
}