"use client";
import * as React from "react";
import { useFormControl } from "./form-field-context";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  const control = useFormControl(props);
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full min-w-0 resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 md:text-sm transition placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-[#5D94E8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5D94E8]/10 focus-visible:ring-offset-0 aria-invalid:border-red-400 aria-invalid:focus-visible:border-red-400 aria-invalid:focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-70 disabled:hover:border-slate-300",
        className,
      )}
      {...control}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
