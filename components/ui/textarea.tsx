import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        "min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 transition placeholder:text-slate-400 hover:border-slate-400 focus-visible:border-[#5D94E8] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#5D94E8]/10 focus-visible:ring-offset-0 aria-invalid:border-red-400 aria-invalid:focus-visible:border-red-400 aria-invalid:focus-visible:ring-red-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 disabled:opacity-70 disabled:hover:border-slate-300",
        className,
      )}
      {...props}
    />
  );
});

Textarea.displayName = "Textarea";

export { Textarea };
