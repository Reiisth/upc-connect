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
        "space-y-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6",
        className,
      )}
    >
      {(title || description) && (
        <div>
          {title && (
            <h2 className="flex items-center gap-2 font-radio-canada text-lg font-semibold text-[#203264]">
              {icon && <span aria-hidden="true" className="shrink-0 text-[#365FA6] [&_svg]:h-5 [&_svg]:w-5">{icon}</span>}
              {title}
            </h2>
          )}

          {description && (
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {description}
            </p>
          )}
        </div>
      )}

      {children}
    </section>
  );
}
