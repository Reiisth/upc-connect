import * as React from "react";

import { cn } from "@/lib/utils";

type FormSectionProps = {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function FormSection({
  title,
  description,
  children,
  className,
}: FormSectionProps) {
  return (
    <section
      className={cn(
        "space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm",
        className,
      )}
    >
      {(title || description) && (
        <div>
          {title && (
            <h2 className="font-prompt text-lg font-semibold text-[#203264]">
              {title}
            </h2>
          )}

          {description && (
            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>
          )}
        </div>
      )}

      {children}
    </section>
  );
}