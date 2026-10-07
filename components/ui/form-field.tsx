import * as React from "react";

import { cn } from "@/lib/utils";

type FormFieldProps = {
  label: string;
  htmlFor?: string;
  required?: boolean;
  description?: string;
  error?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
};

export function FormField({
  label,
  htmlFor,
  required = false,
  description,
  error,
  className,
  style,
  children,
}: FormFieldProps) {
  return (
    <div
      className={cn("space-y-2", className)}
      style={style}
    >
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700 dark:text-slate-200"
      >
        {label}

        {required && (
          <span
            className="ml-1 text-red-500"
            aria-hidden="true"
          >
            *
          </span>
        )}
      </label>

      {children}

      {error ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : description ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}