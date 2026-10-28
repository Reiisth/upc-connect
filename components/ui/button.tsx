import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-gradient-to-r from-[#5D94E8] to-[#203264] text-white shadow-sm hover:opacity-90",

        destructive:
          "border border-red-200 bg-red-50 text-red-700 shadow-sm hover:bg-red-100",

        outline:
          "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",

        secondary:
          "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",

        ghost:
          "bg-transparent text-slate-600 hover:bg-slate-100",

        link:
          "text-[#203264] underline-offset-4 hover:underline",
      },

      size: {
        default: "h-10 px-4 py-2.5",
        sm: "h-9 px-3 text-sm",
        lg: "h-11 px-5 text-base",
        icon: "h-10 w-10",
      },
    },

    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
