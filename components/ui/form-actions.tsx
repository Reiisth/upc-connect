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
        "flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end",
        className,
      )}
    >
      {children}
    </div>
  );
}