import * as React from "react";

import { cn } from "@/lib/utils";

type FormActionsProps = {
  children: React.ReactNode;
  className?: string;
};

export function FormActions({
  children,
  className,
}: FormActionsProps) {
  return (
    <div
      className={cn(
        "flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 [&>a]:min-h-11 [&>button]:min-h-11 sm:flex-row sm:items-center sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}
