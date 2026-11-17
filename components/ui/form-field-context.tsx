"use client";
import { createContext, useContext } from "react";

export const FormFieldContext = createContext<{ id: string; describedBy?: string; invalid: boolean; required: boolean } | null>(null);

type ControlProps = { id?: string; "aria-describedby"?: string; "aria-invalid"?: boolean | "false" | "true" | "grammar" | "spelling"; "aria-required"?: boolean | "false" | "true" };
export function useFormControl<T extends ControlProps>(props: T) {
  const field = useContext(FormFieldContext);
  if (!field || props.id && props.id !== field.id) return props;
  const describedBy = [...new Set([props["aria-describedby"], field.describedBy].filter(Boolean).join(" ").split(/\s+/).filter(Boolean))].join(" ");
  return { ...props, id: props.id ?? field.id,
    "aria-describedby": describedBy || undefined,
    "aria-invalid": field.invalid || props["aria-invalid"] || undefined,
    "aria-required": field.required || props["aria-required"] || undefined,
  };
}
