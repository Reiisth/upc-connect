import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

type ClickableCardProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
};

export function ClickableCard({
  href,
  children,
  className,
}: ClickableCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition",
        "hover:-translate-y-0.5 hover:border-[#5D94E8] hover:shadow-md",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5D94E8] focus-visible:ring-offset-2",
        "dark:border-slate-700 dark:bg-slate-900 dark:hover:border-[#5D94E8]",
        className,
      )}
    >
      {children}
    </Link>
  );
}