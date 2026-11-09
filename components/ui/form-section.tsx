import * as React from "react";

import { cn } from "@/lib/utils";

type FormSectionProps = {
  title?: string;
  icon?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

export function FormSection({
  title,
  icon,
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
            <h2 className="flex items-center gap-2 font-prompt text-lg font-semibold text-[#203264]">
              {icon && <span aria-hidden="true" className="shrink-0 text-[#5D94E8] [&_svg]:h-5 [&_svg]:w-5">{icon}</span>}
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