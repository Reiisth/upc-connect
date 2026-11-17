"use client";
import * as React from "react";
import { FormFieldContext } from "./form-field-context";

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
  const generated = React.useId();
  function findId(nodes: React.ReactNode): string | undefined {
    for (const node of React.Children.toArray(nodes)) {
      if (!React.isValidElement<{ id?: string; children?: React.ReactNode }>(node)) continue;
      if (node.props.id) return node.props.id;
      const nested = findId(node.props.children);
      if (nested) return nested;
    }
  }
  const id = htmlFor ?? findId(children) ?? `field-${generated}`;
  const describedBy = [description ? `${id}-description` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  // Native controls also occur in configured fields; shared controls read the context.
  function nativeControls(nodes: React.ReactNode): React.ReactNode {
    return React.Children.map(nodes, node => {
      if (!React.isValidElement<{ id?: string; type?: string; children?: React.ReactNode; "aria-describedby"?: string; "aria-invalid"?: boolean; "aria-required"?: boolean }>(node)) return node;
      if (typeof node.type !== "string") return node;
      if (["input","select","textarea"].includes(node.type)) {
        if (node.props.type === "hidden") return node;
        if (node.props.id && node.props.id !== id) return node;
        return React.cloneElement(node, { id, "aria-describedby": [node.props["aria-describedby"],describedBy].filter(Boolean).join(" ") || undefined,
          "aria-invalid": Boolean(error) || node.props["aria-invalid"] || undefined, "aria-required": required || node.props["aria-required"] || undefined });
      }
      return node.props.children ? React.cloneElement(node, {}, nativeControls(node.props.children)) : node;
    });
  }
  return (
    <FormFieldContext.Provider value={{ id, describedBy, invalid: Boolean(error), required }}>
    <div
      className={cn("min-w-0 space-y-2", className)}
      style={style}
    >
      <label
        htmlFor={id}
        className="block text-sm font-medium text-slate-700"
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

      {nativeControls(children)}

      {description && <p id={`${id}-description`} className="text-sm text-slate-600">{description}</p>}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
    </FormFieldContext.Provider>
  );
}
